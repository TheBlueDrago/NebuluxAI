// The user agreement everyone accepts before using the app (components/TermsGate.jsx).
// { action: "get" } -> { accepted, version }; { action: "accept", version } -> { accepted: true }.
// The acceptance is recorded server-side (KV terms:<userId> = { version, at }), so there's a
// record of who agreed to what and when. Bump TERMS_VERSION when the Terms change a lot:
// everyone is then asked again.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

export const TERMS_VERSION = "2026-09-26";

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const body = await request.json().catch(() => ({}));
    const key = `terms:${user.id}`;
    if (body.action === "accept") {
      if (body.version !== TERMS_VERSION) return json({ error: "The agreement changed. Reload the page and read it again.", version: TERMS_VERSION }, 409);
      const prev = await kv.get(key, "json");
      if (!prev || prev.version !== TERMS_VERSION) await kv.put(key, JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }));
      return json({ accepted: true, version: TERMS_VERSION });
    }
    const rec = await kv.get(key, "json");
    return json({ accepted: !!rec && rec.version === TERMS_VERSION, version: TERMS_VERSION });
  } catch {
    // Never lock anyone out because the check itself failed.
    return json({ accepted: true, version: TERMS_VERSION, unknown: true });
  }
}
