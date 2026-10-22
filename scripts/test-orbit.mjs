// Offline test for Nebulux Orbit's server logic (functions/v1/orbit.js): plan steps from the AI's
// list (no lost numbers, no stray markdown markers splitting steps), and syncing that merges devices
// (deletions and "Clear activity" stick, a device with less can't wipe anything).
// Run: node scripts/test-orbit.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const { planSteps, mergeOrbit } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);

// ---- plan steps (QA, Oct 21: "short runs of.1-0.2 miles") ----
let s = planSteps("Here's your plan:\n- Start with short runs of.1-0.2 miles and walk breaks\n- Create a **consistent weekly schedule**\n2. Run 3-4 times a week");
assert(s.length === 3, "an intro line isn't a step; three steps");
assert(s[0] === "Start with short runs of 0.1–0.2 miles and walk breaks", "a number that lost its 0 and space is put right, with an en dash: " + s[0]);
assert(s[1] === "Create a **consistent weekly schedule**", "markdown is kept for the page to show as bold (it isn't stripped into stray asterisks)");
assert(s[2] === "Run 3–4 times a week", "numbered steps work too");
s = planSteps("- Start with short runs of\n0.1-0.2 miles each\n- Rest on Sundays");
assert(s.length === 2 && s[0] === "Start with short runs of 0.1–0.2 miles each", "a wrapped line joins its step instead of losing its number");
s = planSteps("Read for 20 minutes\nWrite a summary");
assert(s.length === 2, "a list without markers: one step per line");
assert(planSteps("- a\n- b\n- c\n- d\n- e\n- f\n- g\n- h\n- i\n- j").length === 8, "at most 8 steps");

// ---- sync merging ----
const cloud = { chats: [{ id: "a", at: 5, msgs: [1] }, { id: "b", at: 5, msgs: [1] }], tasks: [{ id: "t1", text: "x" }], memory: "I like soccer", memAt: 10, activity: [{ t: 100, text: "old" }] };
let r = mergeOrbit(cloud, { chats: [], tasks: [], memory: "", memAt: 0, activity: [] });
assert(r.chats.length === 2 && r.tasks.length === 1 && r.memory === "I like soccer", "a device with nothing saved can't wipe the account");
r = mergeOrbit(cloud, { deleted: ["b"] });
assert(r.chats.map((c) => c.id).join() === "a", "a deleted chat stays deleted");
r = mergeOrbit(cloud, { chats: cloud.chats.map((c) => c.id), deleted: ["a", "b"] });
assert(r.chats.length === 0, "delete all chats: none come back");
r = mergeOrbit(cloud, { activity: [], activityCleared: 150 });
assert(r.activity.length === 0 && r.activityCleared === 150, "Clear activity: older entries don't come back from another device");
r = mergeOrbit(r, { activity: [{ t: 100, text: "old" }, { t: 200, text: "new" }] });
assert(r.activity.length === 1 && r.activity[0].text === "new", "after a clear, only newer activity is kept, even from a device that still has the old list");

// ---- the agent's name and SOUL file ----
const { agentName, selfBlock } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);
assert(agentName({}) === "Orbit" && agentName({ agentName: "Nova <b>" }) === "Nova b", "the agent is Orbit unless renamed (names are cleaned)");
assert(selfBlock({}) === "", "nothing extra by default");
const sb = selfBlock({ agentName: "Nova", soul: "Be playful and short." });
assert(/your name is Nova/.test(sb) && /SOUL file/.test(sb) && /Be playful and short\./.test(sb) && /can't change the rules/.test(sb), "a rename and the SOUL file go to the AI, below the rules");
assert(selfBlock({ soul: "x".repeat(5000) }).length < 2300, "the SOUL file is capped");

// ---- connected apps: sealed permissions, least scopes, "Needs reconnect" (Oct 22 review) ----
const { seal, unseal, isSealed } = await import(new URL("../cloudflare-lib/seal.js", import.meta.url).href);
const { needsOf, googleAccess } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);
const { scopesFor, GOOGLE_SCOPES } = await import(new URL("../functions/v1/orbit-google/start.js", import.meta.url).href);
const env = { GOOGLE_CLIENT_ID: "test-id", GOOGLE_CLIENT_SECRET: "test-only-secret" };
const sealed = await seal(env, "1//refresh-abc", "u1|gmail");
assert(isSealed(sealed) && !sealed.includes("refresh-abc") && sealed.startsWith("s1.g."), "a refresh token is stored sealed, never in plain text");
assert((await unseal(env, sealed, "u1|gmail")) === "1//refresh-abc", "it opens again for its own row");
assert((await unseal(env, sealed, "u2|gmail")) === null, "a sealed value copied onto someone else's row won't open");
assert((await unseal({ GOOGLE_CLIENT_SECRET: "another" }, sealed, "u1|gmail")) === null, "a different secret can't open it");
assert((await unseal(env, "1//older-plain", "u1|gmail")) === "1//older-plain", "an older plain value still works (it's sealed on next use)");
assert((await seal({ ...env, ORBIT_TOKEN_KEY: "k" }, "x", "b")).startsWith("s1.k."), "ORBIT_TOKEN_KEY is used when it's set");
let threw = false; try { await seal({}, "x", "b"); } catch { threw = true; }
assert(threw, "with no secret at all, nothing is stored (it refuses instead of saving plain text)");
assert(!/gmail\.send/.test(GOOGLE_SCOPES.gmail) && /gmail\.readonly/.test(GOOGLE_SCOPES.gmail), "Connect Gmail asks only to read");
assert(/gmail\.readonly/.test(scopesFor("gmail", "send")) && /gmail\.send/.test(scopesFor("gmail", "send")), "turning sending on asks for gmail.send on top");
assert(scopesFor("gmail", "delete") === GOOGLE_SCOPES.gmail && scopesFor("drive", "send") === GOOGLE_SCOPES.drive, "nothing else can be asked for");
assert(needsOf("gmail", "openid https://www.googleapis.com/auth/gmail.readonly").join() === "send", "read-only Gmail: sending needs additional access");
assert(needsOf("gmail", null).length === 0, "connections from before the granted list was kept count as having what they were given");
assert(needsOf("calendar", "openid email").join() === "read,add", "a permission unticked on Google's screen shows as missing");
// googleAccess against a stand-in database and Google
const row = { refresh: "1//older-plain", email: "me@example.com", scopes: null, status: null };
let have = true;
const db = { prepare: (sql) => ({ bind: (...a) => ({
  first: async () => (have ? { ...row } : null),
  run: async () => { if (/status = 'reconnect'/.test(sql)) row.status = "reconnect"; else if (/SET refresh = \?, scopes = \?, status = NULL/.test(sql)) Object.assign(row, { refresh: a[0], scopes: a[1], status: null }); return {}; },
}) }) };
const realFetch = globalThis.fetch;
let sent = "";
globalThis.fetch = async (url, init) => { sent = String(init && init.body); return new Response(JSON.stringify({ access_token: "ya29.x", scope: "openid https://www.googleapis.com/auth/gmail.readonly" }), { status: 200 }); };
let a = await googleAccess(env, db, "u1", "gmail");
assert(a.token === "ya29.x" && /refresh_token=1%2F%2Folder-plain/.test(sent), "an older plain permission still works");
assert(isSealed(row.refresh) && (await unseal(env, row.refresh, "u1|gmail")) === "1//older-plain" && /gmail\.readonly/.test(row.scopes), "...and is sealed, with what was granted, after that");
a = await googleAccess(env, db, "u1", "gmail");
assert(a.token && /refresh_token=1%2F%2Folder-plain/.test(sent), "a sealed permission is opened to ask Google for access");
globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
a = await googleAccess(env, db, "u1", "gmail");
assert(a.status === "reconnect" && row.status === "reconnect", "a permission Google no longer accepts shows Needs reconnect");
globalThis.fetch = async () => { throw new Error("offline"); };
row.status = null;
a = await googleAccess(env, db, "u1", "gmail");
assert(a.status === "down" && row.status === null, "Google being unreachable isn't mistaken for a dead permission");
have = false;
assert((await googleAccess(env, db, "u1", "gmail")).status === "none", "not connected says so");
globalThis.fetch = realFetch;
// Connect asks for the permission screen with a POST; the address names only what's needed.
const { connectAddress } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);
const states = [];
const sdb = { prepare: () => ({ bind: (...a) => ({ run: async () => states.push(a) }) }) };
let u = new URL(await connectAddress(env, sdb, "https://nebuluxai.com", "u1", "gmail", "", "https://nebuluxorbit.thebluedragonstriker.workers.dev/"));
assert(u.host === "accounts.google.com" && !/gmail\.send/.test(u.searchParams.get("scope")) && u.searchParams.get("redirect_uri") === "https://nebuluxai.com/v1/orbit-google/callback", "Connect Gmail opens Google's screen asking only to read");
assert(states[0][1] === "u1" && states[0][2] === "gmail https://nebuluxorbit.thebluedragonstriker.workers.dev/" && u.searchParams.get("state") === states[0][0] && !u.href.includes("test-only-secret"), "a one-time state remembers who and where (no secret in the address)");
u = new URL(await connectAddress(env, sdb, "https://nebuluxai.com", "u1", "gmail", "send", "https://nebuluxorbit.thebluedragonstriker.workers.dev/"));
assert(/gmail\.send/.test(u.searchParams.get("scope")) && u.searchParams.get("include_granted_scopes") === "true", "Allow sending asks for gmail.send, keeping what was granted");
u = new URL(await connectAddress({ GITHUB_CLIENT_ID: "gh" }, sdb, "https://nebuluxai.com", "u1", "github", "", "https://nebuluxorbit.thebluedragonstriker.workers.dev/"));
assert(u.host === "github.com" && states[2][2].startsWith("github ") && u.searchParams.get("redirect_uri") === "https://nebuluxai.com/github/callback/orbit", "GitHub uses its own screen and return address");
