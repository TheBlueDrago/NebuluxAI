// nebulux-chat: the server behind Nebulux Chat (the Discord-style chat in the app). Free Cloudflare
// parts only: D1 (the DB binding) keeps profiles, channels, messages, friends and notifications,
// and one Durable Object (Hub) holds everyone's live connection, so new messages, typing and
// notifications arrive instantly. People are recognised by their Nebulux AI (Base44) sign-in.
import { cleanMessage, cleanName } from "./safety.js";
import { SHOP, FREE_COLORS, AVATAR_EMOJI, AVATAR_BG, PLUS_FREE, STAR_MULTIPLIER } from "./shop.js";
import { QUESTS, questDone } from "./quests.js";

const APP_ID = "6a8b5eb7787b8a4d6a18f662";
const BASE44 = "https://blackhole-ai.base44.app";
const ORIGINS = ["https://nebuluxai.com", "https://www.nebuluxai.com", "https://blackhole-ai-tech.com", "https://www.blackhole-ai-tech.com"];
const PAGE = 50;

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

function cors(request) {
  const o = request.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    vary: "origin",
  };
}
const json = (request, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...cors(request) } });
const fail = (request, error, status = 400) => json(request, { error }, status);

// Who is asking: their Base44 account, checked once per token and remembered for 10 minutes.
async function whoIs(token) {
  if (!token || token.length > 4096) return null;
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = new Request(`https://nebulux-chat.internal/who/${hash}`);
  const hit = await caches.default.match(key).catch(() => null);
  if (hit) return hit.json();
  const res = await fetch(`${BASE44}/api/apps/${APP_ID}/entities/User/me`, { headers: { authorization: `Bearer ${token}`, "X-App-Id": APP_ID } }).catch(() => null);
  if (!res || !res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u || !u.id) return null;
  const who = { id: String(u.id), name: String(u.full_name || u.email || "Explorer").split("@")[0].slice(0, 24), admin: u.role === "admin" };
  await caches.default.put(key, new Response(JSON.stringify(who), { headers: { "cache-control": "max-age=600" } })).catch(() => {});
  return who;
}

const rowToProfile = (p) =>
  p && {
    id: p.user_id,
    name: p.name,
    avatar: p.avatar,
    avatarBg: p.avatar_bg,
    nameColor: p.name_color,
    frame: p.frame,
    badge: p.badge,
    bio: p.bio,
    admin: !!p.is_admin,
  };

// The profile for this person, made the first time they open the chat.
const newCode = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

async function profileOf(env, who, invite = "") {
  let p = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(who.id).first();
  if (!p) {
    let name = (cleanName(who.name).name || "Explorer").slice(0, 20);
    for (let i = 0; i < 5; i++) {
      const taken = await env.DB.prepare("SELECT 1 FROM profiles WHERE lower(name) = lower(?)").bind(name).first();
      if (!taken) break;
      name = `${name.slice(0, 18)}${Math.floor(Math.random() * 900 + 100)}`;
    }
    const avatar = AVATAR_EMOJI[Math.floor(Math.random() * AVATAR_EMOJI.length)];
    const bg = AVATAR_BG[Math.floor(Math.random() * AVATAR_BG.length)];
    // Joined with someone's Nebulux Chat invite link: that completes their invite quest.
    const inviter = invite ? await env.DB.prepare("SELECT user_id, name FROM profiles WHERE invite_code = ?").bind(String(invite).slice(0, 12)).first() : null;
    await env.DB.prepare("INSERT OR IGNORE INTO profiles (user_id, name, avatar, avatar_bg, is_admin, invite_code, invited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(who.id, name, avatar, bg, who.admin ? 1 : 0, newCode(), inviter && inviter.user_id !== who.id ? inviter.user_id : null, now()).run();
    p = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(who.id).first();
    // Discord-style: everyone sees that someone new joined, with a Wave button to say hi.
    await postJoin(env, who.id, "general");
    if (inviter && inviter.user_id !== who.id && env.KV) await env.KV.put(`chatreferredby:${who.id}`, inviter.user_id).catch(() => {});
    if (inviter && inviter.user_id !== who.id) await notify(env, inviter.user_id, "reward", `${name} joined Nebulux Chat with your invite! Claim your quest for stars.`, "/chat/community?tab=quests");
  }
  if (p && !p.invite_code) {
    const code = newCode();
    await env.DB.prepare("UPDATE profiles SET invite_code = ? WHERE user_id = ?").bind(code, who.id).run();
    p.invite_code = code;
  }
  if (!!p.is_admin !== who.admin) {
    await env.DB.prepare("UPDATE profiles SET is_admin = ? WHERE user_id = ?").bind(who.admin ? 1 : 0, who.id).run();
    p.is_admin = who.admin ? 1 : 0;
  }
  return p;
}

// The person's Nebulux AI plan (Pro and up = Plus perks), checked at most every 10 minutes.
async function plusOf(token, userId) {
  const key = new Request(`https://nebulux-chat.internal/plan/${userId}`);
  const hit = await caches.default.match(key).catch(() => null);
  if (hit) return hit.json();
  let plan = "free";
  let source = "";
  try {
    const r = await fetch(`https://nebuluxai.pages.dev/api/apps/${APP_ID}/functions/credits`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "X-App-Id": APP_ID }, body: "{}" });
    if (r.ok) {
      const j = await r.json();
      plan = String(j.plan || "free");
      source = String(j.planSource || "");
    }
  } catch {
    // Unknown: no perks this time.
  }
  const mult = source === "trial" ? 1 : STAR_MULTIPLIER[plan] || 1;
  const out = { plan, plus: mult > 1, mult };
  await caches.default.put(key, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=600" } })).catch(() => {});
  return out;
}
const ownedWithPlus = (me, plus) => [...new Set([...JSON.parse(me.owned || "[]"), ...(plus.plus ? PLUS_FREE : [])])];

const dmId = (a, b) => `dm:${[a, b].sort().join(":")}`;
const dmUsers = (id) => (id.startsWith("dm:") ? id.slice(3).split(":") : null);

async function areFriends(env, a, b) {
  return !!(await env.DB.prepare("SELECT 1 FROM friends WHERE status = 'accepted' AND ((a = ? AND b = ?) OR (a = ? AND b = ?))").bind(a, b, b, a).first());
}
async function blocked(env, a, b) {
  return !!(await env.DB.prepare("SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)").bind(a, b, b, a).first());
}
// Groups work like Discord servers: "nebulux" is the public one everyone is in, and people only
// see and chat with others in groups they share. Private messages are only between friends.
async function isMember(env, userId, serverId) {
  if (serverId === "nebulux") return true;
  return !!(await env.DB.prepare("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?").bind(serverId, userId).first());
}
async function serverOf(env, channelId) {
  const c = await env.DB.prepare("SELECT server_id FROM channels WHERE id = ?").bind(channelId).first();
  return c ? c.server_id : null;
}
// Can this person read and write in this channel?
async function canUse(env, userId, channelId) {
  const pair = dmUsers(channelId);
  if (pair) return pair.includes(userId) && (await areFriends(env, pair[0], pair[1]));
  const server = await serverOf(env, channelId);
  return !!server && server !== "dm" && (await isMember(env, userId, server));
}
// Who gets live updates for a channel: both friends in a DM, the members of a group, or
// everyone for the public Nebulux group.
async function audience(env, channelId) {
  const pair = dmUsers(channelId);
  if (pair) return pair;
  const server = await serverOf(env, channelId);
  if (!server || server === "nebulux") return server ? null : [];
  const rows = await env.DB.prepare("SELECT user_id FROM members WHERE server_id = ?").bind(server).all();
  return (rows.results || []).map((r) => r.user_id);
}
// Posts the Discord-style "someone joined, say hi" message.
async function postJoin(env, userId, channelId) {
  const joined = await env.DB.prepare("INSERT INTO messages (channel_id, user_id, text, created_at) VALUES (?, ?, '::join::', ?)").bind(channelId, userId, now()).run();
  const row = await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(joined.meta.last_row_id).first();
  if (row) await push(env, { type: "message", message: (await withAuthors(env, [row]))[0] }, await audience(env, channelId));
}

// Live updates through the Hub. `to`: a list of user ids, or null for everyone connected.
async function push(env, event, to = null) {
  const hub = env.HUB.get(env.HUB.idFromName("hub"));
  await hub.fetch("https://hub/push", { method: "POST", body: JSON.stringify({ event, to }) }).catch(() => {});
}

async function notify(env, userId, kind, text, link) {
  await env.DB.prepare("INSERT INTO notifications (user_id, kind, text, link, created_at) VALUES (?, ?, ?, ?, ?)").bind(userId, kind, text.slice(0, 200), link || "", now()).run();
  await push(env, { type: "notification", kind, text: text.slice(0, 200), link: link || "" }, [userId]);
}

async function withAuthors(env, rows) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const people = {};
  if (ids.length) {
    const res = await env.DB.prepare(`SELECT * FROM profiles WHERE user_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
    for (const p of res.results || []) people[p.user_id] = rowToProfile(p);
  }
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel_id,
    user: people[r.user_id] || { id: r.user_id, name: "Unknown", avatar: "❔", avatarBg: "#334155", nameColor: "#94a3b8" },
    text: r.deleted ? "" : r.text,
    deleted: !!r.deleted,
    replyTo: r.reply_to,
    reactions: JSON.parse(r.reactions || "{}"),
    edited: !!r.edited_at,
    at: r.created_at,
  }));
}

async function route(request, env, who, token) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;
  const body = method === "GET" ? {} : await request.json().catch(() => ({}));
  const me = await profileOf(env, who, url.searchParams.get("invite") || "");
  if (me.banned) return fail(request, "You can't use Nebulux Chat right now.", 403);
  const seg = path.split("/").filter(Boolean);

  // --- my profile, orbs and the shop
  if (path === "/me" && method === "GET") {
    await env.DB.prepare("UPDATE profiles SET last_seen = ? WHERE user_id = ?").bind(now(), who.id).run();
    const plus = await plusOf(token, who.id);
    return json(request, { me: rowToProfile(me), orbs: me.orbs, stars: me.orbs, owned: ownedWithPlus(me, plus), plus, inviteCode: me.invite_code, shop: SHOP, freeColors: FREE_COLORS, avatars: AVATAR_EMOJI, avatarBgs: AVATAR_BG });
  }
  if (path === "/me" && method === "PATCH") {
    const owned = ownedWithPlus(me, await plusOf(token, who.id));
    const sets = [];
    const vals = [];
    if (body.name !== undefined) {
      const n = cleanName(body.name);
      if (n.error) return fail(request, n.error);
      const taken = await env.DB.prepare("SELECT 1 FROM profiles WHERE lower(name) = lower(?) AND user_id != ?").bind(n.name, who.id).first();
      if (taken) return fail(request, "Someone already has that name.");
      sets.push("name = ?");
      vals.push(n.name);
    }
    if (body.avatar !== undefined) {
      if (!AVATAR_EMOJI.includes(body.avatar)) return fail(request, "Pick one of the avatars.");
      sets.push("avatar = ?");
      vals.push(body.avatar);
    }
    if (body.avatarBg !== undefined) {
      if (!AVATAR_BG.includes(body.avatarBg)) return fail(request, "Pick one of the colors.");
      sets.push("avatar_bg = ?");
      vals.push(body.avatarBg);
    }
    if (body.nameColor !== undefined) {
      const bought = Object.entries(SHOP).find(([id, it]) => it.kind === "name_color" && it.value === body.nameColor && owned.includes(id));
      if (!FREE_COLORS.includes(body.nameColor) && !bought) return fail(request, "Get that color in the Star shop first.");
      sets.push("name_color = ?");
      vals.push(body.nameColor);
    }
    for (const [field, kind] of [["frame", "frame"], ["badge", "badge"]]) {
      if (body[field] === undefined) continue;
      const ok = body[field] === "" || Object.entries(SHOP).some(([id, it]) => it.kind === kind && it.value === body[field] && owned.includes(id));
      if (!ok) return fail(request, `Get that ${kind} in the Star shop first.`);
      sets.push(`${field} = ?`);
      vals.push(body[field]);
    }
    if (body.bio !== undefined) {
      const c = cleanMessage(body.bio || " ");
      if (c.error && body.bio) return fail(request, c.error);
      sets.push("bio = ?");
      vals.push(body.bio ? c.text.slice(0, 190) : "");
    }
    if (sets.length) await env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = ?`).bind(...vals, who.id).run();
    const p = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(who.id).first();
    return json(request, { me: rowToProfile(p) });
  }
  // --- quests: the way to earn orbs, each checked for real when claimed
  if (path === "/quests" && method === "GET" || path === "/quests/claim" && method === "POST") {
    const ctx = {
      env,
      userId: who.id,
      base44Get: async (entity, filter) => {
        const r = await fetch(`${BASE44}/api/apps/${APP_ID}/entities/${entity}?q=${encodeURIComponent(JSON.stringify(filter))}&limit=1`, { headers: { authorization: `Bearer ${token}`, "X-App-Id": APP_ID } }).catch(() => null);
        const rows = r && r.ok ? await r.json().catch(() => []) : [];
        return Array.isArray(rows) ? rows.length : 0;
      },
      planOf: async () => {
        const r = await fetch(`https://nebuluxai.pages.dev/api/apps/${APP_ID}/functions/credits`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "X-App-Id": APP_ID }, body: "{}" }).catch(() => null);
        return r && r.ok ? r.json().catch(() => null) : null;
      },
    };
    const claimed = new Set(((await env.DB.prepare("SELECT quest_id FROM quests_done WHERE user_id = ?").bind(who.id).all()).results || []).map((x) => x.quest_id));
    if (method === "GET") {
      const list = [];
      for (const q of QUESTS) list.push({ ...q, status: claimed.has(q.id) ? "claimed" : (await questDone(q.id, ctx).catch(() => false)) ? "ready" : "todo" });
      return json(request, { quests: list, inviteCode: me.invite_code, orbs: me.orbs, stars: me.orbs });
    }
    const q = QUESTS.find((x) => x.id === body.id);
    if (!q) return fail(request, "That quest doesn't exist.");
    if (claimed.has(q.id)) return fail(request, "You already got the stars for this quest.");
    if (!(await questDone(q.id, ctx).catch(() => false))) return fail(request, "Finish the quest first!");
    const plus = await plusOf(token, who.id);
    const got = Math.round(q.stars * plus.mult);
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO quests_done (user_id, quest_id, orbs, created_at) VALUES (?, ?, ?, ?)").bind(who.id, q.id, got, now()).run();
    if (!ins.meta.changes) return fail(request, "You already got the stars for this quest.");
    await env.DB.prepare("UPDATE profiles SET orbs = orbs + ? WHERE user_id = ?").bind(got, who.id).run();
    return json(request, { orbs: me.orbs + got, stars: me.orbs + got, got, mult: plus.mult });
  }
  if (path === "/shop/buy" && method === "POST") {
    const item = SHOP[body.item];
    if (!item) return fail(request, "That item isn't in the shop.");
    if (item.plusOnly) return fail(request, "That one comes free with Pro and up.");
    const owned = JSON.parse(me.owned || "[]");
    if (owned.includes(body.item)) return fail(request, "You already have that.");
    if (me.orbs < item.price) return fail(request, `You need ${item.price - me.orbs} more stars.`);
    owned.push(body.item);
    const r = await env.DB.prepare("UPDATE profiles SET orbs = orbs - ?, owned = ? WHERE user_id = ? AND orbs >= ?").bind(item.price, JSON.stringify(owned), who.id, item.price).run();
    if (!r.meta.changes) return fail(request, "Not enough stars.");
    return json(request, { orbs: me.orbs - item.price, stars: me.orbs - item.price, owned });
  }

  // --- channels and messages
  // --- groups (Discord servers)
  if (path === "/servers" && method === "GET") {
    const rows = await env.DB.prepare("SELECT s.* FROM servers s JOIN members m ON m.server_id = s.id WHERE m.user_id = ? ORDER BY m.joined_at").bind(who.id).all();
    const mine = (rows.results || []).map((s) => ({ id: s.id, name: s.name, icon: s.icon, owner: s.owner_id === who.id, invite: s.invite_code }));
    return json(request, { servers: [{ id: "nebulux", name: "Nebulux Community", icon: "", owner: false, invite: "" }, ...mine] });
  }
  if (path === "/servers" && method === "POST") {
    const n = cleanName(body.name);
    if (n.error) return fail(request, n.error.replace("Names", "Group names").replace("your name", "the name"));
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM servers WHERE owner_id = ?").bind(who.id).first();
    if (count && count.n >= 10) return fail(request, "You can make up to 10 groups.");
    const icon = AVATAR_EMOJI.includes(body.icon) ? body.icon : "🪐";
    const id = `g${newCode()}${newCode()}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO servers (id, name, icon, owner_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, n.name, icon, who.id, newCode() + newCode().slice(0, 2), now()),
      env.DB.prepare("INSERT INTO members (server_id, user_id, joined_at) VALUES (?, ?, ?)").bind(id, who.id, now()),
      env.DB.prepare("INSERT INTO channels (id, server_id, name, topic, position, created_at) VALUES (?, ?, 'general', 'Chat about anything', 0, ?)").bind(`${id}-general`, id, now()),
    ]);
    const s = await env.DB.prepare("SELECT * FROM servers WHERE id = ?").bind(id).first();
    return json(request, { server: { id, name: s.name, icon: s.icon, owner: true, invite: s.invite_code } });
  }
  if (path === "/servers/join" && method === "POST") {
    const s = await env.DB.prepare("SELECT * FROM servers WHERE invite_code = ?").bind(String(body.code || "").trim().slice(0, 16)).first();
    if (!s) return fail(request, "That invite link doesn't work. Ask for a new one.");
    const ins = await env.DB.prepare("INSERT OR IGNORE INTO members (server_id, user_id, joined_at) VALUES (?, ?, ?)").bind(s.id, who.id, now()).run();
    if (ins.meta.changes) {
      const first = await env.DB.prepare("SELECT id FROM channels WHERE server_id = ? ORDER BY position LIMIT 1").bind(s.id).first();
      if (first) await postJoin(env, who.id, first.id);
      if (s.owner_id !== who.id) await notify(env, s.owner_id, "friend", `${me.name} joined ${s.name}`, `/chat/community?s=${s.id}`);
    }
    return json(request, { server: { id: s.id, name: s.name, icon: s.icon, owner: s.owner_id === who.id, invite: s.invite_code } });
  }
  if (seg[0] === "servers" && seg[1] && seg[1] !== "nebulux") {
    const s = await env.DB.prepare("SELECT * FROM servers WHERE id = ?").bind(seg[1]).first();
    if (!s || !(await isMember(env, who.id, s.id))) return fail(request, "You're not in that group.", 403);
    const owner = s.owner_id === who.id;
    if (seg[2] === "leave" && method === "POST") {
      if (owner) return fail(request, "You made this group, so you can delete it instead.");
      await env.DB.prepare("DELETE FROM members WHERE server_id = ? AND user_id = ?").bind(s.id, who.id).run();
      return json(request, { ok: true });
    }
    if (!seg[2] && method === "DELETE") {
      if (!owner) return fail(request, "Only the person who made the group can delete it.", 403);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)").bind(s.id),
        env.DB.prepare("DELETE FROM channels WHERE server_id = ?").bind(s.id),
        env.DB.prepare("DELETE FROM members WHERE server_id = ?").bind(s.id),
        env.DB.prepare("DELETE FROM servers WHERE id = ?").bind(s.id),
      ]);
      return json(request, { ok: true });
    }
    if (seg[2] === "channels" && method === "POST") {
      if (!owner) return fail(request, "Only the person who made the group can add channels.", 403);
      const name = String(body.name || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 24);
      if (name.length < 2) return fail(request, "Channel names are 2 to 24 letters or numbers.");
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM channels WHERE server_id = ?").bind(s.id).first();
      if (n && n.n >= 20) return fail(request, "A group can have up to 20 channels.");
      const id = `${s.id}-${newCode()}`;
      await env.DB.prepare("INSERT INTO channels (id, server_id, name, topic, position, created_at) VALUES (?, ?, ?, '', ?, ?)").bind(id, s.id, name, (n?.n || 0) + 1, now()).run();
      return json(request, { channel: { id, name, topic: "" } });
    }
    if (seg[2] === "members" && method === "GET") {
      const rows = await env.DB.prepare("SELECT p.* FROM profiles p JOIN members m ON m.user_id = p.user_id WHERE m.server_id = ? AND p.banned = 0 LIMIT 200").bind(s.id).all();
      const hub = env.HUB.get(env.HUB.idFromName("hub"));
      const online = await hub.fetch("https://hub/online").then((r) => r.json()).catch(() => []);
      return json(request, { people: (rows.results || []).map((p) => ({ ...rowToProfile(p), online: online.includes(p.user_id), owner: p.user_id === s.owner_id })) });
    }
  }

  if (path === "/channels" && method === "GET") {
    const server = url.searchParams.get("server") || "nebulux";
    if (!(await isMember(env, who.id, server))) return fail(request, "You're not in that group.", 403);
    const ch = await env.DB.prepare("SELECT id, name, topic FROM channels WHERE server_id = ? ORDER BY position").bind(server).all();
    const reads = await env.DB.prepare("SELECT channel_id, last_id FROM reads WHERE user_id = ?").bind(who.id).all();
    const last = await env.DB.prepare("SELECT channel_id, MAX(id) AS last FROM messages WHERE deleted = 0 GROUP BY channel_id").all();
    const readMap = Object.fromEntries((reads.results || []).map((r) => [r.channel_id, r.last_id]));
    const lastMap = Object.fromEntries((last.results || []).map((r) => [r.channel_id, r.last]));
    const unread = (id) => (lastMap[id] || 0) > (readMap[id] || 0);
    const channels = (ch.results || []).map((c) => ({ ...c, unread: unread(c.id) }));
    // DMs: one per friend you've talked with.
    const dms = await env.DB.prepare("SELECT DISTINCT channel_id FROM messages WHERE channel_id LIKE ? OR channel_id LIKE ?").bind(`dm:${who.id}:%`, `dm:%:${who.id}`).all();
    const others = (dms.results || []).map((r) => dmUsers(r.channel_id).find((u) => u !== who.id));
    let dmList = [];
    if (others.length) {
      const ps = await env.DB.prepare(`SELECT * FROM profiles WHERE user_id IN (${others.map(() => "?").join(",")})`).bind(...others).all();
      dmList = (ps.results || []).map((p) => ({ id: dmId(who.id, p.user_id), user: rowToProfile(p), unread: unread(dmId(who.id, p.user_id)) }));
    }
    return json(request, { channels, dms: dmList });
  }
  if (seg[0] === "channels" && seg[1] && seg[2] === "messages") {
    const channelId = decodeURIComponent(seg[1]);
    if (!(await canUse(env, who.id, channelId))) return fail(request, "You can't open that chat.", 403);
    if (method === "GET") {
      const before = Number(url.searchParams.get("before")) || 2 ** 52;
      const rows = await env.DB.prepare("SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?").bind(channelId, before, PAGE).all();
      const list = (rows.results || []).reverse();
      if (list.length) await env.DB.prepare("INSERT INTO reads (user_id, channel_id, last_id) VALUES (?, ?, ?) ON CONFLICT(user_id, channel_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)").bind(who.id, channelId, list[list.length - 1].id).run();
      return json(request, { messages: await withAuthors(env, list), more: list.length === PAGE });
    }
    if (method === "POST") {
      const c = cleanMessage(body.text);
      if (c.error) return fail(request, c.error);
      if (c.text === "::join::") return fail(request, "Write a message first.");
      // Slow down floods: at most 8 messages in 10 seconds.
      const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND created_at > ?").bind(who.id, new Date(Date.now() - 10000).toISOString()).first();
      if (recent && recent.n >= 8) return fail(request, "Slow down a little!", 429);
      const replyTo = Number(body.replyTo) || null;
      const ins = await env.DB.prepare("INSERT INTO messages (channel_id, user_id, text, reply_to, created_at) VALUES (?, ?, ?, ?, ?)").bind(channelId, who.id, c.text, replyTo, now()).run();
      const row = await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(ins.meta.last_row_id).first();
      const [msg] = await withAuthors(env, [row]);
      const pair = dmUsers(channelId);
      await push(env, { type: "message", message: msg }, await audience(env, channelId));
      if (pair) {
        const other = pair.find((u) => u !== who.id);
        await notify(env, other, "message", `${me.name}: ${c.text.slice(0, 80)}`, `/chat/community?c=${encodeURIComponent(channelId)}`);
      } else {
        // @mentions
        const names = [...new Set((c.text.match(/@([\p{L}\p{N}_.-]{2,24})/gu) || []).map((m) => m.slice(1).toLowerCase()))].slice(0, 5);
        for (const n of names) {
          const p = await env.DB.prepare("SELECT user_id FROM profiles WHERE lower(name) = ?").bind(n).first();
          if (p && p.user_id !== who.id && (await canUse(env, p.user_id, channelId))) await notify(env, p.user_id, "message", `${me.name} mentioned you in a chat`, `/chat/community?c=${encodeURIComponent(channelId)}`);
        }
      }
      return json(request, { message: msg, removed: c.removed });
    }
  }
  if (seg[0] === "messages" && seg[1]) {
    const id = Number(seg[1]);
    const row = await env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first();
    if (!row || row.deleted) return fail(request, "That message is gone.", 404);
    if (!(await canUse(env, who.id, row.channel_id))) return fail(request, "You can't do that.", 403);
    const pair = await audience(env, row.channel_id);
    if (seg[2] === "react" && method === "POST") {
      const emoji = String(body.emoji || "");
      if (!["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"].includes(emoji)) return fail(request, "Pick one of the reactions.");
      const r = JSON.parse(row.reactions || "{}");
      const list = r[emoji] || [];
      r[emoji] = list.includes(who.id) ? list.filter((u) => u !== who.id) : [...list, who.id];
      if (!r[emoji].length) delete r[emoji];
      await env.DB.prepare("UPDATE messages SET reactions = ? WHERE id = ?").bind(JSON.stringify(r), id).run();
      await push(env, { type: "react", id, channel: row.channel_id, reactions: r }, pair);
      return json(request, { reactions: r });
    }
    if (seg[2] === "report" && method === "POST") {
      await env.DB.prepare("INSERT INTO reports (reporter_id, message_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(who.id, id, row.user_id, String(body.reason || "").slice(0, 300), now()).run();
      return json(request, { ok: true });
    }
    const mine = row.user_id === who.id;
    if (method === "PATCH") {
      if (!mine) return fail(request, "You can only edit your own messages.", 403);
      const c = cleanMessage(body.text);
      if (c.error) return fail(request, c.error);
      await env.DB.prepare("UPDATE messages SET text = ?, edited_at = ? WHERE id = ?").bind(c.text, now(), id).run();
      await push(env, { type: "edit", id, channel: row.channel_id, text: c.text }, pair);
      return json(request, { ok: true, text: c.text });
    }
    if (method === "DELETE") {
      if (!mine && !me.is_admin) return fail(request, "You can only delete your own messages.", 403);
      await env.DB.prepare("UPDATE messages SET deleted = 1 WHERE id = ?").bind(id).run();
      await push(env, { type: "delete", id, channel: row.channel_id }, pair);
      return json(request, { ok: true });
    }
  }

  // --- people, friends, blocks
  if (path === "/people" && method === "GET") {
    const q = String(url.searchParams.get("q") || "").trim();
    const rows = q
      ? await env.DB.prepare("SELECT * FROM profiles WHERE banned = 0 AND lower(name) LIKE ? ORDER BY last_seen DESC LIMIT 20").bind(`%${q.toLowerCase()}%`).all()
      : await env.DB.prepare("SELECT * FROM profiles WHERE banned = 0 ORDER BY last_seen DESC LIMIT 60").all();
    const hub = env.HUB.get(env.HUB.idFromName("hub"));
    const online = await hub.fetch("https://hub/online").then((r) => r.json()).catch(() => []);
    return json(request, { people: (rows.results || []).map((p) => ({ ...rowToProfile(p), online: online.includes(p.user_id) })) });
  }
  if (seg[0] === "people" && seg[1] && method === "GET") {
    const p = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(seg[1]).first();
    if (!p) return fail(request, "Not found.", 404);
    return json(request, { person: rowToProfile(p) });
  }
  if (path === "/friends" && method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM friends WHERE a = ? OR b = ?").bind(who.id, who.id).all();
    const ids = (rows.results || []).map((f) => (f.a === who.id ? f.b : f.a));
    const people = {};
    if (ids.length) {
      const ps = await env.DB.prepare(`SELECT * FROM profiles WHERE user_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
      for (const p of ps.results || []) people[p.user_id] = rowToProfile(p);
    }
    const hub = env.HUB.get(env.HUB.idFromName("hub"));
    const online = await hub.fetch("https://hub/online").then((r) => r.json()).catch(() => []);
    const out = (rows.results || [])
      .map((f) => {
        const other = f.a === who.id ? f.b : f.a;
        const status = f.status === "accepted" ? "friend" : f.a === who.id ? "sent" : "incoming";
        return people[other] && { ...people[other], status, online: online.includes(other), dm: dmId(who.id, other) };
      })
      .filter(Boolean);
    return json(request, { friends: out });
  }
  if (path === "/friends" && method === "POST") {
    const target = await env.DB.prepare("SELECT * FROM profiles WHERE user_id = ? OR lower(name) = lower(?)").bind(String(body.userId || ""), String(body.name || "")).first();
    if (!target || target.user_id === who.id) return fail(request, "We couldn't find that person. Check the name.");
    if (await blocked(env, who.id, target.user_id)) return fail(request, "You can't add that person.");
    const existing = await env.DB.prepare("SELECT * FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(who.id, target.user_id, target.user_id, who.id).first();
    if (existing && existing.status === "accepted") return fail(request, "You're already friends.");
    if (existing && existing.a === target.user_id) {
      await env.DB.prepare("UPDATE friends SET status = 'accepted' WHERE a = ? AND b = ?").bind(target.user_id, who.id).run();
      await notify(env, target.user_id, "friend", `${me.name} accepted your friend request`, "/chat/community?tab=friends");
      return json(request, { status: "friend" });
    }
    if (existing) return fail(request, "Friend request already sent.");
    await env.DB.prepare("INSERT INTO friends (a, b, status, created_at) VALUES (?, ?, 'pending', ?)").bind(who.id, target.user_id, now()).run();
    await notify(env, target.user_id, "friend", `${me.name} sent you a friend request`, "/chat/community?tab=friends");
    return json(request, { status: "sent" });
  }
  if (seg[0] === "friends" && seg[1] && method === "DELETE") {
    await env.DB.prepare("DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(who.id, seg[1], seg[1], who.id).run();
    return json(request, { ok: true });
  }
  if (path === "/blocks" && method === "POST") {
    const id = String(body.userId || "");
    if (!id || id === who.id) return fail(request, "Pick someone to block.");
    await env.DB.prepare("INSERT OR IGNORE INTO blocks (user_id, blocked_id) VALUES (?, ?)").bind(who.id, id).run();
    await env.DB.prepare("DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)").bind(who.id, id, id, who.id).run();
    return json(request, { ok: true });
  }

  // --- notifications
  if (path === "/notifications" && method === "GET") {
    const rows = await env.DB.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40").bind(who.id).all();
    return json(request, { notifications: (rows.results || []).map((n) => ({ id: n.id, kind: n.kind, text: n.text, link: n.link, read: !!n.read, at: n.created_at })) });
  }
  if (path === "/notifications/read" && method === "POST") {
    await env.DB.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").bind(who.id).run();
    return json(request, { ok: true });
  }

  // --- admin: ban from chat, see reports
  if (seg[0] === "admin" && me.is_admin) {
    if (seg[1] === "reports" && method === "GET") {
      const rows = await env.DB.prepare("SELECT r.*, m.text, p.name FROM reports r LEFT JOIN messages m ON m.id = r.message_id LEFT JOIN profiles p ON p.user_id = r.user_id WHERE r.status = 'open' ORDER BY r.id DESC LIMIT 50").all();
      return json(request, { reports: rows.results || [] });
    }
    if (seg[1] === "ban" && method === "POST") {
      await env.DB.prepare("UPDATE profiles SET banned = ? WHERE user_id = ?").bind(body.banned === false ? 0 : 1, String(body.userId || "")).run();
      await env.DB.prepare("UPDATE reports SET status = 'done' WHERE user_id = ?").bind(String(body.userId || "")).run();
      return json(request, { ok: true });
    }
  }
  return fail(request, "Not found.", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(request) });
    if (url.pathname === "/ws") {
      if (request.headers.get("upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
      const who = await whoIs(url.searchParams.get("token") || "");
      if (!who) return new Response("Sign in first", { status: 401 });
      const me = await profileOf(env, who);
      if (me.banned) return new Response("Not allowed", { status: 403 });
      const hub = env.HUB.get(env.HUB.idFromName("hub"));
      const headers = new Headers(request.headers);
      headers.set("x-user", who.id);
      return hub.fetch(new Request("https://hub/connect", { headers }));
    }
    if (!url.pathname.startsWith("/api/")) return new Response("Nebulux Chat", { headers: cors(request) });
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const who = await whoIs(token);
    if (!who) return fail(request, "Sign in to use Nebulux Chat.", 401);
    try {
      return await route(request, env, who, token);
    } catch (e) {
      return fail(request, "Something went wrong. Try again.", 500);
    }
  },
};

// Everyone's live connection. Hibernating WebSockets: free while nobody is sending anything.
export class Hub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1], [request.headers.get("x-user") || ""]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname === "/online") {
      const ids = [...new Set(this.state.getWebSockets().flatMap((ws) => this.state.getTags(ws)))].filter(Boolean);
      return new Response(JSON.stringify(ids));
    }
    if (url.pathname === "/push") {
      const { event, to } = await request.json();
      this.send(event, to);
      return new Response("ok");
    }
    return new Response("Not found", { status: 404 });
  }
  send(event, to) {
    const data = JSON.stringify(event);
    const sockets = to ? to.flatMap((u) => this.state.getWebSockets(u)) : this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(data);
      } catch {
        // Gone: the runtime cleans it up.
      }
    }
  }
  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const [userId] = this.state.getTags(ws);
    if (msg.type === "typing" && typeof msg.channel === "string") {
      const to = await audience(this.env, msg.channel.slice(0, 80)).catch(() => []);
      if (to && !to.includes(userId)) return;
      this.send({ type: "typing", channel: msg.channel, userId, name: String(msg.name || "").slice(0, 24) }, to);
    } else if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }
  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {
      // Already closed.
    }
  }
}
