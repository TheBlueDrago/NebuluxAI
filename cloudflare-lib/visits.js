// Privacy-friendly visit counts for Nebulux AI and Nebulux Orbit (D1 table site_hits, in the shared
// database). Only numbers are kept: for each day and page, how many times it was opened and by how many
// visitors' first page of a visit. No cookies, no internet addresses, no device details, nothing about a
// person. The browser says "this is the first page of this visit" itself (a flag in its own tab storage),
// so the server never has to recognise anyone.
//
// Steps people take ("@signup-open", "@play:neon-drift") are counted the same way, which is what the
// "where people stop" view is made from. Monitor reads it all through hitStats (functions/visit.js).
let ready = false;
export async function ensureVisits(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS site_hits (site TEXT NOT NULL, day TEXT NOT NULL, path TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, uniq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (site, day, path))").run();
  ready = true;
}
export const SITES = ["ai", "orbit"];
// The steps each site counts, in order, for "where people stop".
export const FUNNELS = {
  ai: [["visitors", "Visited"], ["@signup-open", "Opened sign-up"], ["@signup-done", "Made an account"], ["@first-message", "Sent a first message"]],
  orbit: [["visitors", "Visited"], ["@demo-chat", "Tried the sample chat"], ["@signup-open", "Opened sign-up"], ["@signup-done", "Made an account"], ["@first-message", "Sent a first message"]],
};
const STEP = /^@[a-z][a-z-]{1,30}(:[a-z0-9][a-z0-9-]{0,50})?$/;
// A page's address without anything that could name a person or a private thing: no query, no ids.
export function cleanPath(raw) {
  let p = String(raw || "").slice(0, 200);
  if (STEP.test(p)) return p;
  if (p[0] !== "/") return null;
  p = p.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, "") || "/";
  if (/^\/chat(\/|$)/.test(p)) {
    const m = /^\/chat\/(arcade|platform|settings|templates|showcase|game|site)\b/.exec(p);
    return m ? "/chat/" + m[1] : "/chat";
  }
  if (/^\/(published|site|s|share|reset-password|oauth|promo-success|__)/.test(p)) return null;
  if (!/^\/[a-z0-9\-_/.]{0,80}$/.test(p)) return "/other";
  if (p.split("/").length > 4) return "/" + p.split("/").slice(1, 3).join("/");
  return p;
}
export async function recordHit(db, site, raw, first, now = Date.now()) {
  if (!SITES.includes(site)) return false;
  const path = cleanPath(raw);
  if (!path) return false;
  await ensureVisits(db);
  const day = new Date(now).toISOString().slice(0, 10);
  await db.prepare("INSERT INTO site_hits (site, day, path, n, uniq) VALUES (?, ?, ?, 1, ?) ON CONFLICT (site, day, path) DO UPDATE SET n = n + 1, uniq = uniq + excluded.uniq").bind(site, day, path, first ? 1 : 0).run();
  return true;
}
// { days: [{ day, views, visitors }], pages: [{ path, views }], games: [{ id, plays }], funnel: [{ label, n }] } for the last `span` days.
export async function hitStats(db, site, span = 14, now = Date.now()) {
  await ensureVisits(db);
  const from = new Date(now - (span - 1) * 86400000).toISOString().slice(0, 10);
  const rows = (await db.prepare("SELECT day, path, n, uniq FROM site_hits WHERE site = ? AND day >= ?").bind(site, from).all()).results || [];
  const days = {}, pages = {}, steps = {}, games = {};
  for (let i = 0; i < span; i++) days[new Date(now - (span - 1 - i) * 86400000).toISOString().slice(0, 10)] = { views: 0, visitors: 0 };
  let visitors = 0;
  for (const r of rows) {
    if (r.path[0] === "@") {
      steps[r.path.split(":")[0]] = (steps[r.path.split(":")[0]] || 0) + r.n;
      if (r.path.startsWith("@play:")) games[r.path.slice(6)] = (games[r.path.slice(6)] || 0) + r.n;
      continue;
    }
    if (days[r.day]) { days[r.day].views += r.n; days[r.day].visitors += r.uniq; }
    pages[r.path] = (pages[r.path] || 0) + r.n;
    visitors += r.uniq;
  }
  const top = (o, k, v) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([a, b]) => ({ [k]: a, [v]: b }));
  return {
    days: Object.entries(days).map(([day, d]) => ({ day, ...d })),
    pages: top(pages, "path", "views"),
    games: top(games, "id", "plays"),
    funnel: (FUNNELS[site] || []).map(([key, label]) => ({ label, n: key === "visitors" ? visitors : steps[key] || 0 })),
  };
}
