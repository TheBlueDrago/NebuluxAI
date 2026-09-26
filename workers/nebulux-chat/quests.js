// Quests: the only way to earn orbs. Each is checked for real on the server when claimed.
// check(ctx) -> true when done. ctx: { env, userId, token, base44Get, planOf }
export const QUESTS = [
  { id: "say-hi", title: "Say hi in the chat", text: "Send your first message in any channel.", stars: 10 },
  { id: "first-friend", title: "Make your first friend", text: "Add someone as a friend and have them accept.", stars: 25 },
  { id: "first-website", title: "Publish your first website", text: "Build a website in the Website Designer and publish it.", stars: 100, link: "/chat/designer" },
  { id: "first-game", title: "Publish your first game", text: "Make a game in the Game Designer and publish it.", stars: 100, link: "/chat/game-designer" },
  { id: "invite", title: "Invite someone to Nebulux Chat", text: "Share your invite link. When someone joins the chat with it, this is done.", stars: 150 },
  { id: "upgrade", title: "Upgrade to a paid plan", text: "Get Pro, Team or Enterprise (the free trial week doesn't count).", stars: 300, link: "/chat/plans" },
];

export const PAID_PLANS = ["pro", "team", "enterprise", "secret", "admin"];

export async function questDone(id, ctx) {
  const { env, userId } = ctx;
  if (id === "say-hi") return !!(await env.DB.prepare("SELECT 1 FROM messages WHERE user_id = ? AND deleted = 0 AND text != '::join::' LIMIT 1").bind(userId).first());
  if (id === "first-friend") return !!(await env.DB.prepare("SELECT 1 FROM friends WHERE status = 'accepted' AND (a = ? OR b = ?) LIMIT 1").bind(userId, userId).first());
  if (id === "invite") return !!(await env.DB.prepare("SELECT 1 FROM profiles WHERE invited_by = ? LIMIT 1").bind(userId).first());
  if (id === "first-website") return (await ctx.base44Get("PublishedSite", { created_by_id: userId })) > 0;
  if (id === "first-game") return (await ctx.base44Get("PublishedGame", { created_by_id: userId })) > 0;
  if (id === "upgrade") {
    const p = await ctx.planOf();
    return !!p && PAID_PLANS.includes(p.plan) && p.planSource !== "trial";
  }
  return false;
}
