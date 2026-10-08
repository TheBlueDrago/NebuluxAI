// Shared chats (nebuluxai.com/share/<id>): a copy of a chat, made when its owner presses Share.
// Only signed-in people can open one. A Nebulux Code chat only opens for Pro and up (the same
// plans as Nebulux Code itself): anyone else gets the upgrade popup and never receives the chat.
//
// (The 30 Nebula credit reward for sharing was removed on 2026-10-08 with referrals.)
export const CODE_PLANS = ["pro", "team", "enterprise", "max", "secret"];
export const REWARD_WINDOW_MS = 5 * 60 * 1000;
export const REWARD = { space5: 30 }; // space5 = Nebula credits (planTotals.js TIER_NAMES)
export const MAX_MESSAGES = 80;
export const MAX_CHARS = 300000;

let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS chat_shares (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_name TEXT, kind TEXT, title TEXT, messages TEXT, created_at TEXT)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS chat_shares_owner ON chat_shares (owner_id, created_at)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS share_views (share_id TEXT NOT NULL, viewer_id TEXT NOT NULL, first_at INTEGER, first_plan TEXT, rewarded INTEGER DEFAULT 0, PRIMARY KEY (share_id, viewer_id))").run();
  ready = true;
}
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

// Keeps only { role, content } text, newest messages last, within the size limits.
export function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  let total = 0;
  for (const m of messages.slice(-MAX_MESSAGES).reverse()) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    const role = m.role === "user" ? "user" : "assistant";
    const content = m.content.slice(0, 40000);
    if (total + content.length > MAX_CHARS) break;
    total += content.length;
    out.push({ role, content });
  }
  return out.reverse();
}

export async function createShare(db, user, { kind, title, messages }) {
  await ensure(db);
  const msgs = cleanMessages(messages);
  if (!msgs.length) return { error: "There's nothing in this chat to share yet." };
  const id = hex(12);
  await db
    .prepare("INSERT INTO chat_shares (id, owner_id, owner_name, kind, title, messages, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, user.id, String(user.full_name || "").split(" ")[0].slice(0, 40) || "A friend", kind === "code" ? "code" : "chat", String(title || "Shared chat").slice(0, 120), JSON.stringify(msgs), new Date().toISOString())
    .run();
  return { id };
}

// -> { share } | { locked, ... } | { missing: true }; rewards the sharer when it's earned.
// giveReward(ownerId, amounts, once) is credits.js giveBonusTo, passed in so this stays testable.
export async function viewShare(db, viewer, plan, id, giveReward, now = Date.now()) {
  await ensure(db);
  const s = await db.prepare("SELECT * FROM chat_shares WHERE id = ?").bind(String(id || "")).first();
  if (!s) return { missing: true };
  const own = s.owner_id === viewer.id;
  const pro = CODE_PLANS.includes(plan);
  let view = null;
  if (!own) {
    await db.prepare("INSERT OR IGNORE INTO share_views (share_id, viewer_id, first_at, first_plan) VALUES (?, ?, ?, ?)").bind(s.id, viewer.id, now, plan || "free").run();
    view = await db.prepare("SELECT * FROM share_views WHERE share_id = ? AND viewer_id = ?").bind(s.id, viewer.id).first();
  }
  const head = { id: s.id, kind: s.kind, title: s.title, owner_name: s.owner_name, created_at: s.created_at };
  if (s.kind === "code" && !own && !pro) {
    return { locked: true, ...head, reward_ends_at: view ? Number(view.first_at) + REWARD_WINDOW_MS : null };
  }
  // No sharer reward any more (owner, 2026-10-08: no referral-style free credits).
  const rewarded = false;
  return { share: { ...head, messages: JSON.parse(s.messages || "[]") }, own, rewarded };
}

export async function myShares(db, userId) {
  await ensure(db);
  const r = await db.prepare("SELECT id, kind, title, created_at FROM chat_shares WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all();
  return r.results || [];
}

export async function deleteShare(db, userId, id) {
  await ensure(db);
  await db.prepare("DELETE FROM chat_shares WHERE id = ? AND owner_id = ?").bind(String(id || ""), userId).run();
}
