// Nebulux Games' social side: your avatar (worn in every game) and friends (see what they're
// playing and join them). All in D1 (env.DB), never KV, since people change these often.
// { action: "avatar" }                        -> { avatar }            (yours, or the default)
// { action: "setAvatar", avatar }             -> { avatar }
// { action: "friends" }                       -> { code, friends: [{ id, name, avatar, playing, at }], incoming: [...], outgoing: [...] }
// { action: "add", who }                      -> { ok } | { error }    (a friend code, or an exact username)
// { action: "accept" | "remove", id }         -> { ok }
// { action: "playing", game }                 -> { ok }                (the game you're in; "" when you leave)
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

export const DEFAULT_AVATAR = { skin: "#f5c99a", shirt: "#d62828", pants: "#2a4a8a", hat: "straw", hatColor: "#f2c94c", face: "smile" };
const HATS = ["none", "straw", "tricorn", "bandana", "helmet", "cap", "crown"];
const FACES = ["smile", "grin", "cool", "angry", "wink"];
const COLOR = /^#[0-9a-f]{6}$/i;
const ONLINE_MS = 3 * 60000; // "playing" counts for 3 minutes after the last update

export function cleanAvatar(a) {
  const o = { ...DEFAULT_AVATAR };
  if (!a || typeof a !== "object") return o;
  for (const k of ["skin", "shirt", "pants", "hatColor"]) if (COLOR.test(String(a[k] || ""))) o[k] = String(a[k]).toLowerCase();
  if (HATS.includes(a.hat)) o.hat = a.hat;
  if (FACES.includes(a.face)) o.face = a.face;
  return o;
}
// A short code to share instead of an email: the start of the account id.
export const friendCode = (id) => String(id).replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();

let ready = null;
function ensure(db) {
  if (!ready) {
    ready = db
      .batch([
        db.prepare("CREATE TABLE IF NOT EXISTS avatars (user_id TEXT PRIMARY KEY, data TEXT NOT NULL)"),
        db.prepare("CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, at INTEGER, PRIMARY KEY (a, b))"),
        db.prepare("CREATE TABLE IF NOT EXISTS presence (user_id TEXT PRIMARY KEY, game TEXT, at INTEGER)"),
      ])
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return ready;
}

const userName = async (db, id) => {
  const r = await db.prepare("SELECT json_extract(data, '$.full_name') AS n FROM rows WHERE entity = 'User' AND id = ?").bind(id).first().catch(() => null);
  return (r && r.n) || "Player";
};

export async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;
    if (!db) return json({ error: "Not available right now." }, 503);
    const user = await currentUser(request);
    if (!user) return json({ error: "Sign in to use friends and avatars." }, 401);
    await ensure(db);
    const body = await request.json().catch(() => ({}));
    const me = user.id;

    if (body.action === "avatar") {
      const r = await db.prepare("SELECT data FROM avatars WHERE user_id = ?").bind(me).first();
      return json({ avatar: cleanAvatar(r ? JSON.parse(r.data) : null) });
    }
    if (body.action === "setAvatar") {
      if (!(await allow(`avatar:${me}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
      const avatar = cleanAvatar(body.avatar);
      await db.prepare("INSERT INTO avatars (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data").bind(me, JSON.stringify(avatar)).run();
      return json({ avatar });
    }
    if (body.action === "playing") {
      if (!(await allow(`playing:${me}`, 30, 3600))) return json({ ok: true });
      const game = String(body.game || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
      await db.prepare("INSERT INTO presence (user_id, game, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET game = excluded.game, at = excluded.at").bind(me, game, Date.now()).run();
      return json({ ok: true });
    }
    if (body.action === "add") {
      if (!(await allow(`friend-add:${me}`, 20, 3600))) return json({ error: TOO_MANY }, 429);
      const who = String(body.who || "").trim().slice(0, 80);
      if (!who) return json({ error: "Type a friend code or a username." }, 400);
      // A friend code (the start of their account id), or an exact username used by only one person.
      let rows = (await db.prepare("SELECT id FROM rows WHERE entity = 'User' AND upper(substr(replace(id, '-', ''), 1, 8)) = ?").bind(who.toUpperCase()).all()).results || [];
      if (!rows.length) rows = (await db.prepare("SELECT id FROM rows WHERE entity = 'User' AND lower(json_extract(data, '$.full_name')) = lower(?) LIMIT 2").bind(who).all()).results || [];
      if (!rows.length) return json({ error: "Nobody found with that friend code or username." }, 404);
      if (rows.length > 1) return json({ error: "More than one person has that username. Ask them for their friend code." }, 409);
      const them = rows[0].id;
      if (them === me) return json({ error: "That's you!" }, 400);
      const back = await db.prepare("SELECT status FROM friends WHERE a = ? AND b = ?").bind(them, me).first();
      if (back) {
        // They already asked you: that makes you friends.
        await db.batch([
          db.prepare("UPDATE friends SET status = 'friends', at = ? WHERE a = ? AND b = ?").bind(Date.now(), them, me),
          db.prepare("INSERT OR REPLACE INTO friends (a, b, status, at) VALUES (?, ?, 'friends', ?)").bind(me, them, Date.now()),
        ]);
        return json({ ok: true, friends: true });
      }
      await db.prepare("INSERT OR IGNORE INTO friends (a, b, status, at) VALUES (?, ?, 'asked', ?)").bind(me, them, Date.now()).run();
      return json({ ok: true, asked: true });
    }
    if (body.action === "accept" || body.action === "remove") {
      const them = String(body.id || "").slice(0, 100);
      if (body.action === "accept") {
        const asked = await db.prepare("SELECT 1 FROM friends WHERE a = ? AND b = ? AND status = 'asked'").bind(them, me).first();
        if (!asked) return json({ error: "No friend request from them." }, 404);
        await db.batch([
          db.prepare("UPDATE friends SET status = 'friends', at = ? WHERE a = ? AND b = ?").bind(Date.now(), them, me),
          db.prepare("INSERT OR REPLACE INTO friends (a, b, status, at) VALUES (?, ?, 'friends', ?)").bind(me, them, Date.now()),
        ]);
      } else {
        await db.prepare("DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(me, them, them, me).run();
      }
      return json({ ok: true });
    }
    if (body.action === "friends") {
      const mine = (await db.prepare("SELECT a, b, status FROM friends WHERE a = ? OR b = ?").bind(me, me).all()).results || [];
      const friendIds = mine.filter((r) => r.a === me && r.status === "friends").map((r) => r.b);
      const incomingIds = mine.filter((r) => r.b === me && r.status === "asked").map((r) => r.a);
      const outgoingIds = mine.filter((r) => r.a === me && r.status === "asked").map((r) => r.b);
      const describe = async (id, full) => {
        const out = { id, name: await userName(db, id) };
        if (full) {
          const av = await db.prepare("SELECT data FROM avatars WHERE user_id = ?").bind(id).first();
          const p = await db.prepare("SELECT game, at FROM presence WHERE user_id = ?").bind(id).first();
          out.avatar = cleanAvatar(av ? JSON.parse(av.data) : null);
          out.playing = p && p.game && Date.now() - p.at < ONLINE_MS ? p.game : "";
          out.online = !!(p && Date.now() - p.at < ONLINE_MS);
        }
        return out;
      };
      return json({
        code: friendCode(me),
        friends: await Promise.all(friendIds.slice(0, 200).map((id) => describe(id, true))),
        incoming: await Promise.all(incomingIds.slice(0, 50).map((id) => describe(id))),
        outgoing: await Promise.all(outgoingIds.slice(0, 50).map((id) => describe(id))),
      });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
