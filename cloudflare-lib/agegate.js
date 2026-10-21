// Nebulux AI is for ages 8 and up (Nebulux Orbit: 13, functions/v1/orbit.js). The birthday is asked
// once after sign-in (it can't be changed) without saying the age, and anyone younger is locked out
// until their 8th birthday.
export const MIN_AGE = 8;
let ready = null;
const ensure = (db) => (ready ||= db.prepare("CREATE TABLE IF NOT EXISTS user_ages (user_id TEXT PRIMARY KEY, birth TEXT NOT NULL, at INTEGER NOT NULL)").run().catch((e) => { ready = null; throw e; }));
export const ageOf = (birth) => {
  const b = new Date(birth + "T00:00:00Z"), n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
};
export async function ageStatus(db, uid) {
  if (!db || !uid) return { needBirth: false, blocked: false };
  await ensure(db);
  const row = await db.prepare("SELECT birth FROM user_ages WHERE user_id = ?").bind(uid).first();
  return { needBirth: !row, blocked: !!row && ageOf(row.birth) < MIN_AGE };
}
export async function setBirth(db, uid, birth) {
  await ensure(db);
  if (await db.prepare("SELECT 1 FROM user_ages WHERE user_id = ?").bind(uid).first()) return { error: "Your birthday is already set." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(new Date(birth)) || ageOf(birth) < 0 || ageOf(birth) > 120) return { error: "Enter your real birthday." };
  await db.prepare("INSERT INTO user_ages (user_id, birth, at) VALUES (?, ?, ?)").bind(uid, birth, Date.now()).run();
  return { ok: true, blocked: ageOf(birth) < MIN_AGE };
}
