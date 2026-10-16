// The KV wrapper that keeps busy records in D1 (cloudflare-lib/hybridkv.js).
import { hybridKV } from "../cloudflare-lib/hybridkv.js";
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok " : "FAIL ") + m); if (!c) fails++; };

const fakeKV = (init = {}) => {
  const m = new Map(Object.entries(init)); let writes = 0;
  return { m, get writes() { return writes; },
    async get(k, t) { const v = m.has(k) ? m.get(k) : null; return v != null && (t === "json" || t?.type === "json") ? JSON.parse(v) : v; },
    async put(k, v) { writes++; m.set(k, String(v)); }, async delete(k) { writes++; m.delete(k); },
    async list({ prefix = "" } = {}) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }; } };
};
const fakeD1 = () => {
  const t = new Map();
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async run() { if (/^INSERT/.test(sql)) t.set(args[0], args[1]); if (/^DELETE/.test(sql)) t.delete(args[0]); return {}; },
    async first() { return t.has(args[0]) ? { value: t.get(args[0]) } : null; },
    async all() { return { results: [...t.keys()].filter((k) => k >= args[0] && k < args[1]).map((key) => ({ key })) }; },
  });
  return { t, prepare: (sql) => stmt(sql) };
};

const kv = fakeKV({ "usage:u1:2026-10": '{"ai":5}', "grant:u1": '{"plan":"pro"}', "gamesave:u1:old": '{"a":"1"}' });
const db = fakeD1();
const h = hybridKV(kv, db);
ok((await h.get("usage:u1:2026-10", "json")).ai === 5, "an old usage record is still read from KV");
await h.put("usage:u1:2026-10", JSON.stringify({ ai: 6 }));
ok(kv.writes === 0, "writing usage doesn't use a KV write");
ok((await h.get("usage:u1:2026-10", "json")).ai === 6, "and the new value is read back from D1");
ok((await h.get("grant:u1", "json")).plan === "pro", "other keys still come from KV");
await h.put("grant:u1", "{}");
ok(kv.writes === 1, "and other keys are still written to KV");
await h.put("gamesave:u1:new", "{}");
const names = (await h.list({ prefix: "gamesave:u1:" })).keys.map((k) => k.name).sort().join();
ok(names === "gamesave:u1:new,gamesave:u1:old", "a listing includes saves in both places");
await h.delete("gamesave:u1:old");
ok((await h.get("gamesave:u1:old")) === null, "a deleted save is gone from both");
ok(hybridKV(h, db) === h, "wrapping twice does nothing");
const broken = { prepare() { throw new Error("D1 down"); } };
ok((await hybridKV(fakeKV({ "bonus:u2": "7" }), broken).get("bonus:u2")) === "7", "if D1 is down, reads fall back to KV");
if (fails) process.exit(1);
