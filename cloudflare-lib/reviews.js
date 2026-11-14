// Star ratings for games, and comments on games and gallery creations (functions/reviews.js). All in D1.
// Anyone can read them; rating, commenting and reporting need a signed-in account. Many players are kids, so
// every comment goes through the same filter as game chat (cloudflare-lib/chatFilter.js): swear words are
// starred out, and links, numbers, accounts and personal details aren't posted at all. A comment reported by
// three different people is hidden until an admin looks at it (Monitor → Reported comments).
import { cleanChat } from "./chatFilter.js";

export const COMMENT_MAX = 300;
export const HIDE_AT = 3;
const KINDS = ["game", "site"];
let ready = false;
export async function ensureReviews(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS ratings (kind TEXT NOT NULL, item TEXT NOT NULL, user_id TEXT NOT NULL, stars INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (kind, item, user_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, item TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT, text TEXT NOT NULL, at INTEGER NOT NULL, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS comments_item ON comments (kind, item, at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS comment_reports (comment_id INTEGER NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (comment_id, user_id))"),
  ]);
  ready = true;
}
// A game's or site's name as used in its address ("neon-drift"), or null.
export const itemOf = (kind, item) => (KINDS.includes(kind) && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(String(item || "")) ? String(item).toLowerCase() : null);
// First name only, so a comment never shows someone's full name.
const shortName = (n) => (String(n || "").replace(/[<>]/g, "").trim().split(/\s+/)[0] || "Player").slice(0, 24);

export async function readReviews(db, kind, item, userId) {
  await ensureReviews(db);
  const r = await db.prepare("SELECT COUNT(*) AS n, AVG(stars) AS avg FROM ratings WHERE kind = ? AND item = ?").bind(kind, item).first();
  const mine = userId ? await db.prepare("SELECT stars FROM ratings WHERE kind = ? AND item = ? AND user_id = ?").bind(kind, item, userId).first() : null;
  const rows = (await db.prepare("SELECT id, user_id, name, text, at FROM comments WHERE kind = ? AND item = ? AND hidden = 0 ORDER BY at DESC LIMIT 50").bind(kind, item).all()).results || [];
  return {
    count: (r && r.n) || 0,
    avg: r && r.n ? Math.round(r.avg * 10) / 10 : 0,
    mine: (mine && mine.stars) || 0,
    comments: rows.map((c) => ({ id: c.id, name: c.name || "Player", text: c.text, at: c.at, mine: !!userId && c.user_id === userId })),
  };
}
export async function rate(db, kind, item, userId, stars, now = Date.now()) {
  await ensureReviews(db);
  const s = Math.round(Number(stars));
  if (!(s >= 1 && s <= 5)) return { error: "Choose 1 to 5 stars." };
  await db.prepare("INSERT INTO ratings (kind, item, user_id, stars, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (kind, item, user_id) DO UPDATE SET stars = excluded.stars, at = excluded.at").bind(kind, item, userId, s, now).run();
  return { ok: true };
}
export async function addComment(db, kind, item, user, raw, now = Date.now()) {
  await ensureReviews(db);
  const c = cleanChat(raw, COMMENT_MAX);
  if (!c.ok) return { error: c.why ? c.why.replace("in chat", "in comments").replace("Keep chat friendly.", "Keep comments friendly.") : "Write a comment first." };
  if (c.text.length < 2) return { error: "Write a little more." };
  const same = await db.prepare("SELECT id FROM comments WHERE kind = ? AND item = ? AND user_id = ? AND text = ?").bind(kind, item, user.id, c.text).first();
  if (same) return { error: "You already posted that." };
  await db.prepare("INSERT INTO comments (kind, item, user_id, name, text, at) VALUES (?, ?, ?, ?, ?, ?)").bind(kind, item, user.id, shortName(user.full_name || user.name), c.text, now).run();
  return { ok: true };
}
// One report per person per comment; the third hides it until an admin decides.
export async function reportComment(db, id, userId, now = Date.now()) {
  await ensureReviews(db);
  const c = await db.prepare("SELECT id, user_id FROM comments WHERE id = ?").bind(Number(id) || 0).first();
  if (!c) return { error: "That comment is gone." };
  if (c.user_id === userId) return { error: "That's your own comment. You can delete it." };
  const r = await db.prepare("INSERT OR IGNORE INTO comment_reports (comment_id, user_id, at) VALUES (?, ?, ?)").bind(c.id, userId, now).run();
  if (r && r.meta && r.meta.changes === 0) return { ok: true, already: true };
  await db.prepare("UPDATE comments SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?").bind(HIDE_AT, c.id).run();
  return { ok: true };
}
// Your own comment, or any comment for an admin.
export async function deleteComment(db, id, user) {
  await ensureReviews(db);
  const c = await db.prepare("SELECT id, user_id FROM comments WHERE id = ?").bind(Number(id) || 0).first();
  if (!c) return { ok: true };
  if (c.user_id !== user.id && user.role !== "admin") return { error: "You can only delete your own comments." };
  await db.batch([db.prepare("DELETE FROM comments WHERE id = ?").bind(c.id), db.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(c.id)]);
  return { ok: true };
}
// Admins: every reported comment, most reported first; and "it's fine" (clears its reports and shows it again).
export async function reportedComments(db) {
  await ensureReviews(db);
  return (await db.prepare("SELECT id, kind, item, user_id, name, text, at, reports, hidden FROM comments WHERE reports > 0 ORDER BY reports DESC, at DESC LIMIT 100").all()).results || [];
}
export async function keepComment(db, id) {
  await ensureReviews(db);
  await db.batch([db.prepare("UPDATE comments SET reports = 0, hidden = 0 WHERE id = ?").bind(Number(id) || 0), db.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(Number(id) || 0)]);
}
// When an account is deleted, its ratings, comments and reports go too.
export async function forgetReviewer(db, userId) {
  await ensureReviews(db);
  await db.batch([
    db.prepare("DELETE FROM comment_reports WHERE comment_id IN (SELECT id FROM comments WHERE user_id = ?)").bind(userId),
    db.prepare("DELETE FROM comments WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM ratings WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM comment_reports WHERE user_id = ?").bind(userId),
  ]);
}
