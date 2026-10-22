// Nebulux Orbit → "Connect GitHub" (step 2): GitHub sends the person back here (under Nebulux Code's
// registered callback). The access is kept sealed (cloudflare-lib/seal.js) with their Orbit account
// until they disconnect.
import { orbitEnsure } from "../../v1/orbit.js";
import { seal } from "../../../cloudflare-lib/seal.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  if (!env.DB || !/^[a-f0-9]{32}$/.test(state)) return new Response("This link has expired.", { status: 400 });
  await orbitEnsure(env.DB);
  const row = await env.DB.prepare("SELECT user_id, back, exp FROM orbit_states WHERE state = ?").bind(state).first();
  await env.DB.prepare("DELETE FROM orbit_states WHERE state = ? OR exp < ?").bind(state, Date.now()).run();
  if (!row || row.exp < Date.now() || !row.back.startsWith("github ")) return new Response("This link has expired. Try connecting again.", { status: 400 });
  const back = row.back.slice(7);
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=github&result=" + why, 302);
  const code = url.searchParams.get("code");
  if (!code) return done("cancelled");
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "Nebulux" },
    body: JSON.stringify({ client_id: String(env.GITHUB_CLIENT_ID || "").trim(), client_secret: String(env.GITHUB_CLIENT_SECRET || "").trim(), code, redirect_uri: url.origin + "/github/callback/orbit" }),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  if (!data.access_token) return done("failed");
  const me = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + data.access_token, "User-Agent": "Nebulux" } }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let sealed;
  try { sealed = await seal(env, data.access_token, row.user_id + "|github"); } catch { return done("unavailable"); }
  await env.DB.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at, status) VALUES (?, 'github', ?, ?, ?, NULL) ON CONFLICT(user_id, provider) DO UPDATE SET refresh = excluded.refresh, email = excluded.email, at = excluded.at, status = NULL").bind(row.user_id, sealed, String(me.login || "").slice(0, 100), Date.now()).run();
  return done("connected");
}
