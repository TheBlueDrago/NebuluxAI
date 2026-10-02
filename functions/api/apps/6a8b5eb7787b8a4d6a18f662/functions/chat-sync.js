// Chats saved with the account (src/lib/chatSync.js), so they show on every device the person
// signs in on. One row per chat in D1 (table `chats`, made here on first use); each chat carries
// the time it last changed, and the newer copy wins. Deleting a chat leaves a marker so it's
// deleted on the other devices too.
// { action: "load" }                                   -> { chats: [chat], deleted: [{ id, updated }] }
// { action: "save", changes: [{ id, updated, deleted?, chat? }] }   -> { ok, saved }
// { action: "clear" }                                  -> { ok }   (account deletion)
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

export const MAX_CHAT_BYTES = 400 * 1024;
export const MAX_CHATS = 300;
const MAX_CHANGES = 50;

export async function ensureTable(db) {
  await db
    .prepare("CREATE TABLE IF NOT EXISTS chats (user_id TEXT NOT NULL, id TEXT NOT NULL, updated INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT, PRIMARY KEY (user_id, id))")
    .run();
}

// A chat as it's stored: title, time and messages, with anything too big (attached pictures)
// left out so one chat can't fill the storage.
export function storable(chat) {
  if (!chat || typeof chat !== "object") return null;
  const out = { id: String(chat.id || "").slice(0, 100), title: String(chat.title || "Chat").slice(0, 200), created_date: chat.created_date || Date.now(), messages: Array.isArray(chat.messages) ? chat.messages : [] };
  let s = JSON.stringify(out);
  if (s.length > MAX_CHAT_BYTES) {
    out.messages = out.messages.map((m) => {
      const { images, image, attachments, files, ...rest } = m || {};
      return images || image || attachments || files ? { ...rest, note: "(a picture was attached here; it isn't kept with your account)" } : rest;
    });
    s = JSON.stringify(out);
  }
  while (s.length > MAX_CHAT_BYTES && out.messages.length > 1) {
    out.messages = out.messages.slice(Math.ceil(out.messages.length / 4));
    s = JSON.stringify(out);
  }
  return s.length > MAX_CHAT_BYTES ? null : out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const db = env.DB;
    if (!db) return json({ error: "Chat saving isn't switched on." }, 503);
    await ensureTable(db);
    const body = await request.json().catch(() => ({}));

    if (body.action === "load") {
      const rows = (await db.prepare("SELECT id, updated, deleted, data FROM chats WHERE user_id = ? ORDER BY updated DESC").bind(user.id).all()).results || [];
      const chats = [];
      const deleted = [];
      for (const r of rows) {
        if (r.deleted) deleted.push({ id: r.id, updated: r.updated });
        else {
          try {
            chats.push({ ...JSON.parse(r.data), updated: r.updated });
          } catch {}
        }
      }
      return json({ chats, deleted });
    }

    if (body.action === "save") {
      if (!(await allow(`chatsync:${user.id}`, 240, 3600))) return json({ error: TOO_MANY }, 429);
      const changes = (Array.isArray(body.changes) ? body.changes : []).slice(0, MAX_CHANGES);
      let saved = 0;
      for (const c of changes) {
        const id = String((c && c.id) || "").slice(0, 100);
        const updated = Math.floor(Number(c && c.updated) || 0);
        if (!id || !updated || updated > Date.now() + 60000) continue;
        const prev = await db.prepare("SELECT updated FROM chats WHERE user_id = ? AND id = ?").bind(user.id, id).first();
        if (prev && prev.updated >= updated) continue; // the copy here is as new or newer
        if (c.deleted) {
          await db.prepare("INSERT OR REPLACE INTO chats (user_id, id, updated, deleted, data) VALUES (?, ?, ?, 1, NULL)").bind(user.id, id, updated).run();
        } else {
          const chat = storable({ ...c.chat, id });
          if (!chat) continue;
          if (!prev) {
            const n = await db.prepare("SELECT COUNT(*) AS n FROM chats WHERE user_id = ? AND deleted = 0").bind(user.id).first();
            if (n && n.n >= MAX_CHATS) {
              // Full: the oldest chat makes room (it stays on the devices that have it).
              await db.prepare("DELETE FROM chats WHERE user_id = ? AND id = (SELECT id FROM chats WHERE user_id = ? AND deleted = 0 ORDER BY updated ASC LIMIT 1)").bind(user.id, user.id).run();
            }
          }
          await db.prepare("INSERT OR REPLACE INTO chats (user_id, id, updated, deleted, data) VALUES (?, ?, ?, 0, ?)").bind(user.id, id, updated, JSON.stringify(chat)).run();
        }
        saved++;
      }
      return json({ ok: true, saved });
    }

    if (body.action === "clear") {
      await db.prepare("DELETE FROM chats WHERE user_id = ?").bind(user.id).run();
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
