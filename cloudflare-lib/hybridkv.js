// KV's free plan allows only 1,000 writes a day for the whole site, and some records change on
// almost every request: credits used (one write per AI answer), bonus credits, game saves and
// leaderboards. Those keys live in the D1 database instead (100,000 writes a day free), behind
// the same get/put/delete/list calls, so the code that uses them didn't change.
// functions/_middleware.js swaps env.PUBLISHED_HTML for this wrapper.
// Moving over: a key not in D1 yet is read from KV, and the next write puts it in D1, which
// is then what counts. Deleting removes it from both.
export const ROUTED = /^(usage|teamusage|orgusage|bonus|gamesave|board):/;

let ready = null;
function ensure(db) {
  if (!ready) {
    ready = db
      .prepare("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, at INTEGER)")
      .run()
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

const asType = (v, type) => {
  if (v == null) return null;
  const t = typeof type === "object" && type ? type.type : type;
  return t === "json" ? JSON.parse(v) : v;
};

export function hybridKV(kv, db) {
  if (!kv || !db || kv.__hybrid) return kv;
  return {
    __hybrid: true,
    async get(key, type) {
      if (!ROUTED.test(key)) return kv.get(key, type);
      let row;
      try {
        await ensure(db);
        row = await db.prepare("SELECT value FROM kv WHERE key = ?").bind(key).first();
      } catch {
        return kv.get(key, type); // D1 unavailable: KV as before
      }
      return row ? asType(row.value, type) : kv.get(key, type);
    },
    async put(key, value, opts) {
      if (!ROUTED.test(key)) return kv.put(key, value, opts);
      try {
        await ensure(db);
      } catch {
        return kv.put(key, value, opts);
      }
      await db
        .prepare("INSERT INTO kv (key, value, at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at")
        .bind(key, String(value), Date.now())
        .run();
    },
    async delete(key) {
      if (!ROUTED.test(key)) return kv.delete(key);
      await ensure(db);
      await db.prepare("DELETE FROM kv WHERE key = ?").bind(key).run();
      await kv.delete(key);
    },
    // A listing of a moved prefix includes the keys in both places.
    async list(opts = {}) {
      const prefix = String(opts.prefix || "");
      if (!ROUTED.test(prefix)) return kv.list(opts);
      await ensure(db);
      const [old, rows] = await Promise.all([kv.list(opts), db.prepare("SELECT key FROM kv WHERE key >= ? AND key < ? LIMIT 1000").bind(prefix, prefix + "￿").all()]);
      const names = new Set([...(old.keys || []).map((k) => k.name), ...(rows.results || []).map((r) => r.key)]);
      return { keys: [...names].map((name) => ({ name })), list_complete: true };
    },
    getWithMetadata: (...a) => kv.getWithMetadata(...a),
  };
}
