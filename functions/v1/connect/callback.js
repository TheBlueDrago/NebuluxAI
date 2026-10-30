// Connectors, step 2: the app (Notion, Slack, Spotify...) sends the person back here with a code.
// It's swapped for the app's permission, kept sealed with their account (cloudflare-lib/apps.js finish),
// and they go back to where they started (Nebulux AI or Orbit) with ?connected=<app>&result=...
// This address, https://nebuluxai.com/v1/connect/callback, is the redirect address in every app's settings.
import { APPS, finish } from "../../../cloudflare-lib/apps.js";
import { orbitEnsure } from "../orbit.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  if (!env.DB || !/^[a-f0-9]{32}$/.test(state)) return new Response("This link has expired.", { status: 400 });
  await orbitEnsure(env.DB);
  const row = await env.DB.prepare("SELECT user_id, back, exp FROM orbit_states WHERE state = ?").bind(state).first();
  await env.DB.prepare("DELETE FROM orbit_states WHERE state = ? OR exp < ?").bind(state, Date.now()).run();
  const m = row && /^app:([a-z]+) (\S+) (.+)$/.exec(row.back);
  if (!row || row.exp < Date.now() || !m || !APPS[m[1]]) return new Response("This link has expired. Try connecting again.", { status: 400 });
  const [, k, v, back] = m;
  const done = (why) => Response.redirect(back + (back.includes("?") ? "&" : "?") + "connected=" + k + "&result=" + why, 302);
  const code = url.searchParams.get("code");
  if (!code) return done("cancelled");
  try {
    const r = await finish(env, env.DB, k, row.user_id, code, v);
    return done(r.ok ? "connected" : "failed");
  } catch {
    return done("unavailable");
  }
}
