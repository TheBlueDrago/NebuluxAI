// The signed-in user's credit status (plan + per-AI total/used/remaining), computed
// server-side — see cloudflare-lib/credits.js. The app calls this through
// base44.functions.invoke("credits"), which is why it lives at a function path.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser, entitlement, creditStatus, activityOf } from "../../../../../cloudflare-lib/credits.js";
import { parseDailyLimit, setDailyLimit, DAILY_LIMIT_MIN, DAILY_LIMIT_MAX } from "../../../../../cloudflare-lib/usageCredits.js";

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    // { action: "my-activity" }: this month's activity record kept for Monitor (question
    // counts and the start of the latest few), for Settings → Download my data. Own data only.
    const body = request.method === "POST" ? await request.clone().json().catch(() => ({})) : {};
    if (body && body.action === "my-activity") return json({ activity: await activityOf(env.PUBLISHED_HTML, user.id) });
    // { action: "set-daily-limit", limit }: how many dollars of usage credits may be spent per day
    // ($1 to $500, or null for no limit), Settings → Usage (cloudflare-lib/usageCredits.js).
    if (body && body.action === "set-daily-limit") {
      if (!env.DB) return json({ error: "Settings can't be saved right now. Try again later." }, 503);
      const limit = parseDailyLimit(body.limit);
      if (limit === undefined) return json({ error: `Type a whole number of dollars from $${DAILY_LIMIT_MIN} to $${DAILY_LIMIT_MAX}, or choose no limit.` }, 400);
      return json({ usageCredits: await setDailyLimit(env.DB, user.id, limit) });
    }
    const ent = await entitlement(env.PUBLISHED_HTML, request, user);
    return json(await creditStatus(env.PUBLISHED_HTML, ent, env.DB));
  } catch (err) {
    return json({ error: "Could not load credits.", detail: String((err && err.message) || err) }, 500);
  }
}
