// Nebulux Orbit → "Connect GitHub" (step 1), older form: https://nebuluxai.com/v1/orbit-github/start?t=<Orbit sign-in>&return=<Orbit>.
// The Orbit site now asks for the address with a POST instead ({ action: "connect_url" } in orbit.js);
// this stays for a page that was open before that change. Uses Nebulux Code's GitHub app
// (GITHUB_CLIENT_ID); it comes back to /github/callback/orbit (functions/github/callback/orbit.js).
import { orbitEnsure, orbitUserByToken, ORBIT_RETURN, connectAddress } from "../orbit.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = url.searchParams.get("return") || "";
  if (!ORBIT_RETURN.some((r) => r.test(back))) return new Response("This link isn't from Nebulux Orbit.", { status: 400 });
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=github&result=" + why, 302);
  if (!env.DB || !env.GITHUB_CLIENT_ID) return done("unavailable");
  await orbitEnsure(env.DB);
  const me = await orbitUserByToken(env.DB, url.searchParams.get("t") || "");
  if (!me) return done("signin");
  return Response.redirect(await connectAddress(env, env.DB, url.origin, me.user_id, "github", "", back), 302);
}
