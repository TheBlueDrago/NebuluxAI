// How the free AI is holding up, per day (D1 table ai_daily): replies that worked, ones that hit
// "busy" (Google's free tier overloaded or rate-limited) and other failures, plus which model
// answered. Shown to admins in Monitor (functions/.../ai-health.js) so it's clear when the free
// limits are being reached. One small write per reply (D1's free tier allows 100,000 a day).
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS ai_daily (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY (day, kind))").run();
  ready = true;
}
const today = () => new Date().toISOString().slice(0, 10);

export async function countAi(db, kind) {
  if (!db) return;
  try {
    await ensure(db);
    await db.prepare("INSERT INTO ai_daily (day, kind, n) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET n = n + 1").bind(today(), String(kind).slice(0, 40)).run();
  } catch {
    // Never let counting break a reply.
  }
}

export async function aiDays(db, days = 14) {
  await ensure(db);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const r = await db.prepare("SELECT day, kind, n FROM ai_daily WHERE day >= ? ORDER BY day").bind(since).all();
  return r.results || [];
}
