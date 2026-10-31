// Connectors for Nebulux AI and Nebulux Orbit (https://nebuluxai.com/v1/connect, POST JSON). One
// connection per person and app, shared by both: connect Spotify in Orbit and Nebulux AI's chat can use
// it too. The apps themselves are in cloudflare-lib/apps.js; Google's and GitHub's permission pages are
// the ones Orbit already uses (functions/v1/orbit.js connectAddress).
//   { action: "list" }                       -> { apps: [{ k, n, cat, about, ready, connected, account, status, writes }] }
//   { action: "start", app, back }           -> { url }   the app's own permission page (back: where to return)
//                                               WhatsApp: -> { code, number, link } (send the code from
//                                               WhatsApp to link it), or { ok: true } when only the
//                                               Send to WhatsApp button is available (cloudflare-lib/whatsapp.js)
//   { action: "read", app }                  -> { app, name, account, sections, text }
//   { action: "write", app, op, text, where, confirmed: true } -> { ok }   only after the person pressed Send
//                                               (WhatsApp: to their own linked number)
//   { action: "disconnect", app }            -> { ok }
// Signed in with Nebulux AI ("Authorization: Bearer ...") or Orbit ("Authorization: Orbit <token>").
import { currentUser } from "../../../cloudflare-lib/credits.js";
import { allow } from "../../../cloudflare-lib/ratelimit.js";
import { APPS, LINK_APPS, GOOGLE_APPS, GITHUB_APP, isReady, startUrl, readApp, writeApp, writesOf, readText, GOOGLE_READ, nameOf } from "../../../cloudflare-lib/apps.js";
import { waReady, waEnsure, newCode, waNumber, chatLink, sendToOwn, unlink } from "../../../cloudflare-lib/whatsapp.js";
import { orbitEnsure, orbitUserByToken, ORBIT_RETURN, connectAddress, googleAccess, githubAccess } from "../orbit.js";

const ORIGINS = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev$/, /^https:\/\/orbit\.nebuluxai\.com$/, /^https:\/\/(www\.)?nebuluxai\.com$/, /^https:\/\/([a-z0-9-]+\.)?nebuluxai\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
// Where people can be sent back to after connecting: Orbit, or Nebulux AI itself (read when asked:
// orbit.js and this file import each other through the chat, so its list isn't ready at load time).
const NEBULUX_BACK = [/^https:\/\/(www\.)?nebuluxai\.com(\/|$)/, /^https:\/\/([a-z0-9-]+\.)?nebuluxai\.pages\.dev(\/|$)/];
const cors = (request) => {
  const o = request.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://nebuluxai.com", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", Vary: "Origin" };
};
const out = (request, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(request) } });
export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

const ALL = { ...GOOGLE_APPS, ...GITHUB_APP, ...APPS, ...LINK_APPS };
const isGoogle = (k) => !!GOOGLE_APPS[k];
const readyOf = (env, k) => (isGoogle(k) ? !!env.GOOGLE_CLIENT_ID : k === "github" ? !!env.GITHUB_CLIENT_ID : LINK_APPS[k] ? true : isReady(env, k));

// Who's asking: an Orbit sign-in, or a Nebulux AI one.
async function whoIs(request, db) {
  const h = request.headers.get("authorization") || "";
  const m = /^Orbit\s+([a-f0-9]{48})$/i.exec(h);
  if (m) { const row = await orbitUserByToken(db, m[1]); return row ? row.user_id : null; }
  const u = await currentUser(request);
  return u && u.id ? u.id : null;
}

// One read of any connected app, Google's and GitHub's included (for Nebulux AI's chat and the cards).
// q: the chat question, for apps that search for it (Notion).
export async function readAny(env, db, uid, k, q = "") {
  if (APPS[k]) return readApp(env, db, uid, k, q);
  if (!GOOGLE_READ[k]) return { app: k, name: nameOf(k), error: "Nothing to read from " + nameOf(k) + "." };
  const a = isGoogle(k) ? await googleAccess(env, db, uid, k) : await githubAccess(env, db, uid);
  if (!a.token) return { app: k, name: nameOf(k), status: a.status, error: a.status === "reconnect" ? `${nameOf(k)} needs reconnecting (Connectors → ${nameOf(k)} → Reconnect).` : a.status === "down" ? `Couldn't reach ${nameOf(k)} just now.` : `Connect ${nameOf(k)} first (Connectors).` };
  try {
    return { app: k, name: nameOf(k), account: a.email || "", sections: (await GOOGLE_READ[k](a)).filter((s) => s && s.items && s.items.length) };
  } catch (e) {
    return { app: k, name: nameOf(k), status: "down", error: e && (e.status === 401 || e.status === 403) ? `${nameOf(k)} didn't let Nebulux in. Try Reconnect in Connectors.` : `Couldn't reach ${nameOf(k)} just now.` };
  }
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return out(request, { error: "Connectors aren't available right now." }, 503);
  await orbitEnsure(db);
  const uid = await whoIs(request, db);
  if (!uid) return out(request, { error: "Please sign in again." }, 401);
  let body = {};
  try { body = await request.json(); } catch {}
  const action = String(body.action || ""), k = String(body.app || "");

  if (action === "list") {
    const rows = (await db.prepare("SELECT provider, email, status FROM orbit_connections WHERE user_id = ?").bind(uid).all()).results || [];
    const conn = Object.fromEntries(rows.map((r) => [r.provider, r]));
    const apps = Object.entries(ALL).map(([key, a]) => ({ k: key, n: a.n, cat: a.cat, about: key === "whatsapp" && waReady(env) ? "Chat with Nebulux AI in WhatsApp, and send replies to yourself" : a.about, ready: readyOf(env, key), connected: !!conn[key], account: (conn[key] && conn[key].email) || "", status: conn[key] && conn[key].status === "reconnect" ? "reconnect" : conn[key] ? "ok" : "", writes: writesOf(key),
      // WhatsApp: link = linking a number is available; linked = theirs is (else it's just the button)
      ...(key === "whatsapp" ? { link: waReady(env), linked: !!(conn[key] && conn[key].email) } : {}) }));
    return out(request, { apps });
  }
  if (!ALL[k]) return out(request, { error: "Unknown app." }, 400);

  if (action === "start") {
    if (!(await allow(`conn-start:${uid}`, 12, 600))) return out(request, { error: "Slow down a little." }, 429);
    if (k === "whatsapp" && waReady(env)) {
      await waEnsure(db);
      const number = await waNumber(env), code = await newCode(db, uid);
      return out(request, { code, number, link: chatLink(number, "Link Nebulux " + code) });
    }
    if (LINK_APPS[k]) {
      await db.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at, scopes, status) VALUES (?, ?, '-', '', ?, NULL, NULL) ON CONFLICT(user_id, provider) DO UPDATE SET at = excluded.at, status = NULL").bind(uid, k, Date.now()).run();
      return out(request, { ok: true });
    }
    const back = String(body.back || "");
    if (![...ORBIT_RETURN, ...NEBULUX_BACK].some((r) => r.test(back))) return out(request, { error: "That return address isn't a Nebulux one." }, 400);
    if (!readyOf(env, k)) return out(request, { error: `${nameOf(k)} is coming soon to Nebulux. It'll work as soon as it's ready.`, notReady: true }, 503);
    if (isGoogle(k) || k === "github") return out(request, { url: await connectAddress(env, db, "https://nebuluxai.com", uid, k, "", back) });
    return out(request, { url: await startUrl(env, db, uid, k, back) });
  }
  if (action === "read") {
    if (!(await allow(`conn-read:${uid}`, 30, 60))) return out(request, { error: "Slow down a little." }, 429);
    const r = await readAny(env, db, uid, k);
    if (r.error) return out(request, { ...r, reconnect: r.status === "reconnect" ? k : undefined }, r.status === "down" ? 502 : 400);
    return out(request, { ...r, text: readText(r) });
  }
  if (action === "write") {
    if (!(await allow(`conn-write:${uid}`, 10, 600))) return out(request, { error: "Slow down a little." }, 429);
    if (k === "whatsapp") {
      if (body.confirmed !== true) return out(request, { error: "Press Send first." }, 400);
      if (!waReady(env)) return out(request, { error: "Sending to WhatsApp isn't set up on Nebulux yet." }, 503);
      await waEnsure(db);
      const w = await sendToOwn(env, db, uid, String(body.text || "").slice(0, 12000));
      return out(request, w, w.ok ? 200 : 400);
    }
    const r = await writeApp(env, db, uid, k, String(body.op || ""), body);
    return out(request, r, r.ok ? 200 : 400);
  }
  if (action === "disconnect") {
    await db.prepare("DELETE FROM orbit_connections WHERE user_id = ? AND provider = ?").bind(uid, k).run();
    if (k === "whatsapp") await unlink(db, uid);
    return out(request, { ok: true });
  }
  return out(request, { error: "Unknown action." }, 400);
}
