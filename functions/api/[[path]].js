// Cloudflare Pages Function: proxies every /api/* request straight through to the
// real Base44 backend for this app. The frontend always calls same-origin relative
// paths (see src/api/base44Client.js, serverUrl: ''), and Cloudflare Pages itself is
// static-only with no knowledge of Base44's API, so without this every /api/* call
// would 405 (POST) or silently fall back to index.html (GET).
//
// NOTE: Base44's GitHub integration auto-relocates anything under /functions into
// base44/functions/ on its own commits ("Migrate functions to base44/functions/
// directory") since it scans that folder name for its own serverless functions.
// Cloudflare Pages requires this exact file at functions/api/[[path]].js to work,
// so if it goes missing again after a Base44 auto-sync commit, restore it from
// base44/functions/api/[[path]]/entry.ts (same content, different required path).
//
// Sign-in, sign-up and password-reset calls are counted on the way through, so password
// or code guessing and repeated emails are refused with a 429 (cloudflare-lib/authlimit.js).
// The entry.ts copy above predates this: if you restore from it, add the authLimit import
// and call back (scripts/test-authlimit.mjs fails without them).
import { authLimit } from "../../cloudflare-lib/authlimit.js";
import { handleEntities } from "../../cloudflare-lib/db.js";
import { handleAuth, sessionUser, logout, googleStart, googleCallback } from "../../cloudflare-lib/auth.js";

const APP_ID = "6a8b5eb7787b8a4d6a18f662";
const jsonRes = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-content-type-options": "nosniff", "cache-control": "no-store" } });

// -> a Response for the calls Nebulux answers itself, or null to pass it on to Base44.
async function ownBackend(context, path, url) {
  const { request, env } = context;
  const db = env.DB;
  const safeBack = (to) => {
    try {
      const u = new URL(to || "/", url.origin);
      return u.origin === url.origin ? u.pathname + u.search : "/";
    } catch {
      return "/";
    }
  };
  if (path === "apps/auth/logout") {
    await logout(db, request);
    return Response.redirect(url.origin + safeBack(url.searchParams.get("from_url")), 302);
  }
  // "Continue with Google" (cloudflare-lib/auth.js). apps/auth/login is where the Base44 SDK's
  // loginWithProvider("google") sends people.
  if (path === "apps/auth/login" || path === "apps/auth/google/start") return googleStart(env, request);
  if (path === "apps/auth/google/callback") return googleCallback(db, env, request);
  if (path.startsWith("apps/auth/")) return Response.redirect(url.origin + "/login", 302);
  if (path === `apps/public/prod/public-settings/by-id/${APP_ID}`) return jsonRes(200, { id: APP_ID, public_settings: {} });
  const prefix = `apps/${APP_ID}/`;
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length);
  const body = ["GET", "HEAD", "DELETE"].includes(request.method) ? null : await request.clone().json().catch(() => ({}));
  if (rest.startsWith("auth/")) {
    if (request.method !== "POST") return jsonRes(405, { message: "Not supported" });
    const r = await handleAuth(db, env, request, rest, body || {});
    return jsonRes(r.status, r.body);
  }
  if (rest.startsWith("entities/")) {
    const user = await sessionUser(db, request);
    const r = await handleEntities(db, user, request.method, rest, url.search, body);
    return jsonRes(r.status, r.body);
  }
  return null;
}

const BACKEND = "https://blackhole-ai.base44.app";

export async function onRequest(context) {
  const { request, params } = context;
  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const url = new URL(request.url);
  // nebuluxai.com/api itself (and /api/) is the Nebulux Platform page in the app, not an API call.
  if (!path && (request.method === "GET" || request.method === "HEAD") && context.env && context.env.ASSETS) {
    return context.env.ASSETS.fetch(new Request(new URL("/", url), request));
  }
  const target = `${BACKEND}/api/${path}${url.search}`;
  // Only Base44's API is reachable through here: a path that climbs out of /api/ (../), or
  // has a part that would once decoded (..%2f), is refused instead of fetching some other
  // page of that host and serving it as if it came from this site.
  const odd = (Array.isArray(params.path) ? params.path : [path]).some((seg) => {
    let d = String(seg);
    try {
      d = decodeURIComponent(d);
    } catch {
      return true;
    }
    return d === "." || d === ".." || /[/\\]/.test(d); // no API address has these in a part
  });
  if (odd || !new URL(target).pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  const limited = await authLimit(request, path);
  if (limited) return limited;

  // Nebulux's own database and sign-in (cloudflare-lib/db.js, auth.js) answer instead of Base44
  // once the DB binding (D1 "nebulux-db") is connected to this Pages project.
  const own = context.env && context.env.DB ? await ownBackend(context, path, url) : null;
  if (own) return own;
  // Nebulux doesn't use Base44 anymore: anything it doesn't answer itself is simply not found,
  // never quietly passed on to Base44. (Without the DB binding, the old pass-through below stays.)
  if (context.env && context.env.DB) return jsonRes(404, { message: "Not found" });

  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = !["GET", "HEAD"].includes(request.method);

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
  });

  const resHeaders = new Headers(res.headers);
  resHeaders.delete("content-encoding");
  resHeaders.delete("content-length");
  // The browser takes each answer as the type Base44 says it is, never guessing (a JSON
  // answer can't be treated as a page or a script). _headers doesn't cover function answers.
  resHeaders.set("x-content-type-options", "nosniff");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}
