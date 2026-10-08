// Admin-only credit controls for the Monitor page (see cloudflare-lib/credits.js).
// Body: { userId, action }
//   "get"    -> { credits }
//   "adjust" -> { tier, delta }       add (or remove, if negative) credits for one AI
import { json, base44 } from "../../../../../cloudflare-lib/published.js";
import { currentUser, entitlement, creditStatus, adjustBonus } from "../../../../../cloudflare-lib/credits.js";
import { logAdmin } from "../../../../../cloudflare-lib/audit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const admin = await currentUser(request);
    if (!admin) return json({ error: "Please sign in." }, 401);
    if (admin.role !== "admin") return json({ error: "Admins only." }, 403);

    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "");
    if (!userId) return json({ error: "userId required" }, 400);
    const target = await base44(request, "GET", `entities/User/${encodeURIComponent(userId)}`).catch(() => null);
    if (!target || !target.id) return json({ error: "User not found." }, 404);

    if (body.action === "adjust") {
      const delta = Math.trunc(Number(body.delta) || 0);
      if (!delta) return json({ error: "Enter a number of credits." }, 400);
      await adjustBonus(kv, request, target, String(body.tier || ""), delta);
      await logAdmin(kv, admin, "credits", { userId: target.id, email: target.email || "", tier: String(body.tier || ""), delta }, request);
    }

    const ent = await entitlement(kv, request, target, { other: true });
    return json({
      credits: await creditStatus(kv, ent),
    });
  } catch (err) {
    return json({ error: (err && err.message) || "Could not update credits." }, 400);
  }
}
