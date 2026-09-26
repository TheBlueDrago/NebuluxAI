// Quests: the way to earn stars. Two kinds:
// - Milestones: once ever (first website, first game, upgrade, invite...).
// - Weekly quests: 6 picked from WEEKLY each week (the same 6 for everyone), new every Monday
//   (UTC). Each counts only what you did this week.
// Anyone can claim at most DAILY_CLAIMS quests per day (UTC), so stars come in steadily.
// Every quest is checked for real on the server when claimed.
export const DAILY_CLAIMS = 2;
export const WEEKLY_COUNT = 6;

export const MILESTONES = [
  { id: "say-hi", title: "Say hi in the chat", text: "Send your first message in any channel.", stars: 10 },
  { id: "first-friend", title: "Make your first friend", text: "Add someone as a friend and have them accept.", stars: 25 },
  { id: "first-website", title: "Publish your first website", text: "Build a website in the Website Designer and publish it.", stars: 100, link: "/chat/designer" },
  { id: "first-game", title: "Publish your first game", text: "Make a game in the Game Designer and publish it.", stars: 100, link: "/chat/game-designer" },
  { id: "invite", title: "Invite someone to Nebulux Chat", text: "Share your invite link. When someone joins the chat with it, this is done.", stars: 150 },
  { id: "upgrade", title: "Upgrade to a paid plan", text: "Get Pro, Team or Enterprise (the free trial week doesn't count).", stars: 300, link: "/chat/plans" },
  { id: "make-group", title: "Start your own group", text: "Make a group with the + on the left.", stars: 30 },
  { id: "dress-up", title: "Dress up", text: "Change your avatar, colors or About me in your profile.", stars: 15 },
  { id: "first-buy", title: "Go shopping", text: "Buy anything in the Star shop.", stars: 20 },
];

// check: how far along you are this week -> a number compared with `need`.
export const WEEKLY = [
  { id: "chatter", title: "Chatterbox", text: "Send 20 messages this week.", need: 20, stars: 30, count: "messages" },
  { id: "chatter-big", title: "Super chatterbox", text: "Send 60 messages this week.", need: 60, stars: 70, count: "messages" },
  { id: "replies", title: "Keep the talk going", text: "Reply to 5 messages this week.", need: 5, stars: 25, count: "replies" },
  { id: "reacts", title: "React fan", text: "React to 10 messages this week.", need: 10, stars: 20, count: "reacts" },
  { id: "waves", title: "Welcome crew", text: "Wave hi to 2 new people this week.", need: 2, stars: 30, count: "waves" },
  { id: "builds", title: "Show and tell", text: "Post in #show-your-builds this week.", need: 1, stars: 25, count: "ch:show-your-builds" },
  { id: "helper", title: "Homework helper", text: "Send 3 messages in #homework-help this week.", need: 3, stars: 30, count: "ch:homework-help" },
  { id: "ideas", title: "Idea machine", text: "Share an idea in #ideas this week.", need: 1, stars: 20, count: "ch:ideas" },
  { id: "explorer", title: "Channel explorer", text: "Chat in 3 different channels this week.", need: 3, stars: 25, count: "channels" },
  { id: "days", title: "Regular", text: "Chat on 3 different days this week.", need: 3, stars: 40, count: "days" },
  { id: "days-5", title: "Always around", text: "Chat on 5 different days this week.", need: 5, stars: 70, count: "days" },
  { id: "dm", title: "Pen pal", text: "Send 5 private messages to friends this week.", need: 5, stars: 25, count: "dms" },
  { id: "friend-week", title: "New friend", text: "Make a new friend this week.", need: 1, stars: 35, count: "friends" },
  { id: "mention", title: "Shout-out", text: "@mention someone in a message this week.", need: 1, stars: 15, count: "mentions" },
  { id: "emoji", title: "Emoji artist", text: "Send 5 messages with an emoji this week.", need: 5, stars: 15, count: "emoji" },
  { id: "group-chat", title: "Squad talk", text: "Send 10 messages in a group you're in this week.", need: 10, stars: 30, count: "group" },
  { id: "join-group", title: "Join the crew", text: "Join or make a group this week.", need: 1, stars: 25, count: "joined" },
  { id: "shopper", title: "Treat yourself", text: "Buy something in the Star shop this week.", need: 1, stars: 15, count: "ev:buy" },
  { id: "restyle", title: "Fresh look", text: "Update your profile this week.", need: 1, stars: 10, count: "ev:profile" },
  { id: "long", title: "Storyteller", text: "Send a message longer than 100 letters this week.", need: 1, stars: 15, count: "long" },
];

export const PAID_PLANS = ["pro", "team", "enterprise", "secret", "admin"];

// Weeks start Monday 00:00 UTC. Week 0 began Monday 5 Jan 1970.
const WEEK_MS = 7 * 24 * 3600 * 1000;
const EPOCH_MONDAY = 4 * 24 * 3600 * 1000;
export const weekNumber = (t = Date.now()) => Math.floor((t - EPOCH_MONDAY) / WEEK_MS);
export const weekStart = (w = weekNumber()) => new Date(EPOCH_MONDAY + w * WEEK_MS).toISOString();
export const weekEnds = (w = weekNumber()) => new Date(EPOCH_MONDAY + (w + 1) * WEEK_MS).toISOString();

// This week's quests: a shuffle seeded by the week number, so everyone gets the same ones.
export function weeklyQuests(w = weekNumber()) {
  const list = [...WEEKLY];
  let seed = (w * 2654435761) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, WEEKLY_COUNT).map((q) => ({ ...q, key: `w${w}:${q.id}`, weekly: true }));
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

// How far along this person is on each weekly counter (one pass over this week's messages).
export async function weeklyProgress(env, userId, since) {
  const rows = (await env.DB.prepare("SELECT m.channel_id, m.text, m.reply_to, m.created_at, c.server_id FROM messages m LEFT JOIN channels c ON c.id = m.channel_id WHERE m.user_id = ? AND m.created_at >= ? AND m.deleted = 0 ORDER BY m.id DESC LIMIT 1000").bind(userId, since).all()).results || [];
  const p = { messages: 0, replies: 0, waves: 0, channels: 0, days: 0, dms: 0, mentions: 0, emoji: 0, group: 0, long: 0 };
  const chans = new Set();
  const days = new Set();
  for (const r of rows) {
    if (r.text === "::join::") continue;
    if (r.text === "::wave::") {
      p.waves++;
      continue;
    }
    p.messages++;
    days.add(r.created_at.slice(0, 10));
    if (r.reply_to) p.replies++;
    if (r.channel_id.startsWith("dm:")) p.dms++;
    else chans.add(r.channel_id);
    if (r.server_id && r.server_id !== "nebulux" && r.server_id !== "dm") p.group++;
    if (/@[\p{L}\p{N}_.-]{2,24}/u.test(r.text)) p.mentions++;
    if (EMOJI_RE.test(r.text)) p.emoji++;
    if (r.text.length > 100) p.long++;
    p[`ch:${r.channel_id}`] = (p[`ch:${r.channel_id}`] || 0) + 1;
  }
  p.channels = chans.size;
  p.days = days.size;
  const ev = (await env.DB.prepare("SELECT CASE WHEN kind LIKE 'react:%' THEN 'react' ELSE kind END AS k, COUNT(*) AS n FROM events WHERE user_id = ? AND created_at >= ? GROUP BY k").bind(userId, since).all()).results || [];
  for (const e of ev) p[e.k === "react" ? "reacts" : `ev:${e.k}`] = e.n;
  p.friends = (await env.DB.prepare("SELECT COUNT(*) AS n FROM friends WHERE status = 'accepted' AND (a = ? OR b = ?) AND created_at >= ?").bind(userId, userId, since).first())?.n || 0;
  p.joined = (await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE user_id = ? AND joined_at >= ?").bind(userId, since).first())?.n || 0;
  return p;
}

export async function milestoneDone(id, ctx) {
  const { env, userId } = ctx;
  if (id === "say-hi") return !!(await env.DB.prepare("SELECT 1 FROM messages WHERE user_id = ? AND deleted = 0 AND text != '::join::' LIMIT 1").bind(userId).first());
  if (id === "first-friend") return !!(await env.DB.prepare("SELECT 1 FROM friends WHERE status = 'accepted' AND (a = ? OR b = ?) LIMIT 1").bind(userId, userId).first());
  if (id === "invite") return !!(await env.DB.prepare("SELECT 1 FROM profiles WHERE invited_by = ? LIMIT 1").bind(userId).first());
  if (id === "make-group") return !!(await env.DB.prepare("SELECT 1 FROM servers WHERE owner_id = ? LIMIT 1").bind(userId).first());
  if (id === "dress-up") return !!(await env.DB.prepare("SELECT 1 FROM events WHERE user_id = ? AND kind = 'profile' LIMIT 1").bind(userId).first());
  if (id === "first-buy") return !!(await env.DB.prepare("SELECT 1 FROM events WHERE user_id = ? AND kind = 'buy' LIMIT 1").bind(userId).first());
  if (id === "first-website") return (await ctx.base44Get("PublishedSite", { created_by_id: userId })) > 0;
  if (id === "first-game") return (await ctx.base44Get("PublishedGame", { created_by_id: userId })) > 0;
  if (id === "upgrade") {
    const p = await ctx.planOf();
    return !!p && PAID_PLANS.includes(p.plan) && p.planSource !== "trial";
  }
  return false;
}
