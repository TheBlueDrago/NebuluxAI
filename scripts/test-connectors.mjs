// Offline test for Connectors (cloudflare-lib/apps.js, functions/v1/connect): every app's permission
// page address, swapping the code and keeping it sealed, renewing an expired permission, reading each
// app (with made-up answers shaped like the real ones), sending only after Send, which chat questions
// read which apps, and the endpoint's sign-in, return-address and CORS checks.
// Run: node scripts/test-connectors.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const A = await import(new URL("../cloudflare-lib/apps.js", import.meta.url).href);
const { APPS, isReady, startUrl, finish, appAccess, readApp, writeApp, readText, appsAskedAbout, CALLBACK, writesOf } = A;
const { unseal } = await import(new URL("../cloudflare-lib/seal.js", import.meta.url).href);

// ---- a tiny D1 with just the statements Connectors use ----
function fakeDb() {
  const states = new Map(), conns = new Map(), tokens = new Map([["a".repeat(48), { user_id: "u1", name: "Sam" }]]);
  const exec = (sql, a) => {
    if (/INSERT INTO orbit_states/.test(sql)) states.set(a[0], { user_id: a[1], back: a[2], exp: a[3] });
    else if (/DELETE FROM orbit_states/.test(sql)) states.delete(a[0]);
    else if (/INSERT INTO orbit_connections/.test(sql)) { const key = a[0] + "|" + a[1]; conns.set(key, a.length === 3 ? { user_id: a[0], provider: a[1], refresh: "-", email: "", status: null } : { user_id: a[0], provider: a[1], refresh: a[2], email: a[3], scopes: a[5], status: null }); }
    else if (/UPDATE orbit_connections SET refresh = \?, status = NULL/.test(sql)) { const c = conns.get(a[1] + "|" + a[2]); if (c) Object.assign(c, { refresh: a[0], status: null }); }
    else if (/SET status = 'reconnect'/.test(sql)) { const c = conns.get(a[0] + "|" + a[1]); if (c) c.status = "reconnect"; }
    else if (/DELETE FROM orbit_connections/.test(sql)) conns.delete(a[0] + "|" + a[1]);
  };
  const query = (sql, a) => {
    if (/FROM orbit_states/.test(sql)) return states.has(a[0]) ? [states.get(a[0])] : [];
    if (/SELECT refresh, email, status FROM orbit_connections/.test(sql)) return conns.has(a[0] + "|" + a[1]) ? [conns.get(a[0] + "|" + a[1])] : [];
    if (/SELECT provider, email, status FROM orbit_connections/.test(sql)) return [...conns.values()].filter((c) => c.user_id === a[0]);
    if (/FROM orbit_tokens/.test(sql)) return tokens.has(a[0]) ? [tokens.get(a[0])] : [];
    if (/PRAGMA/.test(sql)) return [{ name: "scopes" }, { name: "status" }];
    return [];
  };
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => (exec(sql, args), { success: true }), first: async () => query(sql, args)[0] || null, all: async () => ({ results: query(sql, args) }) });
  return { prepare: (sql) => stmt(sql), batch: async () => [], states, conns };
}

// ---- made-up app servers ----
const calls = [];
const reply = (data, status = 200) => new Response(data == null ? "" : JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
let deny = ""; // a host that answers 401 (taken back)
const API = [
  [/oauth2?\/token|oauth\.v2\.access|access_token$|oauth_token|\/token\/?$/, (u, i) => {
    const body = String(i.body || "");
    if (/refresh_token/.test(body)) return reply({ access_token: "fresh", expires_in: 3600, refresh_token: "r2" });
    if (/slack/.test(u)) return reply({ ok: true, authed_user: { id: "U1", access_token: "xoxp-1" }, team: { name: "Team Rocket" } });
    if (/instagram/.test(u)) return reply({ data: [{ access_token: "short", user_id: "1" }] });
    if (/discord/.test(u)) return reply({ access_token: "d1", expires_in: 604800, refresh_token: "dr", webhook: { url: "https://discord.com/api/webhooks/1/abc", name: "Orbit", channel_id: "9" } });
    if (/notion/.test(u)) return reply({ access_token: "n1", workspace_name: "Sam's Notion" });
    return reply({ access_token: "t1", expires_in: 3600, refresh_token: "r1", scope: "x" });
  }],
  [/graph\.instagram\.com\/access_token/, () => reply({ access_token: "long", expires_in: 5184000 })],
  [/api\.notion\.com\/v1\/search/, () => reply({ results: [{ object: "page", url: "https://notion.so/p", last_edited_time: "2026-10-29T10:00:00Z", properties: { Name: { type: "title", title: [{ plain_text: "Science notes" }] } } }] })],
  [/slack\.com\/api\/conversations\.list/, () => reply({ ok: true, channels: [{ id: "C0GEN12345", name: "general", is_member: true, topic: { value: "Hi" } }, { id: "C0RND12345", name: "random", is_member: false }] })],
  [/slack\.com\/api\/conversations\.history/, () => reply({ ok: true, messages: [{ text: "Practice at 5", ts: "1761800000.0001" }] })],
  [/slack\.com\/api\/chat\.postMessage/, () => reply({ ok: true })],
  [/api\.spotify\.com\/v1\/me$/, () => reply({ display_name: "Sam" })],
  [/currently-playing/, () => reply({ item: { name: "Song A", artists: [{ name: "Band" }] } })],
  [/recently-played/, () => reply({ items: [{ track: { name: "Song B", artists: [{ name: "Band 2" }] } }] })],
  [/me\/top\/artists/, () => reply({ items: [{ name: "Band", genres: ["pop"] }] })],
  [/me\/playlists/, () => reply({ items: [{ name: "Focus", tracks: { total: 20 } }] })],
  [/discord\.com\/api\/v10\/users\/@me\/guilds/, () => reply([{ name: "Science club", owner: true }])],
  [/discord\.com\/api\/v10\/users\/@me$/, () => reply({ global_name: "Sam" })],
  [/discord\.com\/api\/webhooks/, () => reply({ id: "m1" })],
  [/api\.x\.com\/2\/users\/me/, () => reply({ data: { id: "42", username: "sam", name: "Sam", public_metrics: { followers_count: 12 } } })],
  [/api\.x\.com\/2\/users\/42\/tweets/, () => reply({ data: [{ text: "Hello", created_at: "2026-10-29T10:00:00Z" }] })],
  [/api\.x\.com\/2\/tweets/, () => reply({ data: { id: "1" } }, 201)],
  [/oauth\.reddit\.com\/api\/v1\/me/, () => reply({ name: "sam" })],
  [/subreddits\/mine/, () => reply({ data: { children: [{ data: { display_name: "science", public_description: "Science!" } }] } })],
  [/\/saved/, () => reply({ data: { children: [{ data: { title: "Cool post", subreddit: "space" } }] } })],
  [/api\.pinterest\.com\/v5\/user_account/, () => reply({ username: "sam" })],
  [/api\.pinterest\.com\/v5\/boards/, () => reply({ items: [{ name: "Recipes", pin_count: 4 }] })],
  [/api\.pinterest\.com\/v5\/pins/, () => reply({ items: [{ title: "Cake" }] })],
  [/open\.tiktokapis\.com\/v2\/user\/info/, () => reply({ data: { user: { display_name: "Sam" } } })],
  [/open\.tiktokapis\.com\/v2\/video\/list/, () => reply({ data: { videos: [{ title: "My dance", view_count: 100, like_count: 9, create_time: 1761800000 }] } })],
  [/graph\.instagram\.com\/me\/media/, () => reply({ data: [{ caption: "Beach day", like_count: 5, comments_count: 1, timestamp: "2026-10-29T10:00:00+0000" }] })],
  [/graph\.instagram\.com\/me\?/, () => reply({ username: "sam", followers_count: 30, media_count: 3 })],
  [/get_current_account/, () => reply({ email: "sam@example.com" })],
  [/files\/list_folder/, () => reply({ entries: [{ ".tag": "file", name: "essay.docx", server_modified: "2026-10-29T10:00:00Z" }] })],
  [/graph\.microsoft\.com\/v1\.0\/me\/messages/, () => reply({ value: [{ subject: "Field trip", isRead: false, from: { emailAddress: { name: "Ms. K" } }, bodyPreview: "Bring lunch" }] })],
  [/calendarView/, () => reply({ value: [{ subject: "Dentist", start: { dateTime: "2026-11-02T16:00:00" }, location: { displayName: "Clinic" } }] })],
  [/me\/drive\/root\/children/, () => reply({ value: [{ name: "Report.docx", lastModifiedDateTime: "2026-10-29T10:00:00Z" }] })],
  [/me\/todo\/lists\/L1\/tasks/, () => reply({ value: [{ title: "Buy milk" }] })],
  [/me\/todo\/lists/, () => reply({ value: [{ id: "L1", displayName: "Groceries" }] })],
  [/graph\.microsoft\.com\/v1\.0\/me$/, () => reply({ mail: "sam@outlook.com" })],
  [/api\.todoist\.com\/api\/v1\/tasks/, (u, i) => (i.method === "POST" ? reply({ id: "1" }) : reply({ results: [{ content: "Math homework", due: { string: "tomorrow" }, priority: 4 }] }))],
  [/app\.asana\.com\/api\/1\.0\/users\/me/, () => reply({ data: { email: "sam@example.com", workspaces: [{ gid: "W1", name: "School" }] } })],
  [/app\.asana\.com\/api\/1\.0\/tasks/, () => reply({ data: [{ name: "Poster", due_on: "2026-11-03" }] })],
  [/api\.linear\.app\/graphql/, (u, i) => (/viewer \{ email/.test(i.body) ? reply({ data: { viewer: { email: "sam@example.com" } } }) : reply({ data: { viewer: { assignedIssues: { nodes: [{ identifier: "ENG-1", title: "Fix login", state: { name: "Todo" } }] } } } }))],
  [/api\.zoom\.us\/v2\/users\/me\/meetings/, () => reply({ meetings: [{ topic: "Study group", start_time: "2026-11-01T18:00:00Z", duration: 45 }] })],
  [/api\.zoom\.us\/v2\/users\/me/, () => reply({ email: "sam@example.com" })],
  [/helix\/users/, () => reply({ data: [{ id: "7", display_name: "Sam" }] })],
  [/helix\/streams\/followed/, () => reply({ data: [{ user_name: "Streamer", title: "Speedrun", game_name: "Racing", viewer_count: 50 }] })],
  [/helix\/channels\/followed/, () => reply({ data: [{ broadcaster_name: "Streamer" }] })],
];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ u, init });
  if (deny && u.includes(deny)) return reply({ error: "invalid_token" }, 401);
  for (const [re, f] of API) if (re.test(u)) return f(u, init);
  return reply({ error: "not found" }, 404);
};

const env = { ORBIT_TOKEN_KEY: "test-key-123" };
for (const k of Object.keys(APPS)) { const e = APPS[k].env; env[e + "_CLIENT_ID"] = "id-" + e; env[e + "_CLIENT_SECRET"] = "secret-" + e; }
const db = fakeDb();

// ---- set up or not ----
assert(Object.keys(APPS).length >= 18, "at least 18 apps beyond Google's and GitHub: " + Object.keys(APPS).length);
assert(!isReady({}, "spotify") && !isReady({ SPOTIFY_CLIENT_ID: "x" }, "spotify") && isReady(env, "spotify"), "an app is ready only with both its id and secret");
assert(isReady(env, "outlook") && isReady(env, "onedrive") && isReady(env, "mstodo"), "Microsoft's three apps share one Microsoft app");

// ---- permission page addresses ----
for (const k of Object.keys(APPS)) {
  const u = new URL(await startUrl(env, db, "u1", k, "https://nebuluxai.com/"));
  const p = APPS[k];
  const idOk = u.searchParams.get(p.idKey || "client_id") === "id-" + p.env;
  const scopeOk = p.scope ? u.searchParams.get(p.scopeKey || "scope") === p.scope : !u.searchParams.has("scope");
  const pkceOk = !p.pkce || (u.searchParams.get("code_challenge_method") === "S256" && (u.searchParams.get("code_challenge") || "").length >= 43);
  const st = db.states.get(u.searchParams.get("state"));
  assert(u.origin === new URL(p.auth).origin && idOk && scopeOk && pkceOk && u.searchParams.get("redirect_uri") === CALLBACK && u.searchParams.get("response_type") === "code" && st && st.back.startsWith(`app:${k} `), `${k}: its own permission page, with the client id, scope${p.pkce ? ", PKCE" : ""} and Nebulux's return address`);
}
assert(new URL(await startUrl(env, db, "u1", "tiktok", "https://nebuluxai.com/")).searchParams.get("client_key") === "id-TIKTOK", "TikTok gets its client_key");
assert(new URL(await startUrl(env, db, "u1", "slack", "https://nebuluxai.com/")).searchParams.get("user_scope").includes("chat:write"), "Slack asks for the person's own permission (user_scope)");
assert(!/client_secret|secret-/.test(await startUrl(env, db, "u1", "notion", "https://x/")), "no secret is ever in a permission page address");

// ---- swapping the code ----
const tokenCall = () => calls.filter((c) => /token|oauth\.v2\.access|oauth_token/.test(c.u) && c.init.method === "POST").pop();
let r = await finish(env, db, "spotify", "u1", "code1", "-");
let tc = tokenCall();
assert(r.ok && r.account === "Sam", "Spotify connects, and who it is comes from Spotify: " + r.account);
assert(/^Basic /.test(tc.init.headers.Authorization) && !/client_secret/.test(tc.init.body) && /redirect_uri=/.test(tc.init.body), "Spotify's secret goes in the Basic header, not the body");
const row = db.conns.get("u1|spotify");
assert(row && row.refresh.startsWith("s1.") && !row.refresh.includes("t1"), "the permission is kept sealed");
assert(JSON.parse(await unseal(env, row.refresh, "u1|spotify")).r === "r1", "the sealed value opens only for this person and app");
assert((await unseal(env, row.refresh, "u2|spotify")) == null, "and not for someone else");
r = await finish(env, db, "notion", "u1", "code2", "-"); tc = tokenCall();
assert(r.ok && r.account === "Sam's Notion" && tc.init.headers["Content-Type"] === "application/json", "Notion: JSON body, the workspace name as the account");
r = await finish(env, db, "slack", "u1", "code3", "-");
assert(r.ok && r.account === "Team Rocket", "Slack: the person's own permission (authed_user) is the one kept");
r = await finish(env, db, "instagram", "u1", "code4", "-");
assert(r.ok && JSON.parse(await unseal(env, db.conns.get("u1|instagram").refresh, "u1|instagram")).a === "long", "Instagram: the first permission is swapped for the 60-day one");
r = await finish(env, db, "discord", "u1", "code5", "-");
assert(r.ok && JSON.parse(await unseal(env, db.conns.get("u1|discord").refresh, "u1|discord")).x.hook.includes("/webhooks/"), "Discord: the picked channel's webhook is kept");
const v = A.verifier();
await startUrl(env, db, "u1", "x", "https://nebuluxai.com/");
r = await finish(env, db, "x", "u1", "code6", v); tc = tokenCall();
assert(r.ok && tc.init.body.includes("code_verifier=" + v) && tc.init.body.includes("client_id=id-X"), "X: the PKCE verifier and client id go with the code");
for (const k of Object.keys(APPS)) if (!db.conns.has("u1|" + k)) await finish(env, db, k, "u1", "c-" + k, "-");
assert(Object.keys(APPS).every((k) => db.conns.has("u1|" + k)), "every app connects");

// ---- renewing ----
const sealNow = async (k, b) => { const { seal } = await import(new URL("../cloudflare-lib/seal.js", import.meta.url).href); db.conns.get("u1|" + k).refresh = await seal(env, JSON.stringify(b), "u1|" + k); };
await sealNow("spotify", { a: "old", r: "r1", e: Date.now() - 1000, x: {} });
let a = await appAccess(env, db, "u1", "spotify");
assert(a.token === "fresh", "an expired permission is renewed with its refresh token");
assert(JSON.parse(await unseal(env, db.conns.get("u1|spotify").refresh, "u1|spotify")).a === "fresh", "and the renewed one is kept");
await sealNow("outlook", { a: "old", r: "r1", e: Date.now() - 1000, x: {} });
await appAccess(env, db, "u1", "outlook");
assert(/scope=offline_access/.test(tokenCall().init.body), "Microsoft's renewal asks for the same permissions again");
await sealNow("discord", { a: "old", r: "r1", e: Date.now() - 1000, x: { hook: "https://discord.com/api/webhooks/1/abc" } });
await appAccess(env, db, "u1", "discord");
assert(JSON.parse(await unseal(env, db.conns.get("u1|discord").refresh, "u1|discord")).x.hook, "renewing keeps the extras (Discord's channel)");
db.conns.get("u1|zoom").refresh = "s1.k.garbage";
assert((await appAccess(env, db, "u1", "zoom")).status === "reconnect" && db.conns.get("u1|zoom").status === "reconnect", "a permission that can't be opened asks to reconnect");
await finish(env, db, "zoom", "u1", "again", "-");
assert((await appAccess(env, db, "u1", "nope")).status === "none", "an unknown app isn't connected");

// ---- reading every app ----
for (const k of Object.keys(APPS)) {
  const x = await readApp(env, db, "u1", k);
  const n = (x.sections || []).reduce((s, q) => s + q.items.length, 0);
  assert(!x.error && n > 0 && x.sections.every((s) => s.title && s.items.every((i) => typeof i.t === "string" && i.t.length)), `${k}: reads ${n} item${n === 1 ? "" : "s"} (${x.sections.map((s) => s.title).join(", ")})`);
}
deny = "api.spotify.com";
r = await readApp(env, db, "u1", "spotify");
assert(r.status === "reconnect" && /Reconnect/.test(r.error) && db.conns.get("u1|spotify").status === "reconnect", "a taken-back permission shows Reconnect instead of failing quietly");
deny = "";
r = await readApp(env, db, "u2", "spotify");
assert(/Connect Spotify first/.test(r.error), "someone who hasn't connected is told to connect");
const slack = await readApp(env, db, "u1", "slack");
assert(slack.sections[0].items[0].id === "C0GEN12345" && slack.sections[0].items.length === 1, "Slack lists only channels they're in, with ids to send to");
const txt = readText(slack);
assert(txt.startsWith("Slack (Team Rocket):") && txt.includes("#general") && txt.includes("Practice at 5"), "the AI gets a short text version");
assert(readText({ name: "X", sections: [{ title: "T", items: Array.from({ length: 500 }, () => ({ t: "a long line of text here" })) }] }).length <= 3500, "and it's kept short");

// ---- sending only after Send ----
r = await writeApp(env, db, "u1", "slack", "send", { text: "hi", where: "C0GEN12345" });
assert(/press Send/.test(r.error), "nothing is sent without confirmed: true");
r = await writeApp(env, db, "u1", "slack", "send", { text: "hi", where: "C0GEN12345", confirmed: true });
const post = calls.filter((c) => /chat\.postMessage/.test(c.u)).pop();
assert(r.ok && JSON.parse(post.init.body).channel === "C0GEN12345", "Slack sends to the picked channel after Send");
r = await writeApp(env, db, "u1", "slack", "send", { text: "hi", where: "#General", confirmed: true });
assert(r.ok && JSON.parse(calls.filter((c) => /chat\.postMessage/.test(c.u)).pop().init.body).channel === "C0GEN12345", "a Slack draft to #general finds that channel");
r = await writeApp(env, db, "u1", "slack", "send", { text: "hi", where: "#random", confirmed: true });
assert(!r.ok, "but not one they aren't in");
r = await writeApp(env, db, "u1", "discord", "post", { text: "@everyone hi", confirmed: true });
const hook = calls.filter((c) => /webhooks/.test(c.u)).pop();
assert(r.ok && JSON.parse(hook.init.body).allowed_mentions.parse.length === 0, "Discord posts to the picked channel and can't ping everyone");
r = await writeApp(env, db, "u1", "x", "post", { text: "a".repeat(400), confirmed: true });
assert(r.ok && JSON.parse(calls.filter((c) => /2\/tweets$/.test(c.u)).pop().init.body).text.length === 280, "X posts are cut to 280 characters");
r = await writeApp(env, db, "u1", "todoist", "add", { text: "Read chapter 3", due: "tomorrow", confirmed: true });
assert(r.ok, "Todoist adds a task");
r = await writeApp(env, db, "u1", "spotify", "post", { text: "x", confirmed: true });
assert(/can't be sent/.test(r.error), "apps that only read can't send");
r = await writeApp(env, db, "u1", "slack", "send", { text: "  ", confirmed: true });
assert(/Write something/.test(r.error), "an empty message isn't sent");
assert(writesOf("slack")[0].where === "channel" && writesOf("notion").length === 0, "what can be sent is listed per app");

// ---- which apps a chat question reads ----
const conn = ["gmail", "calendar", "spotify", "notion", "zoom", "contacts", "pinterest"];
assert(appsAskedAbout("What was I listening to on Spotify?", conn).join() === "spotify", "Spotify questions read Spotify");
assert(appsAskedAbout("What's on my calendar this week?", conn).join() === "calendar", "calendar questions read the calendar");
assert(appsAskedAbout("summarize my unread emails and my notion pages", conn).join() === "gmail,notion", "two apps at once");
assert(appsAskedAbout("How do I zoom in on a photo? Write an email to my teacher. Bowling pins?", conn).length === 0, "everyday words don't read apps (zoom in, an email, pins)");
assert(appsAskedAbout("what's on my calendar", ["gmail"]).length === 0, "only apps they connected");
assert(appsAskedAbout("gmail calendar spotify notion", conn).length === 2, "at most two apps per question");
assert(A.appsNotConnected("What's on my calendar? And my Spotify playlists?", ["spotify"]).join() === "calendar", "an app they asked about but haven't connected is noticed (to say where to connect it)");
assert(A.appsNotConnected("Write a poem about the sea", []).length === 0, "and nothing is noticed for an everyday question");

// ---- the endpoint ----
const C = await import(new URL("../functions/v1/connect/index.js", import.meta.url).href);
const req = (body, auth = "Orbit " + "a".repeat(48), origin = "https://nebuluxorbit.thebluedragonstriker.workers.dev") => new Request("https://nebuluxai.com/v1/connect", { method: "POST", headers: { "content-type": "application/json", authorization: auth, origin }, body: JSON.stringify(body) });
const call = async (body, auth, origin) => { const res = await C.onRequestPost({ request: req(body, auth, origin), env: { ...env, DB: db, GOOGLE_CLIENT_ID: "g" } }); return { status: res.status, cors: res.headers.get("access-control-allow-origin"), d: await res.json() }; };
let x = await call({ action: "list" });
const keys = x.d.apps.map((p) => p.k);
assert(x.status === 200 && keys.length >= 26 && ["gmail", "contacts", "github", "whatsapp", "notion", "twitch"].every((k) => keys.includes(k)), "an Orbit sign-in lists every app: " + keys.length);
assert(!["strava", "oura", "fitbit"].some((k) => keys.includes(k)) && !A.appsNotConnected("How did I sleep? My Strava runs?", []).length, "Strava, Oura and Fitbit aren't offered");
assert(!keys.includes("keep") && !A.appsNotConnected("Read my notes", []).length, "Google Keep isn't offered (Google only allows it for Workspace accounts)");
assert(x.cors === "https://nebuluxorbit.thebluedragonstriker.workers.dev", "Orbit's site may call it (CORS)");
assert(x.d.apps.find((p) => p.k === "slack").connected && x.d.apps.find((p) => p.k === "slack").account === "Team Rocket", "connected apps show who they're connected as");
assert(x.d.apps.find((p) => p.k === "slack").writes.length === 1, "and what they can send");
x = await call({ action: "list" }, "Orbit " + "b".repeat(48));
assert(x.status === 401, "an unknown sign-in is turned away");
x = await call({ action: "list" }, "Orbit " + "a".repeat(48), "https://evil.example");
assert(x.cors === "https://nebuluxai.com", "other sites can't read the answer");
x = await call({ action: "start", app: "notion", back: "https://evil.example/" });
assert(x.status === 400, "it only sends people back to Nebulux addresses");
x = await call({ action: "start", app: "notion", back: "https://nebuluxorbit.thebluedragonstriker.workers.dev/" });
assert(x.status === 200 && x.d.url.startsWith("https://api.notion.com/v1/oauth/authorize"), "Connect gives the app's own permission page");
const noKeys = await C.onRequestPost({ request: req({ action: "start", app: "notion", back: "https://nebuluxai.com/" }), env: { ORBIT_TOKEN_KEY: "k", DB: db } });
assert(noKeys.status === 503 && (await noKeys.json()).notReady, "an app the owner hasn't set up says so");
x = await call({ action: "start", app: "whatsapp" });
assert(x.status === 200 && x.d.ok && db.conns.has("u1|whatsapp"), "WhatsApp turns on without a permission page");
x = await call({ action: "read", app: "zoom" });
assert(x.status === 200 && x.d.text.includes("Study group"), "read gives the sections and the AI's text");
x = await call({ action: "write", app: "slack", op: "send", text: "hi", where: "C0GEN12345" });
assert(x.status === 400, "the endpoint doesn't send without Send either");
x = await call({ action: "disconnect", app: "zoom" });
assert(x.d.ok && !db.conns.has("u1|zoom"), "Disconnect removes it");
x = await call({ action: "start", app: "nope" });
assert(x.status === 400, "unknown apps are refused");
