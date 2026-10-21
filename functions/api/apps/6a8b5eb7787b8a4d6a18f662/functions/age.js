// The birthday asked once after sign-in (cloudflare-lib/agegate.js):
//   { action: "get" } -> { needBirth, blocked }      { action: "set", birth: "YYYY-MM-DD" } -> { ok, blocked }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { ageStatus, setBirth } from "../../../../../cloudflare-lib/agegate.js";

export async function onRequestPost({ request, env }) {
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    if (body.action === "set") {
      if (!(await allow(`age:${user.id}`, 5, 600))) return json({ error: TOO_MANY }, 429);
      const r = await setBirth(env.DB, user.id, String(body.birth || ""));
      return json(r, r.error ? 400 : 200);
    }
    return json(await ageStatus(env.DB, user.id));
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
