// A visitor of a published website pressed "Sign in with Google" (cloudflare-lib/siteauth.js).
// GET ?site=<name>&return=<page on that site> -> Google's sign-in, with a signed state and a
// short cookie that must come back with it.
import { allowedReturn, clientFor, sign, CALLBACK } from "../../cloudflare-lib/siteauth.js";

const page = (msg, status = 400) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sign in</title><body style="font:16px system-ui;background:#05060f;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><p>${msg}</p>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const site = String(url.searchParams.get("site") || "").toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/.test(site)) return page("Unknown website.");
  if (!env.SITE_AUTH_KEY) return page("Sign-in isn't set up yet.", 503);
  if ((await env.PUBLISHED_HTML.get(`site:${site}`)) == null) return page("This website isn't published.", 404);
  const back = await allowedReturn(env.PUBLISHED_HTML, site, url.searchParams.get("return"));
  if (!back) return page("That page can't use this sign-in.");
  const client = await clientFor(env, site);
  if (!client) return page("Sign-in isn't set up yet.", 503);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const state = await sign(env, { s: site, r: back.toString(), n: nonce, x: Math.floor(Date.now() / 1000) + 600 });
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", client.id);
  google.searchParams.set("redirect_uri", CALLBACK);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");
  return new Response(null, {
    status: 302,
    headers: { location: google.toString(), "set-cookie": `nx_sa=${nonce}; Path=/site-auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`, "cache-control": "no-store" },
  });
}
