// Cloudflare Turnstile (free): the "I'm not a robot" check on sign-up and on "Forgot password",
// the two forms that send emails, so bots can't make accounts in bulk or spam people's inboxes.
// Off until the owner makes a Turnstile widget for nebuluxai.com in the Cloudflare dashboard and
// adds its keys to the Pages project: TURNSTILE_SITE_KEY (public, shown to the browser) and
// TURNSTILE_SECRET (a secret). The browser gets the site key from the public settings
// (functions/api/[[path]].js) and shows the check (src/components/Turnstile.jsx).
const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileOn = (env) => !!(env && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);

// true when the check passed, or when Turnstile isn't switched on.
export async function turnstileOk(env, request, token) {
  if (!turnstileOn(env)) return true;
  if (!token || typeof token !== "string" || token.length > 2048) return false;
  try {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", token);
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) form.append("remoteip", ip);
    const r = await fetch(VERIFY, { method: "POST", body: form });
    const j = await r.json();
    return !!j.success;
  } catch {
    // Cloudflare's check itself is down: don't lock everyone out (the rate limits still apply).
    return true;
  }
}

export const TURNSTILE_FAILED = "Please finish the \"I'm not a robot\" check and try again.";
