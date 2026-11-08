// Offline test of the public API's streaming and fast modes (functions/v1/chat.js, cloudflare-lib/apirun.js), which is
// how Nebulux Orbit gets its answers. In-memory SQLite stands in for D1; Google is faked. Run: node scripts/test-api-stream.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { onRequestPost as chat } from "../functions/v1/chat.js";
import { createKey } from "../cloudflare-lib/apikeys.js";
import { account, addFunds, agree, setUseApi } from "../cloudflare-lib/apibilling.js";
import { useOwnDb } from "../cloudflare-lib/published.js";
import { TERMS_VERSION } from "../cloudflare-lib/terms.js";

let failed = 0;
const assert = (c, m) => { console.log((c ? "ok " : "FAIL ") + m); if (!c) failed++; };
function d1() {
  const sql = new DatabaseSync(":memory:");
  const stmt = (q, args = []) => ({
    bind: (...a) => stmt(q, a),
    first: async (col) => { const r = sql.prepare(q).get(...args); return r === undefined ? null : col ? r[col] : { ...r }; },
    all: async () => ({ results: sql.prepare(q).all(...args).map((r) => ({ ...r })) }),
    run: async () => (/^\s*(select|pragma)/i.test(q) ? { results: sql.prepare(q).all(...args) } : { meta: { changes: sql.prepare(q).run(...args).changes } }),
  });
  return { prepare: (q) => stmt(q), batch: async (list) => { const o = []; for (const s of list) o.push(await s.run()); return o; }, raw: sql };
}
const db = d1();
db.raw.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
useOwnDb(db);
const cache = new Map();
globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
const store = new Map();
const kv = { get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : null), put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k), list: async () => ({ keys: [], list_complete: true }) };
let google = [], aiCalls = 0, googleSays = "ok";
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("generativelanguage.googleapis.com")) {
    google.push({ model: /models\/([^:]+):/.exec(u)[1], body: JSON.parse(init.body) });
    if (googleSays === "busy") return new Response('{"error":{"message":"overloaded"}}', { status: 503 });
    const chunks = ["Hello ", "from ", "Nebula"].map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join("");
    return new Response(chunks, { status: 200 });
  }
  if (u.includes("/entities/User/me")) return new Response(JSON.stringify({ id: "u1", email: "a@b.co", full_name: "Ann", role: "user", is_verified: true, created_date: "2026-01-01T00:00:00Z" }));
  return new Response("[]");
};
const waits = [];
const env = { DB: db, PUBLISHED_HTML: kv, GEMINI_API_KEY: "g-test", SITE_AUTH_KEY: "site-test", AI: { run: async () => { aiCalls++; return new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"response":"backup"}\n\ndata: [DONE]\n\n')); c.close(); } }); } } };
const call = async (key, body) => {
  const res = await chat({ request: new Request("https://nebuluxai.pages.dev/v1/chat", { method: "POST", headers: { authorization: "Bearer " + key, "content-type": "application/json", "cf-connecting-ip": "1.1.1.1" }, body: JSON.stringify(body) }), env, waitUntil: (p) => waits.push(p) });
  const text = await res.text();
  await Promise.all(waits.splice(0));
  return { status: res.status, type: res.headers.get("content-type"), text, lines: text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }) };
};
const bal = async (m) => (await account(db, "u1")).balances[m];

await account(db, "u1");
db.raw.prepare("INSERT INTO rows (entity, id, created_by_id, created_date, updated_date, data) VALUES ('User', 'u1', 'u1', '2026-01-01', '2026-01-01', ?)").run(JSON.stringify({ email: "a@b.co", full_name: "Ann", role: "user", is_verified: true }));
store.set("terms:u1", JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }));
const made = await createKey(db, "u1", "Orbit");
const key = made.key;
await agree(db, "u1");
await addFunds(db, "u1", "nebula", 1000000, "grant", "test");
await addFunds(db, "u1", "galaxy", 1000000, "grant", "test");

let r = await call(key, { model: "nebula", prompt: "hi", stream: true, fast: true, effort: "low" });
const off = r.lines.find((l) => l.error);
assert(off && off.error.type === "billing_off", "with the API switch off it says so");
await setUseApi(db, "u1", true);

google = [];
r = await call(key, { model: "nebula", prompt: "hi", stream: true, fast: true, effort: "low" });
const words = r.lines.filter((l) => l.d).map((l) => l.d).join(""), done = r.lines.find((l) => l.done);
assert(r.status === 200 && /ndjson/.test(r.type), "stream: one JSON object a line");
assert(words === "Hello from Nebula" && r.lines.filter((l) => l.d).length === 3, "the words arrive piece by piece");
assert(done && done.cost_usd === 1 && done.balance_usd === 9, "Nebula costs $1 for a short reply, and the last line says so: " + JSON.stringify(done));
assert((await bal("nebula")) === 900000, "the Nebula balance pays for it");
assert(google.length === 1 && google[0].model === "gemini-3.8-flash", "Nebula's model is asked");
assert(!google[0].body.tools, "fast: no web search");

const b0 = await bal("nebula");
googleSays = "busy"; google = []; aiCalls = 0;
const t0 = Date.now();
r = await call(key, { model: "nebula", prompt: "hi", stream: true, fast: true, effort: "low" });
const took = Date.now() - t0, err = r.lines.find((l) => l.error);
assert(err && !r.lines.some((l) => l.d), "fast and Google is busy: an error line, no words");
assert(took < 1500, "straight away, no waiting between retries (" + took + " ms)");
assert(google.length === 1, "one try, at the asked-for model only");
assert(aiCalls === 0, "this site's own backup is left for Orbit's");
assert((await bal("nebula")) === b0, "and nothing is charged");

googleSays = "ok"; google = [];
r = await call(key, { model: "galaxy", prompt: "hi", stream: true, fast: true, effort: "low" });
assert(r.lines.some((l) => l.done) && google[0].model === "gemini-3.6-flash" && (await bal("galaxy")) === 960000, "Galaxy uses its own model and balance ($0.40)");

r = await call(key, { model: "nebula", prompt: "hi" });
const plain = r.lines[0];
assert(r.status === 200 && plain.content === "Hello from Nebula" && plain.object === "chat.completion", "without stream the API works as before");
r = await call("nx-sk-" + "0".repeat(48), { prompt: "hi", stream: true });
assert(r.status === 401, "a wrong key is refused");

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
