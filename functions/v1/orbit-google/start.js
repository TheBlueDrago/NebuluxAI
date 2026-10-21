// Nebulux Orbit → "Connect Gmail" (step 1). Opened by the Orbit site as
// https://nebuluxai.com/v1/orbit-google/start?t=<Orbit sign-in>&return=<Orbit address>.
// It remembers who is connecting (a one-time state, 10 minutes) and sends them to Google's own
// permission screen for reading and sending Gmail. Uses the owner's Google app (GOOGLE_CLIENT_ID);
// https://nebuluxai.com/v1/orbit-google/callback must be one of its redirect URIs.
import { orbitEnsure, orbitUserByToken, ORBIT_RETURN, randHex } from "../orbit.js";

// What each connection may do (Google shows this on its permission screen).
export const GOOGLE_SCOPES = {
  gmail: "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
  calendar: "openid email https://www.googleapis.com/auth/calendar.events",
  drive: "openid email https://www.googleapis.com/auth/drive.readonly",
  youtube: "openid email https://www.googleapis.com/auth/youtube.readonly",
  tasks: "openid email https://www.googleapis.com/auth/tasks.readonly",
};

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
  const state = randHex(16);
  await env.DB.prepare("INSERT INTO orbit_states (state, user_id, back, exp) VALUES (?, ?, ?, ?)").bind(state, me.user_id, provider + " " + back, Date.now() + 600000).run();
  const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  g.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  g.searchParams.set("redirect_uri", url.origin + "/v1/orbit-google/callback");
  g.searchParams.set("response_type", "code");
  g.searchParams.set("scope", GOOGLE_SCOPES[provider]);
  g.searchParams.set("access_type", "offline");
  g.searchParams.set("prompt", "consent");
  g.searchParams.set("include_granted_scopes", "true");
  g.searchParams.set("state", state);
  return Response.redirect(g.toString(), 302);
}
