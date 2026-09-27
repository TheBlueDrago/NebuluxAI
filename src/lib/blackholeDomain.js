import { familySafeHost } from "../../cloudflare-lib/familysafe.js";

export const BLACKHOLE_TLD = ".nebuluxai.com";

// Game genre → address ending. A shooter called "shooter.io" lives at shooter.io.shooter.
export const GAME_TLDS = {
  io: "io",
  shooting: "shooter",
  horror: "horror",
  action: "action",
  arcade: "arcade",
  puzzle: "puzzle",
  racing: "racing",
  sports: "sports",
  adventure: "adventure",
  strategy: "strategy",
};

// Every published website lives at <name>.nebuluxai.com — the ending is fixed, only the name is chosen.
export const domainOf = (name) => `${(name || "your-site").toLowerCase()}${BLACKHOLE_TLD}`;

export const gameDomainOf = (name, genre) => `${(name || "my-game").toLowerCase()}.${GAME_TLDS[genre] || "game"}`;

export const cleanAddress = (q) =>
  (q || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

// Resolve what was typed into the address bar to a site or a game, or null for a plain search.
export function resolveAddress(q, sites = [], games = []) {
  const a = cleanAddress(q);
  if (!a) return null;
  const site = sites.find((s) => domainOf(s.name) === a || s.name === a);
  if (site) return { kind: "site", item: site };
  const game = games.find((g) => gameDomainOf(g.name, g.genre) === a || g.name === a);
  if (game) return { kind: "game", item: game };
  return null;
}
// A published site's real address, or "" if the name isn't a valid site name (letters,
// digits and hyphens). Names can come from a link or from a record anyone could write, and
// one like "evil.com#" would otherwise make https://evil.com#.nebuluxai.com, which is
// really evil.com dressed up as one of ours.
export const SITE_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const siteUrl = (name) => {
  const n = String(name || "").toLowerCase();
  return SITE_NAME.test(n) ? `https://${n}.nebuluxai.com` : "";
};

// The maker's name to show next to a site or game. Records can be written straight into the
// database, so a name that would make a page look official ("Nebulux AI", "Admin") or an
// email address is replaced with a neutral one. Same rule as publicName in published.js.
const OFFICIAL_SOUNDING = /nebulux|blackhole|black\s*hole|official|admin|staff|support|moderator|\bteam\b/i;
export const makerName = (name) => {
  const n = String(name || "").trim().slice(0, 40);
  return !n || n.includes("@") || OFFICIAL_SOUNDING.test(n) ? "" : n;
};

// Only real web addresses, for the Blackhole Browser's web view. The address comes from the
// page's own link (?weburl=), so anyone could send a link carrying "javascript:…", which in
// an iframe (or a link) runs inside the app with the viewer's sign-in.
// -> the cleaned address, or "" if it isn't http(s).
// True for an address Blackhole Browser won't show because kids use it (adult, gambling or
// piracy sites; cloudflare-lib/familysafe.js). Only the site's name is checked.
export function notForKids(url) {
  try {
    return !familySafeHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function safeWebUrl(raw) {
  try {
    const u = new URL(String(raw || "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}
