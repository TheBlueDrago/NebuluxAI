// Google sends a published website's visitor back here after they sign in (see start.js and
// cloudflare-lib/siteauth.js): check the state and cookie, swap the code for their verified
// profile, record the sign-in for the site's owner, and go back to the site with a token.
import { verify, clientFor, visitorToken, recordVisitor, CALLBACK } from "../../cloudflare-lib/siteauth.js";

const page = (msg, status = 400) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sign in</title><body style="font:16px system-ui;background:#05060f;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center"><p>${msg}</p>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "set-cookie": "nx_sa=; Path=/site-auth; Max-Age=0" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const st = await verify(env, url.searchParams.get("state"));
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)nx_sa=([0-9a-f]{32})/);
  if (!st || !st.s || !st.r || !cookie || cookie[1] !== st.n) return page("Sign-in took too long or didn't finish. Go back and try again.");
  const back = new URL(st.r);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(back.toString(), 302); // they cancelled: just go back
  const client = await clientFor(env, st.s);
  if (!client) return page("Sign-in isn't set up yet.", 503);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: client.id, client_secret: client.secret, redirect_uri: CALLBACK, grant_type: "authorization_code" }),
  }).catch(() => null);
  const tok = res && res.ok ? await res.json().catch(() => null) : null;
  if (!tok || !tok.id_token) return page("Google didn't sign you in. Go back and try again.");
  // Straight from Google over HTTPS, so it can be trusted without checking the signature.
  let info = null;
  try {
    const part = tok.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    info = JSON.parse(atob(part + "===".slice((part.length + 3) % 4)));
  } catch {}
  if (!info || info.aud !== client.id || !info.email || info.email_verified !== true) return page("Google didn't confirm that email. Try another account.");
  const who = { email: String(info.email).toLowerCase(), name: info.name || "", picture: info.picture || "" };
  if (env.DB) await recordVisitor(env.DB, st.s, who).catch(() => {});
  back.hash = `nx_auth=${await visitorToken(env, st.s, who)}`;
  return new Response(null, { status: 302, headers: { location: back.toString(), "set-cookie": "nx_sa=; Path=/site-auth; Max-Age=0", "cache-control": "no-store" } });
}
