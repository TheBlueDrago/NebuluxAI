// Nebulux Games' social side: your avatar (worn in every game) and friends (see what they're
// playing and join them). All in D1 (env.DB), never KV, since people change these often.
// { action: "avatar" }                        -> { avatar }            (yours, or the default)
// { action: "setAvatar", avatar }             -> { avatar }
// { action: "friends" }                       -> { code, friends: [{ id, name, avatar, playing, at }], incoming: [...], outgoing: [...] }
// { action: "add", who }                      -> { ok } | { error }    (a friend code, or an exact username)
// { action: "accept" | "remove", id }         -> { ok }
// { action: "playing", game }                 -> { ok }                (the game you're in; "" when you leave)
// { action: "playingCounts" }                  -> { counts: { game: n } } (no sign-in needed)
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

export const DEFAULT_AVATAR = { skin: "#f5c99a", shirt: "#d62828", pants: "#2a4a8a", hat: "straw", hatColor: "#f2c94c", face: "smile", design: "plain", legs: "pants", back: "none", trail: "none", walk: "normal" };
const HATS = ["none", "straw", "tricorn", "bandana", "helmet", "cap", "crown", "tophat", "viking", "wizard", "headphones", "halo"];
const FACES = ["smile", "grin", "cool", "angry", "wink"];
const DESIGNS = ["plain", "stripes", "star", "flame", "galaxy"]; // shirt designs
const LEGS = ["pants", "shorts"];
const BACKS = ["none", "backpack", "cape", "wings", "jetpack"]; // back bling
const TRAILS = ["none", "rainbow", "stars", "bubbles"];
const WALKS = ["normal", "robot", "zombie", "ninja", "levitate"]; // walking styles // little buddies that follow you (just for looks)
// The avatar shop. Prices are in Stardust, a free currency earned by playing (never bought with
// money). Items not listed here (the basics) are free. Prices live here, on the server.
export const SHOP = {
  "hat:tricorn": 50, "hat:helmet": 50, "hat:tophat": 120, "hat:headphones": 150, "hat:viking": 200, "hat:wizard": 250, "hat:crown": 300, "hat:halo": 400,
  "face:angry": 40, "face:wink": 60, "face:cool": 80,
  "design:stripes": 40, "design:star": 80, "design:flame": 150, "design:galaxy": 300,
  "back:backpack": 80, "back:cape": 150, "back:jetpack": 250, "back:wings": 400,
  "walk:robot": 150, "walk:zombie": 150, "walk:ninja": 250, "walk:levitate": 450,
  "trail:bubbles": 120, "trail:stars": 250, "trail:rainbow": 500,
};
// Games that may spend a player's Stardust (always after the player confirms in the app):
// only Nebulux's own games, never ones people publish.
export const SPEND_GAMES = ["fruit-seas", "sky-obby", "bed-brawl", "brawl-blitz", "storm-royale"];
const START_NEBUX = 100, DAILY_NEBUX = 25, PLAY_NEBUX = 2, PLAY_CAP = 60; // per ping (every 2 min in a game), per day
const COLOR = /^#[0-9a-f]{6}$/i;
const ONLINE_MS = 3 * 60000; // "playing" counts for 3 minutes after the last update

export function cleanAvatar(a) {
  const o = { ...DEFAULT_AVATAR };
  if (!a || typeof a !== "object") return o;
  for (const k of ["skin", "shirt", "pants", "hatColor"]) if (COLOR.test(String(a[k] || ""))) o[k] = String(a[k]).toLowerCase();
  if (HATS.includes(a.hat)) o.hat = a.hat;
  if (FACES.includes(a.face)) o.face = a.face;
  if (DESIGNS.includes(a.design)) o.design = a.design;
  if (LEGS.includes(a.legs)) o.legs = a.legs;
  if (BACKS.includes(a.back)) o.back = a.back;
  if (TRAILS.includes(a.trail)) o.trail = a.trail;
  if (WALKS.includes(a.walk)) o.walk = a.walk;
  return o;
}
// A short code to share instead of an email: the END of the account id (ids start with a
// timestamp, so the start is the same for everyone who signed up around the same time).
export const friendCode = (id) => String(id).replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();

let ready = null;
function ensure(db) {
  if (!ready) {
    ready = db
      .batch([
        db.prepare("CREATE TABLE IF NOT EXISTS avatars (user_id TEXT PRIMARY KEY, data TEXT NOT NULL)"),
        db.prepare("CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, at INTEGER, PRIMARY KEY (a, b))"),
        db.prepare("CREATE TABLE IF NOT EXISTS presence (user_id TEXT PRIMARY KEY, game TEXT, at INTEGER)"),
        db.prepare("CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, nebux INTEGER NOT NULL, owned TEXT NOT NULL, daily TEXT, play_day TEXT, play_earned INTEGER)"),
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

const today = () => new Date().toISOString().slice(0, 10);
async function wallet(db, id) {
  let w = await db.prepare("SELECT * FROM wallets WHERE user_id = ?").bind(id).first();
  if (!w) {
    await db.prepare("INSERT OR IGNORE INTO wallets (user_id, nebux, owned, daily, play_day, play_earned) VALUES (?, ?, '[]', '', '', 0)").bind(id, START_NEBUX).run();
    w = await db.prepare("SELECT * FROM wallets WHERE user_id = ?").bind(id).first();
  }
  return { nebux: w.nebux, owned: JSON.parse(w.owned || "[]"), daily: w.daily, playDay: w.play_day, playEarned: w.play_earned || 0 };
}
const owns = (w, item) => !(item in SHOP) || w.owned.includes(item);

export async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;
    if (!db) return json({ error: "Not available right now." }, 503);
    const body = await request.json().catch(() => ({}));
    // How many people are in each game right now (anyone can ask; no names).
    if (body.action === "playingCounts") {
      await ensure(db);
      const r = await db.prepare("SELECT game, COUNT(*) AS n FROM presence WHERE game != '' AND at > ? GROUP BY game").bind(Date.now() - ONLINE_MS).all();
      const counts = {};
      for (const x of r.results || []) counts[x.game] = x.n;
      return json({ counts });
    }
    const user = await currentUser(request);
    if (!user) return json({ error: "Sign in to use friends and avatars." }, 401);
    await ensure(db);
    const me = user.id;

    if (body.action === "avatar") {
      const r = await db.prepare("SELECT data FROM avatars WHERE user_id = ?").bind(me).first();
      return json({ avatar: cleanAvatar(r ? JSON.parse(r.data) : null) });
    }
    if (body.action === "setAvatar") {
      if (!(await allow(`avatar:${me}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
      const avatar = cleanAvatar(body.avatar);
      const w = await wallet(db, me);
      if (!["hat:" + avatar.hat, "face:" + avatar.face, "design:" + avatar.design, "back:" + avatar.back, "trail:" + avatar.trail, "walk:" + avatar.walk].every((i) => owns(w, i))) return json({ error: "Buy that item in the Shop first." }, 403);
      await db.prepare("INSERT INTO avatars (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data").bind(me, JSON.stringify(avatar)).run();
      return json({ avatar });
    }
    if (body.action === "playing") {
      if (!(await allow(`playing:${me}`, 30, 3600))) return json({ ok: true });
      const game = String(body.game || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
      await db.prepare("INSERT INTO presence (user_id, game, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET game = excluded.game, at = excluded.at").bind(me, game, Date.now()).run();
      // Playing earns a little Stardust (PLAY_NEBUX a ping, up to PLAY_CAP a day).
      if (game) {
        const w = await wallet(db, me), d = today(), earned = w.playDay === d ? w.playEarned : 0;
        if (earned < PLAY_CAP) await db.prepare("UPDATE wallets SET nebux = nebux + ?, play_day = ?, play_earned = ? WHERE user_id = ?").bind(PLAY_NEBUX, d, earned + PLAY_NEBUX, me).run();
      }
      return json({ ok: true });
    }
    if (body.action === "shop") {
      const w = await wallet(db, me);
      return json({ nebux: w.nebux, owned: w.owned, prices: SHOP, dailyReady: w.daily !== today(), dailyAmount: DAILY_NEBUX, playLeft: Math.max(0, PLAY_CAP - (w.playDay === today() ? w.playEarned : 0)) });
    }
    if (body.action === "daily") {
      const w = await wallet(db, me);
      if (w.daily === today()) return json({ error: "Come back tomorrow for more Stardust." }, 400);
      await db.prepare("UPDATE wallets SET nebux = nebux + ?, daily = ? WHERE user_id = ? AND (daily IS NULL OR daily != ?)").bind(DAILY_NEBUX, today(), me, today()).run();
      return json({ ok: true, nebux: w.nebux + DAILY_NEBUX });
    }
    if (body.action === "buy") {
      if (!(await allow(`buy:${me}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
      const item = String(body.item || "");
      if (!(item in SHOP)) return json({ error: "That item isn't in the shop." }, 400);
      const w = await wallet(db, me);
      if (w.owned.includes(item)) return json({ ok: true, nebux: w.nebux, owned: w.owned });
      if (w.nebux < SHOP[item]) return json({ error: `You need ${SHOP[item] - w.nebux} more Stardust. Play games or claim your daily Stardust.` }, 400);
      const owned = [...w.owned, item];
      // Only takes the Stardust if the balance is still enough (two buys at once can't overspend).
      const r = await db.prepare("UPDATE wallets SET nebux = nebux - ?, owned = ? WHERE user_id = ? AND nebux >= ?").bind(SHOP[item], JSON.stringify(owned), me, SHOP[item]).run();
      if (!r.meta || !r.meta.changes) return json({ error: "Not enough Stardust." }, 400);
      return json({ ok: true, nebux: w.nebux - SHOP[item], owned });
    }
    // A Nebulux game spends Stardust on something in the game (the app asks the player first).
    if (body.action === "spend") {
      if (!(await allow(`spend:${me}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
      const game = String(body.game || ""), price = Math.floor(Number(body.price));
      if (!SPEND_GAMES.includes(game)) return json({ error: "This game can't use Stardust." }, 403);
      if (!(price >= 1 && price <= 5000)) return json({ error: "That price doesn't look right." }, 400);
      const r = await db.prepare("UPDATE wallets SET nebux = nebux - ? WHERE user_id = ? AND nebux >= ?").bind(price, me, price).run();
      if (!r.meta || !r.meta.changes) return json({ error: "Not enough Stardust.", stardust: (await wallet(db, me)).nebux }, 400);
      return json({ ok: true, stardust: (await wallet(db, me)).nebux });
    }
    if (body.action === "add") {
      if (!(await allow(`friend-add:${me}`, 20, 3600))) return json({ error: TOO_MANY }, 429);
      const who = String(body.who || "").trim().slice(0, 80);
      if (!who) return json({ error: "Type a friend code or a username." }, 400);
      // A friend code (the end of their account id), or an exact username used by only one person.
      let rows = (await db.prepare("SELECT id FROM rows WHERE entity = 'User' AND upper(substr(replace(id, '-', ''), -8)) = ? LIMIT 2").bind(who.toUpperCase()).all()).results || [];
      if (rows.length > 1) return json({ error: "That friend code matches more than one person. Try their username." }, 409);
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
