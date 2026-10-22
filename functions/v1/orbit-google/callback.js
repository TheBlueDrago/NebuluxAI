// Nebulux Orbit → "Connect Gmail" (step 2): Google sends the person back here. The code is swapped
// for a long-lived permission (refresh token), kept sealed (cloudflare-lib/seal.js) with their Orbit
// account together with what they actually granted, then they go back to Orbit. They can disconnect
// any time in Orbit's Connections.
import { orbitEnsure } from "../orbit.js";
import { seal } from "../../../cloudflare-lib/seal.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  if (!env.DB || !/^[a-f0-9]{32}$/.test(state)) return new Response("This link has expired.", { status: 400 });
  await orbitEnsure(env.DB);
  const row = await env.DB.prepare("SELECT user_id, back, exp FROM orbit_states WHERE state = ?").bind(state).first();
  await env.DB.prepare("DELETE FROM orbit_states WHERE state = ? OR exp < ?").bind(state, Date.now()).run();
  if (!row || row.exp < Date.now()) return new Response("This link has expired. Try connecting again.", { status: 400 });
  const [provider, back] = [row.back.split(" ")[0], row.back.slice(row.back.indexOf(" ") + 1)];
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=" + provider + "&result=" + why, 302);
  const code = url.searchParams.get("code");
  if (!code) return done("cancelled");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + "/v1/orbit-google/callback", grant_type: "authorization_code" }),
  }).catch(() => null);
  const tok = res && res.ok ? await res.json().catch(() => null) : null;
  if (!tok || !tok.refresh_token) return done("failed");
  let email = "";
  try {
    const part = String(tok.id_token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    email = JSON.parse(atob(part + "===".slice((part.length + 3) % 4))).email || "";
  } catch {}
  let sealed;
  try { sealed = await seal(env, tok.refresh_token, row.user_id + "|" + provider); } catch { return done("unavailable"); }
  await env.DB.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at, scopes, status) VALUES (?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(user_id, provider) DO UPDATE SET refresh = excluded.refresh, email = excluded.email, at = excluded.at, scopes = excluded.scopes, status = NULL").bind(row.user_id, provider, sealed, String(email).slice(0, 200), Date.now(), String(tok.scope || "").slice(0, 2000)).run();
  return done("connected");
}
