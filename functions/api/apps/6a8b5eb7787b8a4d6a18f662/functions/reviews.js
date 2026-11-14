// Ratings and comments on games and gallery creations (cloudflare-lib/reviews.js).
//   { action: "get", kind: "game" | "site", item }      anyone -> { count, avg, mine, comments }
//   { action: "rate", kind: "game", item, stars }       signed in (games only)
//   { action: "comment", kind, item, text }             signed in
//   { action: "report", id }                            signed in: flag a comment
//   { action: "delete", id }                            your own comment (or an admin: any)
//   { action: "reported" } / { action: "keep", id }     admins: Monitor's Reported comments
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";
import { itemOf, readReviews, rate, addComment, reportComment, deleteComment, reportedComments, keepComment } from "../../../../../cloudflare-lib/reviews.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Ratings and comments aren't available right now." }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "get");
  const user = await currentUser(request).catch(() => null);
  const item = itemOf(body.kind, body.item);
  if (action === "get") {
    if (!item) return json({ error: "Unknown game or site." }, 400);
    return json(await readReviews(env.DB, body.kind, item, user && user.id));
  }
  if (!user) return json({ error: "Sign in to rate and comment." }, 401);
  if (action === "reported" || action === "keep") {
    if (user.role !== "admin") return json({ error: "Admins only." }, 403);
    if (action === "keep") await keepComment(env.DB, body.id);
    return json({ comments: await reportedComments(env.DB) });
  }
  if (action === "delete") {
    const r = await deleteComment(env.DB, body.id, user);
    if (r.error) return json(r, 403);
    return json(user.role === "admin" && body.admin ? { comments: await reportedComments(env.DB) } : r);
  }
  if (action === "report") {
    if (!(await allow(`review-report:${user.id}`, 20, 3600))) return json({ error: TOO_MANY }, 429);
    const r = await reportComment(env.DB, body.id, user.id);
    return json(r, r.error ? 400 : 200);
  }
  if (!item) return json({ error: "Unknown game or site." }, 400);
  if (action === "rate") {
    if (body.kind !== "game") return json({ error: "Only games have star ratings." }, 400);
    if (!(await allow(`review-rate:${user.id}`, 60, 3600))) return json({ error: TOO_MANY }, 429);
    const r = await rate(env.DB, "game", item, user.id, body.stars);
    if (r.error) return json(r, 400);
    return json(await readReviews(env.DB, "game", item, user.id));
  }
  if (action === "comment") {
    if (!(await allow(`review-comment:${user.id}`, 6, 600))) return json({ error: "That's a lot of comments. Try again in a few minutes." }, 429);
    const r = await addComment(env.DB, body.kind, item, user, body.text);
    if (r.error) return json(r, 400);
    return json(await readReviews(env.DB, body.kind, item, user.id));
  }
  return json({ error: "Unknown action." }, 400);
}
