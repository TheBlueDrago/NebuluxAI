// Nebulux Orbit → "Connect GitHub" (step 1): https://nebuluxai.com/v1/orbit-github/start?t=<Orbit sign-in>&return=<Orbit>.
// Uses Nebulux Code's GitHub app (GITHUB_CLIENT_ID). GitHub allows a return address under the app's
// registered one, so it comes back to /github/callback/orbit (functions/github/callback/orbit.js).
import { orbitEnsure, orbitUserByToken, ORBIT_RETURN, randHex } from "../orbit.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = url.searchParams.get("return") || "";
  if (!ORBIT_RETURN.some((r) => r.test(back))) return new Response("This link isn't from Nebulux Orbit.", { status: 400 });
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=github&result=" + why, 302);
  if (!env.DB || !env.GITHUB_CLIENT_ID) return done("unavailable");
  await orbitEnsure(env.DB);
  const me = await orbitUserByToken(env.DB, url.searchParams.get("t") || "");
  if (!me) return done("signin");
  const state = randHex(16);
  await env.DB.prepare("INSERT INTO orbit_states (state, user_id, back, exp) VALUES (?, ?, ?, ?)").bind(state, me.user_id, "github " + back, Date.now() + 600000).run();
  const g = new URL("https://github.com/login/oauth/authorize");
  g.searchParams.set("client_id", String(env.GITHUB_CLIENT_ID).trim());
  g.searchParams.set("redirect_uri", url.origin + "/github/callback/orbit");
  g.searchParams.set("scope", "read:user repo");
  g.searchParams.set("state", state);
  return Response.redirect(g.toString(), 302);
}
