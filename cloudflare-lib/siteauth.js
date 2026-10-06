// "Sign in with Google" for websites people publish with Nebulux AI.
//
// Every published website gets a small script (siteAuthScript) that adds window.NebuluxAuth:
//   NebuluxAuth.user      -> { email, name, picture } or null
//   NebuluxAuth.signIn()  -> goes to Google (through https://nebuluxai.com/site-auth/start)
//   NebuluxAuth.signOut()
//   NebuluxAuth.onChange(fn)  (also a "nebulux-auth" event on window)
// and wires up plain HTML: [data-nx-signin] / [data-nx-signout] buttons, [data-nx-signed-in] /
// [data-nx-signed-out] parts shown only in that state, and [data-nx-user="name|email|picture"].
//
// The flow: start (functions/site-auth/start.js) checks the site and where to come back to, then
// sends the visitor to Google with a signed state; callback (functions/site-auth/callback.js)
// swaps the code for the visitor's verified Google profile, records the sign-in for the site's
// owner (D1 table site_users, shown in the Website Designer dashboard → Sign in), and sends them
// back to the site with a signed token in the address (#nx_auth=...), which the script keeps.
//
// The Google screen says "Nebulux AI" (our GOOGLE_CLIENT_ID) unless the site's owner, on Pro or
// higher, saved their own Google OAuth client (KV siteauth:<site>), which then shows their app.
// Tokens and states are signed with SITE_AUTH_KEY (a Pages secret).

export const APP_ORIGIN = "https://nebuluxai.com";
export const CALLBACK = `${APP_ORIGIN}/site-auth/callback`;
export const OWN_SCREEN_PLANS = ["pro", "team", "enterprise", "max", "secret"];
const TOKEN_DAYS = 30;

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const textB64 = (s) => b64url(enc.encode(s));
const fromB64 = (s) => {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
export async function sign(env, obj) {
  const body = textB64(JSON.stringify(obj));
  return `${body}.${await hmac(env.SITE_AUTH_KEY, body)}`;
}
export async function verify(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || !env.SITE_AUTH_KEY) return null;
  const want = await hmac(env.SITE_AUTH_KEY, body);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  try {
    const o = JSON.parse(fromB64(body));
    return o.x && o.x < Date.now() / 1000 ? null : o;
  } catch {
    return null;
  }
}

// A token for the site's page: who signed in, for which site, until when.
export const visitorToken = (env, site, info) =>
  sign(env, { s: site, e: info.email, n: String(info.name || "").slice(0, 80), p: String(info.picture || "").slice(0, 400), x: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 });

// Where a visitor may be sent back to: the site's own address, or a custom domain connected to it.
export async function allowedReturn(kv, site, raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host === `${site}.nebuluxai.com`) return u;
  const link = await kv.get(`domain:${host}`, "json").catch(() => null);
  return link && link.site === site && !link.pending ? u : null;
}

// The owner's own Google OAuth client, if they set one up (Pro and up).
export const configKey = (site) => `siteauth:${site}`;
export async function clientFor(env, site) {
  const own = await env.PUBLISHED_HTML.get(configKey(site), "json").catch(() => null);
  if (own && own.clientId && own.clientSecret) return { id: own.clientId, secret: own.clientSecret, own: true };
  return env.GOOGLE_CLIENT_ID ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET, own: false } : null;
}

// ---- who signed in (D1) ----
let tableReady = false;
async function ensureTable(db) {
  if (tableReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS site_users (site TEXT NOT NULL, email TEXT NOT NULL, name TEXT, picture TEXT, first_at TEXT, last_at TEXT, count INTEGER DEFAULT 1, PRIMARY KEY (site, email))").run();
  tableReady = true;
}
export async function recordVisitor(db, site, info) {
  await ensureTable(db);
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO site_users (site, email, name, picture, first_at, last_at, count) VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT(site, email) DO UPDATE SET name = excluded.name, picture = excluded.picture, last_at = excluded.last_at, count = count + 1")
    .bind(site, info.email, String(info.name || "").slice(0, 80), String(info.picture || "").slice(0, 400), now, now)
    .run();
}
export async function listVisitors(db, site) {
  await ensureTable(db);
  const r = await db.prepare("SELECT email, name, picture, first_at, last_at, count FROM site_users WHERE site = ? ORDER BY last_at DESC LIMIT 1000").bind(site).all();
  return r.results || [];
}
export async function removeVisitor(db, site, email) {
  await ensureTable(db);
  await db.prepare("DELETE FROM site_users WHERE site = ? AND email = ?").bind(site, String(email || "")).run();
}

// The script every published website gets (put at the start of <head>, so the page's own code can
// use NebuluxAuth right away).
export function siteAuthScript(site) {
  const S = JSON.stringify(site).replace(/</g, "\\u003c");
  return (
    `<script data-bh>(function(){var S=${S},K="nx-auth:"+S,A=${JSON.stringify(APP_ORIGIN + "/site-auth/start")};` +
    `function dec(t){try{var p=t.split(".")[0].replace(/-/g,"+").replace(/_/g,"/");p+="===".slice((p.length+3)%4);var b=atob(p),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);var u=JSON.parse(new TextDecoder().decode(a));if(u.s!==S||u.x*1000<Date.now())return null;return{email:u.e,name:u.n,picture:u.p}}catch(e){return null}}` +
    `var tok=null,user=null,fns=[];try{var m=location.hash.match(/nx_auth=([\\w.-]+)/);if(m){tok=m[1];try{localStorage.setItem(K,tok)}catch(e){}var h=location.hash.replace(/&?nx_auth=[\\w.-]+/,"");history.replaceState(null,"",location.pathname+location.search+(h==="#"?"":h))}else{tok=localStorage.getItem(K)}}catch(e){}` +
    `if(tok){user=dec(tok);if(!user)tok=null}` +
    `function paint(){try{document.querySelectorAll("[data-nx-signed-in]").forEach(function(el){el.hidden=!user});document.querySelectorAll("[data-nx-signed-out]").forEach(function(el){el.hidden=!!user});` +
    `document.querySelectorAll("[data-nx-user]").forEach(function(el){var f=el.getAttribute("data-nx-user");if(f==="picture"&&el.tagName==="IMG"){if(user&&user.picture)el.src=user.picture;else el.removeAttribute("src")}else el.textContent=user?(user[f]||""):""})}catch(e){}}` +
    `function fire(){paint();fns.forEach(function(f){try{f(user)}catch(e){}});try{dispatchEvent(new CustomEvent("nebulux-auth",{detail:user}))}catch(e){}}` +
    `window.NebuluxAuth={get user(){return user},get token(){return tok},signIn:function(){location.href=A+"?"+new URLSearchParams({site:S,return:location.href.split("#")[0]})},` +
    `signOut:function(){try{localStorage.removeItem(K)}catch(e){}tok=null;user=null;fire()},onChange:function(f){if(typeof f==="function"){fns.push(f);try{f(user)}catch(e){}}}};` +
    `document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-nx-signin],[data-nx-signout]");if(!t)return;e.preventDefault();if(t.hasAttribute("data-nx-signin"))NebuluxAuth.signIn();else NebuluxAuth.signOut()});` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fire);else fire()})();</script>`
  );
}

export function withSiteAuth(html, site) {
  const tag = siteAuthScript(site);
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length);
  return tag + html;
}
