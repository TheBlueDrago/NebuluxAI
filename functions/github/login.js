// "Sign in with GitHub" for Nebulux Code: sends the person to GitHub to log in and pick what
// Nebulux may touch, then GitHub sends them back to /github/callback. Needs a GitHub OAuth app:
// GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the Cloudflare Pages settings.
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID) return new Response("GitHub sign-in isn't set up yet.", { status: 503 });
  const state = crypto.randomUUID();
  const back = new URL("/github/callback", request.url).toString();
  const to = new URL("https://github.com/login/oauth/authorize");
  to.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  to.searchParams.set("redirect_uri", back);
  to.searchParams.set("scope", "repo");
  to.searchParams.set("state", state);
  to.searchParams.set("allow_signup", "true");
  return new Response(null, {
    status: 302,
    headers: { Location: to.toString(), "Set-Cookie": `gh_state=${state}; Path=/github; Max-Age=600; HttpOnly; Secure; SameSite=Lax` },
  });
}
