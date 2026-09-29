// Shared by the Cloudflare Pages functions that publish and serve website/game HTML.
// Lives outside functions/ so Pages doesn't turn it into a route.
//
// Why KV: Base44 caps each entity string field at ~19.5 KB (and silently drops
// undeclared fields), and its file upload is metered against the monthly
// integration quota. So the full HTML goes into the PUBLISHED_HTML KV namespace
// (bound to the nebuluxai Pages project in the Cloudflare dashboard), and the
// Base44 entity's `html` field holds a short URL to /published/<kind>/<name>.
// Base44's get-site-html/get-game-html already fetch `html` when it's a URL, so
// every reader (designer, browser, games front, subdomain Worker) keeps working.
import { termsAccepted, TERMS_MESSAGE } from "./terms.js";
import { findCredentialForm } from "./phishing.js";
import { scanPage } from "./scan.js";
import { stripInjected } from "./injected.js";
import { allow, TOO_MANY } from "./ratelimit.js";
import { accountBlocked, BLOCKED_MESSAGE } from "./bans.js";

import { handleEntities } from "./db.js";
import { sessionUser } from "./auth.js";

// Set by functions/_middleware.js from the DB binding (D1 "nebulux-db") on every request.
let ownDb = null;
export function useOwnDb(db) {
  ownDb = db || null;
}

export const BACKEND = "https://blackhole-ai.base44.app";
export const APP_ID = "6a8b5eb7787b8a4d6a18f662";
// The pages.dev origin, not nebuluxai.com: that zone's bot protection answers
// Base44's server-side fetch in get-site-html with a "Just a moment..." challenge page.
export const PUBLIC_ORIGIN = "https://nebuluxai.pages.dev";
export const MAX_BYTES = 5 * 1024 * 1024;

export const ENTITY = { site: "PublishedSite", game: "PublishedGame" };

// Every function answer: JSON the browser must never take as a page or a script (_headers
// doesn't cover function answers).
export function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", "x-content-type-options": "nosniff" },
  });
}

export const kvKey = (kind, name) => `${kind}:${name}`;

// The maker's name as anyone can read it on a published page's record: a first name
// only, never an email address (the records are public and many users are kids).
// Names that would make a page look official ("by Blackhole", "by Admin") aren't shown.
export const OFFICIAL_SOUNDING = /nebulux|blackhole|black\s*hole|official|admin|staff|support|moderator|\bteam\b/i;
export function publicName(user) {
  const first = String((user && user.full_name) || "").trim().split(/\s+/)[0] || "";
  return first.includes("@") || OFFICIAL_SOUNDING.test(first) ? "" : first.slice(0, 40);
}

export const publishedUrl = (kind, name) => `${PUBLIC_ORIGIN}/published/${kind}/${encodeURIComponent(name)}?v=${Date.now()}`;

// Calls Base44's REST API, as the user who made `request` when it carries a token.
export async function base44(request, method, path, body) {
  // Nebulux's own database (cloudflare-lib/db.js) once it's connected, with the same rules.
  if (ownDb && path.startsWith("entities/")) {
    const user = await sessionUser(ownDb, request);
    const [p, search] = path.split("?");
    const r = await handleEntities(ownDb, user, method, p, search ? "?" + search : "", body);
    if (r.status >= 400) {
      const err = new Error(r.body && r.body.message);
      err.status = r.status;
      throw err;
    }
    return r.body;
  }
  const headers = { "X-App-Id": APP_ID, "content-type": "application/json" };
  const auth = request && request.headers.get("authorization");
  if (auth) headers.authorization = auth;
  const res = await fetch(`${BACKEND}/api/apps/${APP_ID}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.detail || data.error)) || text || `Base44 returned ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function findByName(request, kind, name) {
  const rows = await base44(request, "GET", `entities/${ENTITY[kind]}?q=${encodeURIComponent(JSON.stringify({ name }))}`);
  return Array.isArray(rows) ? rows : [];
}

// Names are checked here, not just in the app, since anyone can call this directly. Site
// names become web addresses (name.nebuluxai.com), so they're letters, digits and
// hyphens only: "evil.com#" would otherwise make an address that's really evil.com. Games live
// inside the app, and their names may also have dots ("shooter.io"). Same reserved words as the
// designer. -> an error message, or "".
const SITE_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const GAME_NAME = /^[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/;
const RESERVED = ["home", "www", "admin", "api", "mail", "infinity", "ai", "app", "login", "register", "support", "blog"];
// Keep BUILT_IN_GAME_NAMES in step with src/lib/builtInGames.js (scripts/test-plays.mjs checks).
export const BUILT_IN_GAME_NAMES = ["veck", "pulse"];
const GAME_RESERVED = ["game", "games", ...BUILT_IN_GAME_NAMES];
export function badName(kind, name) {
  if (!(kind === "site" ? SITE_NAME : GAME_NAME).test(name)) {
    return kind === "site"
      ? "Website names can only use letters, numbers and hyphens (like my-site)."
      : "Game names can only use letters, numbers, dots and hyphens.";
  }
  if (kind === "site" && RESERVED.includes(name)) return "That name is taken. Try another.";
  // Games: the same words, and the names of the games built into the app, so nobody can publish
  // a game that takes a built-in one's place in the lists.
  if (kind === "game" && (RESERVED.includes(name) || GAME_RESERVED.includes(name))) return "That name is taken. Try another.";
  return "";
}

// New site names that would look like one of our own pages at name.nebuluxai.com
// ("blackhole-login", "secure-billing", "verify-account") are refused: those are what a fake
// sign-in or payment page would use. Only for names nobody has yet, so existing sites keep
// working and their owners can still republish.
const OFFICIAL_WORDS = "login|log-in|signin|sign-in|signup|sign-up|verify|verification|secure|billing|payment|payments|support|official|admin|account|password|wallet|paypal";
const LOOKS_OFFICIAL = new RegExp(`blackhole|^(${OFFICIAL_WORDS})(-|$)|-(${OFFICIAL_WORDS})$`);
export const looksOfficial = (name) => LOOKS_OFFICIAL.test(String(name || ""));

// Who owns a published name. Anyone signed in can write their own PublishedSite/PublishedGame
// rows straight into Base44, so "there's a row of mine with this name" proves nothing. The
// owner is whoever publish() recorded with the stored page, while they still have a row for
// it; otherwise the creator of the oldest row (a copycat's row always comes later).
// `rows` can be passed when the caller already has them. -> a user id, or null if unused.
export async function ownerOf(request, kv, kind, name, rows) {
  const all = (rows || (await findByName(request, kind, name))).slice();
  let recorded = null;
  if (kv && kv.getWithMetadata) {
    const r = await kv.getWithMetadata(kvKey(kind, name)).catch(() => null);
    recorded = (r && r.value != null && r.metadata && r.metadata.owner) || null;
  }
  if (recorded && all.some((r) => r.created_by_id === recorded)) return recorded;
  all.sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")));
  return all.length ? all[0].created_by_id || null : null;
}

// The whole publish flow for both kinds; `extra` holds the kind-specific entity fields.
// `checkLimit(user)` (optional) -> an error message when a page that's new to this person
// would go over their plan's limit (see functions/.../publish-site.js).
export async function publish(context, kind, { name, html: rawHtml, extra, checkLimit }) {
  const { request, env } = context;
  const html = stripInjected(rawHtml);
  const label = kind === "site" ? "Website" : "Game";
  try {
    if (!env.PUBLISHED_HTML) {
      return json({ error: "Publishing storage isn't set up on this deployment (missing PUBLISHED_HTML KV binding)." }, 500);
    }
    let user;
    try {
      user = await base44(request, "GET", "entities/User/me");
    } catch {
      user = null;
    }
    if (!user || !user.id) return json({ error: "Please sign in to publish." }, 401);
    if (await accountBlocked(env.PUBLISHED_HTML, user)) return json({ error: BLOCKED_MESSAGE }, 403);
    if (!(await termsAccepted(env.PUBLISHED_HTML, user))) return json({ error: TERMS_MESSAGE }, 403);
    if (user.role !== "admin" && !(await allow(`publish:${user.id}`, 30, 3600))) return json({ error: TOO_MANY }, 429);
    if (!name || !html) return json({ error: "name and html required" }, 400);
    const nameError = badName(kind, name);
    if (nameError) return json({ error: nameError }, 400);
    if (new TextEncoder().encode(html).length > MAX_BYTES) {
      return json({ error: `${label} is too large (over 5 MB). Make it smaller.` }, 413);
    }

    const phishing = findCredentialForm(html);
    if (phishing) {
      return json(
        {
          error: `This ${label.toLowerCase()} has ${phishing}. Pages here can't send passwords or card numbers to other websites — remove that form (use Buy Now buttons for payments).`,
        },
        422
      );
    }

    // Kid-safety check: refuse the worst pages up front instead of waiting for a report.
    // Admins can still publish (e.g. to restore a false positive).
    const scan = scanPage(html);
    if (scan.block.length && user.role !== "admin") {
      return json(
        {
          error: `This ${label.toLowerCase()} can't be published because it has ${scan.block.join(", ")}. Nebulux AI is used by kids, so pages must be safe for everyone — ask the AI to remove that part and try again.`,
        },
        422
      );
    }

    // Taken down by an admin (see reports.js): only an admin can put it back.
    if (user.role !== "admin" && (await env.PUBLISHED_HTML.get(`blocked:${kvKey(kind, name)}`)) != null) {
      return json({ error: `This ${label.toLowerCase()} was removed for breaking the rules and can't be published again.` }, 403);
    }

    const rows = await findByName(request, kind, name);
    const mine = rows.find((r) => r.created_by_id === user.id);
    // Having a row with this name isn't enough (rows can be written straight into Base44):
    // the name must be free or yours (see ownerOf).
    if (kind === "site" && !rows.length && user.role !== "admin" && looksOfficial(name)) {
      return json({ error: "That name looks like one of Nebulux AI's own pages, so it isn't allowed. Try another." }, 400);
    }
    const owner = await ownerOf(request, env.PUBLISHED_HTML, kind, name, rows);
    if (owner && owner !== user.id && user.role !== "admin") {
      return json({ error: "That name is taken. Try another." }, 409);
    }
    // Websites and games share one set of web addresses (name.nebuluxai.com), so a name used by
    // someone else's game can't be a website, and the other way round.
    const other = kind === "site" ? "game" : "site";
    const otherRows = await findByName(request, other, name).catch(() => []);
    if (otherRows.some((r) => r.created_by_id !== user.id) && user.role !== "admin") {
      return json({ error: `That name is used by a ${other === "game" ? "game" : "website"}. Try another.` }, 409);
    }

    // Plan limits, for a page that's new to this person (republishing your own never counts).
    if (checkLimit && user.role !== "admin" && owner !== user.id && !mine) {
      const limit = await checkLimit(user);
      if (limit) return json({ error: limit }, 403);
    }

    // An admin publishing over someone else's page (say, to restore it) keeps them as the
    // owner and updates their record, so the page stays theirs and stays online.
    const keeper = owner && owner !== user.id ? owner : user.id;
    await env.PUBLISHED_HTML.put(kvKey(kind, name), html, {
      metadata: { owner: keeper, updated: new Date().toISOString() },
    });

    const ownersRow = rows.find((r) => r.created_by_id === keeper);
    const data = { ...extra, ownerName: keeper === user.id ? publicName(user) : (ownersRow && ownersRow.ownerName) || "", html: publishedUrl(kind, name), hidden: false };
    const target = ownersRow || mine || rows[0];
    const rec = target
      ? await base44(request, "PUT", `entities/${ENTITY[kind]}/${target.id}`, data)
      : await base44(request, "POST", `entities/${ENTITY[kind]}`, { ...data, name });
    return json({ ok: true, id: (rec && rec.id) || (target && target.id), republished: !!target });
  } catch (err) {
    const status = err && err.status >= 400 && err.status < 500 ? err.status : 500;
    return json({ error: (err && err.message) || "Could not publish." }, status);
  }
}
