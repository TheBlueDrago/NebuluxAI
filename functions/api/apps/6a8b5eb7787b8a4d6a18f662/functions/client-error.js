// Error reports (cloudflare-lib/errorlog.js).
//   { action: "report", message, stack, path }  anyone: a crash in their browser (src/lib/errorReport.js)
//   { action: "list" }                           admins -> { errors }
//   { action: "clear", sig? }                    admins: mark one (or all) as handled
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";
import { logError, listErrors, clearErrors } from "../../../../../cloudflare-lib/errorlog.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "report");
  if (action === "report") {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (!(await allow(`clienterr:${ip}`, 20, 3600))) return json({ ok: true });
    const user = await currentUser(request).catch(() => null);
    await logError(env.DB, { kind: "client", message: body.message, stack: body.stack, path: body.path, ua: request.headers.get("user-agent"), userId: user && user.id });
    return json({ ok: true });
  }
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (user.role !== "admin") return json({ error: "Admins only." }, 403);
  if (action === "clear") await clearErrors(env.DB, body.sig);
  return json({ errors: await listErrors(env.DB) });
}
