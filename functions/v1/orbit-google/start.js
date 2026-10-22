// Nebulux Orbit → Connect (step 1), older form: https://nebuluxai.com/v1/orbit-google/start?p=<app>&t=<Orbit sign-in>&return=<Orbit>.
// The Orbit site now asks for the address with a POST instead ({ action: "connect_url" } in orbit.js),
// so its sign-in isn't put in a URL; this stays for a page that was open before that change.
// A connection asks only to read at first; &add=send (Gmail) asks for sending on top.
// Uses the owner's Google app (GOOGLE_CLIENT_ID); https://nebuluxai.com/v1/orbit-google/callback must be
// one of its redirect URIs.
import { orbitEnsure, orbitUserByToken, ORBIT_RETURN, connectAddress, GOOGLE_SCOPES } from "../orbit.js";
export { GOOGLE_SCOPES, scopesFor } from "../orbit.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const back = url.searchParams.get("return") || "";
  if (!ORBIT_RETURN.some((r) => r.test(back))) return new Response("This link isn't from Nebulux Orbit.", { status: 400 });
  const provider = GOOGLE_SCOPES[url.searchParams.get("p")] ? url.searchParams.get("p") : "gmail";
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=" + provider + "&result=" + why, 302);
  if (!env.DB || !env.GOOGLE_CLIENT_ID) return done("unavailable");
  await orbitEnsure(env.DB);
  const me = await orbitUserByToken(env.DB, url.searchParams.get("t") || "");
  if (!me) return done("signin");
  return Response.redirect(await connectAddress(env, env.DB, url.origin, me.user_id, provider, url.searchParams.get("add"), back), 302);
}
