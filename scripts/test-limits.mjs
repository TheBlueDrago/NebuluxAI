// Offline test for plan publishing limits enforced by the publish functions (Free keeps 1
// website, Pro 3, ...; games are per month), with Base44 (fetch) and KV faked.
// Run: node scripts/test-limits.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const R = (p) => new URL("../" + p, import.meta.url).href;
const { limitError, siteLimit, gameLimit } = await import(R("cloudflare-lib/publishLimits.js"));
const app = await import(R("src/lib/publishLimits.js"));
assert(app.siteLimit === siteLimit && app.gameLimit === gameLimit, "the app shows the same limits the server enforces");

const now = new Date("2026-09-24T12:00:00Z");
const site = (n) => ({ name: n, created_date: "2026-01-01T00:00:00" });
assert(limitError("site", "free", [site("a"), site("b")], now) === "" && /allows 3 websites/.test(limitError("site", "free", [site("a"), site("b"), site("c")], now)), "Free keeps up to 3 websites");
assert(limitError("site", "pro", [site("a"), site("b")], now) === "" && /3 websites/.test(limitError("site", "pro", [site("a"), site("b"), site("c")], now)), "Pro keeps 3");
const game = (d) => ({ name: "g" + d, created_date: d });
assert(limitError("game", "free", [game("2026-08-30T10:00:00")], now) === "", "last month's game doesn't count this month");
assert(limitError("game", "free", Array.from({ length: 50 }, (_, i) => game(`2026-09-${String((i % 20) + 1).padStart(2, "0")}T10:00:00`)), now) === "", "games: no limit on Free");

// The publish functions, with a faked Base44 and KV.
const store = new Map();
const kv = {
  // Test accounts have accepted the user agreement (its own tests: test-terms.mjs).
  get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : k.startsWith("terms:") ? { version: "2026-10-07-api" } : null),
  getWithMetadata: async (k) => ({ value: store.get(k) ?? null, metadata: store.has(k + "#meta") ? JSON.parse(store.get(k + "#meta")) : null }),
  put: async (k, v, o) => {
    store.set(k, String(v));
    if (o && o.metadata) store.set(k + "#meta", JSON.stringify(o.metadata));
  },
  delete: async (k) => store.delete(k),
  list: async () => ({ keys: [] }),
};
let me = { id: "kid1", email: "kid@example.com", role: "user", full_name: "Kid", created_date: "2025-01-01T00:00:00" };
const rows = { PublishedSite: [{ id: "r1", name: "first", created_by_id: "kid1", created_date: "2026-01-01T00:00:00" }], PublishedGame: [] };
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = u.pathname.match(/\/entities\/(\w+)(?:\/([\w-]+))?$/);
  if (u.pathname.endsWith("/entities/User/me")) return new Response(JSON.stringify(me));
  if (m && rows[m[1]]) {
    if (opts.method === "POST") {
      const rec = { id: "new" + rows[m[1]].length, created_by_id: me.id, created_date: now.toISOString(), ...JSON.parse(opts.body) };
      rows[m[1]].push(rec);
      return new Response(JSON.stringify(rec));
    }
    if (opts.method === "PUT") return new Response(JSON.stringify({ id: m[2] }));
    const q = JSON.parse(u.searchParams.get("q") || "{}");
    return new Response(JSON.stringify(rows[m[1]].filter((r) => Object.entries(q).every(([k, v]) => r[k] === v))));
  }
  if (u.pathname.includes("/entities/")) return new Response("[]");
  return new Response("{}");
};
store.set("site:first", "<!DOCTYPE html><html><body>first</body></html>");
store.set("site:first#meta", JSON.stringify({ owner: "kid1" }));
const publishSite = (await import(R("functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/publish-site.js"))).onRequestPost;
const publishGame = (await import(R("functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/publish-game.js"))).onRequestPost;
const call = async (fn, body) => {
  const request = new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) });
  const res = await fn({ request, env: { PUBLISHED_HTML: kv } });
  return { status: res.status, data: await res.json() };
};
const html = "<!DOCTYPE html><html><body><h1>My page</h1></body></html>";

let r = await call(publishSite, { name: "second", html });
assert(r.status === 200 && store.has("site:second"), "Free can publish a second website (up to 3)");
r = await call(publishSite, { name: "first", html });
assert(r.status === 200 && r.data.republished, "republishing its own website still works");
store.set("grant:kid1", JSON.stringify({ plan: "pro" }));
r = await call(publishSite, { name: "second", html });
assert(r.status === 200 && store.has("site:second"), "on Pro, a second website is fine");
store.delete("grant:kid1");

r = await call(publishGame, { name: "game-one", html, title: "One", plays: 999999 });
assert(r.status === 200, "a Free account's first game this month publishes");
assert(!("plays" in (rows.PublishedGame[0] || {})), "and a play count sent with it is ignored");
r = await call(publishGame, { name: "game-two", html, title: "Two" });
assert(r.status === 200, "a second new game this month publishes too (no game limit)");

me = { ...me, role: "admin" };
r = await call(publishSite, { name: "third", html });
assert(r.status === 200, "admins aren't limited");
