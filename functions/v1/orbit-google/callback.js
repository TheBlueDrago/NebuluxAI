// Nebulux Orbit → "Connect Gmail" (step 2): Google sends the person back here. The code is swapped
// for a long-lived Gmail permission (refresh token), kept with their Orbit account, then they go back
// to Orbit. They can disconnect any time in Orbit's Connections.
import { orbitEnsure } from "../orbit.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  if (!env.DB || !/^[a-f0-9]{32}$/.test(state)) return new Response("This link has expired.", { status: 400 });
  await orbitEnsure(env.DB);
  const row = await env.DB.prepare("SELECT user_id, back, exp FROM orbit_states WHERE state = ?").bind(state).first();
  await env.DB.prepare("DELETE FROM orbit_states WHERE state = ? OR exp < ?").bind(state, Date.now()).run();
  if (!row || row.exp < Date.now()) return new Response("This link has expired. Try connecting again.", { status: 400 });
  const done = (why) => Response.redirect(row.back + (row.back.includes("?") ? "&" : "?") + "gmail=" + why, 302);
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
  await env.DB.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at) VALUES (?, 'gmail', ?, ?, ?) ON CONFLICT(user_id, provider) DO UPDATE SET refresh = excluded.refresh, email = excluded.email, at = excluded.at").bind(row.user_id, tok.refresh_token, String(email).slice(0, 200), Date.now()).run();
  return done("connected");
}
