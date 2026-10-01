// The Website Designer's account autosave: the website someone is working on (published or not)
// is kept with their account, so it comes back on another device or after the browser's data is
// cleared. Same idea as game-draft.js. KV (PUBLISHED_HTML): sitedraft:<userId>.
// { action: "load" }                                         -> { draft | null }
// { action: "save", siteName, html, userTurns, projectId }   -> { ok }
// { action: "clear" }                                        -> { ok }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

const MAX_BYTES = 5 * 1024 * 1024;

export function cleanDraft(body) {
  return {
    siteName: String(body.siteName || "my-site").slice(0, 100),
    html: String(body.html || ""),
    userTurns: Array.isArray(body.userTurns) ? body.userTurns.slice(-50).map((t) => String(t).slice(0, 4000)) : [],
    projectId: String(body.projectId || "").slice(0, 100),
    savedAt: new Date().toISOString(),
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const kv = env.PUBLISHED_HTML;
    const key = `sitedraft:${user.id}`;
    const body = await request.json().catch(() => ({}));

    if (body.action === "load") {
      const stored = await kv.get(key, "json");
      return json({ draft: stored && !stored.cleared && stored.html ? stored : null });
    }

    if (body.action === "save") {
      const draft = cleanDraft(body);
      if (!draft.html) return json({ ok: true, empty: true });
      if (draft.html.length > MAX_BYTES) return json({ error: "Draft is too large to autosave." }, 413);
      // Skip saves that change nothing (KV's free tier allows 1,000 writes a day).
      const prev = await kv.get(key, "json");
      if (prev && prev.html === draft.html && prev.siteName === draft.siteName && JSON.stringify(prev.userTurns) === JSON.stringify(draft.userTurns)) {
        return json({ ok: true, unchanged: true });
      }
      if (!(await allow(`sitedraft:${user.id}`, 120, 3600))) return json({ error: TOO_MANY }, 429);
      await kv.put(key, JSON.stringify(draft));
      return json({ ok: true });
    }

    if (body.action === "clear") {
      await kv.put(key, JSON.stringify({ cleared: true }));
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Draft error" }, 500);
  }
}
