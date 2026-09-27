// How many games a plan can publish per month, and how many websites it can keep in total.
// Deleting frees a slot, since limits are counted from what currently exists. Shared by the
// app (src/lib/publishLimits.js re-exports it) and the publish functions, which enforce it:
// anyone can call those directly, so the app's own check isn't enough.
// Games: no limit on any plan (owner, 2026-09-27).
const GAME_LIMITS = { free: Infinity, pro: Infinity, team: Infinity, secret: Infinity, enterprise: Infinity, admin: Infinity };
const SITE_LIMITS = { free: 3, pro: 3, team: 3, secret: 5, enterprise: 10, admin: 10 };

export const gameLimit = (plan) => GAME_LIMITS[plan] ?? Infinity;
export const siteLimit = (plan) => SITE_LIMITS[plan] ?? 3;

// Same months the credits use (UTC), so everyone's new-game allowance resets together.
export const sameMonth = (date, now = new Date()) => {
  if (!date) return false;
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(String(date)) ? date : `${date}Z`);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
};

// -> the message to show when publishing one more `kind` would go over `plan`'s limit, or "".
// `owned` is the person's own PublishedSite / PublishedGame rows. Same wording as the app.
export function limitError(kind, plan, owned, now = new Date()) {
  const rows = Array.isArray(owned) ? owned : [];
  if (kind === "site") {
    const lim = siteLimit(plan);
    return rows.length >= lim ? `Your ${plan} plan allows ${lim} website${lim === 1 ? "" : "s"}. Delete one in Settings → Published Websites or upgrade.` : "";
  }
  const lim = gameLimit(plan);
  const used = rows.filter((g) => sameMonth(g.created_date, now)).length;
  return used >= lim ? `Your ${plan} plan allows ${lim} new game${lim === 1 ? "" : "s"} per month. Delete one in Settings → Published Games or upgrade.` : "";
}
