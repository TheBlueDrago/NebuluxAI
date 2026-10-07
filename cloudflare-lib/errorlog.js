// Error reports (Monitor → Errors): crashes in people's browsers (src/lib/errorReport.js, via the
// client-error function), in the site's server code (functions/_middleware.js) and in the site
// router (workers/nebulux-site-router). The same error is kept once, with a count and when it
// was first and last seen, so a crash hitting everyone is one row, not thousands. Only the newest
// 300 are kept. Never stores what people typed: just the error message, where it happened, the
// browser, and the signed-in account's id if any.
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS error_log (sig TEXT PRIMARY KEY, kind TEXT, message TEXT, stack TEXT, path TEXT, ua TEXT, user_id TEXT, count INTEGER DEFAULT 1, first_at TEXT, last_at TEXT)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS error_log_last ON error_log (last_at)").run();
  ready = true;
}

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
// Numbers and long ids change between visits; without them the same bug matches itself.
const shape = (s) => clip(s, 300).replace(/[0-9a-f]{8,}/gi, "#").replace(/\d+/g, "0");

async function sigOf(kind, message, stack, path) {
  const firstLine = String(stack || "").split("\n").find((l) => /at |@/.test(l)) || "";
  const text = [kind, shape(message), shape(firstLine), kind === "client" ? "" : shape(path)].join("|");
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function logError(db, { kind = "client", message, stack, path, ua, userId } = {}) {
  if (!db || !message) return;
  await ensure(db);
  const now = new Date().toISOString();
  const sig = await sigOf(kind, message, stack, path);
  await db
    .prepare("INSERT INTO error_log (sig, kind, message, stack, path, ua, user_id, count, first_at, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(sig) DO UPDATE SET count = count + 1, last_at = excluded.last_at, path = excluded.path, ua = excluded.ua, user_id = COALESCE(excluded.user_id, user_id)")
    .bind(sig, clip(kind, 20), clip(message, 500), clip(stack, 2000), clip(path, 300), clip(ua, 200), userId || null, now, now)
    .run();
  // Keep the newest 300.
  await db.prepare("DELETE FROM error_log WHERE sig IN (SELECT sig FROM error_log ORDER BY last_at DESC LIMIT -1 OFFSET 300)").run();
}

export async function listErrors(db, n = 100) {
  await ensure(db);
  const r = await db.prepare("SELECT * FROM error_log ORDER BY last_at DESC LIMIT ?").bind(n).all();
  return r.results || [];
}

export async function clearErrors(db, sig) {
  await ensure(db);
  if (sig) await db.prepare("DELETE FROM error_log WHERE sig = ?").bind(String(sig)).run();
  else await db.prepare("DELETE FROM error_log").run();
}
