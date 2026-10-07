// The launch waitlist: while nebuluxai.com is down for maintenance, the down page asks for an
// email address (workers/nebulux-site-router), so people can be told when it opens. Listed in
// Monitor → Waitlist (functions/.../waitlist.js), where the owner can download it.
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, joined_at TEXT)").run();
  ready = true;
}

export const cleanEmail = (v) => {
  const e = String(v || "").trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : "";
};

// -> true when it was added (or already there)
export async function joinWaitlist(db, email) {
  const e = cleanEmail(email);
  if (!db || !e) return false;
  await ensure(db);
  await db.prepare("INSERT OR IGNORE INTO waitlist (email, joined_at) VALUES (?, ?)").bind(e, new Date().toISOString()).run();
  return true;
}

export async function listWaitlist(db) {
  await ensure(db);
  const r = await db.prepare("SELECT email, joined_at FROM waitlist ORDER BY joined_at DESC LIMIT 5000").all();
  return r.results || [];
}

export async function removeFromWaitlist(db, email) {
  await ensure(db);
  await db.prepare("DELETE FROM waitlist WHERE email = ?").bind(String(email || "").toLowerCase()).run();
}
