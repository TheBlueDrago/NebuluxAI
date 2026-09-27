// Enterprise plan applications (the /enterprise page and Monitor → Enterprise).
// Enterprise is only for registered organizations, so people apply with the business's
// legal details, an admin checks them (e.g. in the state's business registry) and, once
// the organization has paid, activates the plan with its number of seats.
//
//   enterprise:apps -> [{ id, userId, accountEmail, status, org..., at, updatedAt, note }]
//
// status: "new" (waiting for review) → "approved" / "rejected" → "active" (plan on).
import { PLAN_TOTALS, TIERS } from "./credits.js";
import { offerFor, DISCOUNT_PCT } from "./offers.js";

const KEY = "enterprise:apps";
const MAX_APPS = 300;
// US dollars a seat a month: $30, $25 from 10 seats, $20 from 25 (owner's prices, 2026-09-27).
export const PRICE_PER_SEAT = 30;
export const SEAT_TIERS = [
  { from: 25, price: 20 },
  { from: 10, price: 25 },
  { from: 1, price: 30 },
];
export const seatPrice = (seats) => (SEAT_TIERS.find((t) => seats >= t.from) || SEAT_TIERS[SEAT_TIERS.length - 1]).price;
export const ENTITY_TYPES = {
  llc: "LLC",
  corporation: "Corporation (Inc., Corp.)",
  partnership: "Partnership (LP, LLP)",
  nonprofit: "Nonprofit",
  other: "Other registered business",
};
export const STATUSES = ["new", "approved", "rejected", "active"];
const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|mail|zoho|yandex)\./i;

const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const domainOf = (url) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

// Checks and tidies what the applicant sent. -> { app } or { error }
export function validateApplication(body) {
  const app = {
    orgName: clip(body.orgName, 120),
    entityType: String(body.entityType || ""),
    region: clip(body.region, 80),
    regNumber: clip(body.regNumber, 40),
    website: clip(body.website, 200),
    contactName: clip(body.contactName, 80),
    role: clip(body.role, 80),
    workEmail: clip(body.workEmail, 200).toLowerCase(),
    phone: clip(body.phone, 30),
    seats: Math.trunc(Number(body.seats)),
    useCase: clip(body.useCase, 2000),
  };
  if (app.orgName.length < 2) return { error: "Enter your organization's legal name." };
  if (!ENTITY_TYPES[app.entityType]) return { error: "Choose what kind of organization it is." };
  if (app.region.length < 2) return { error: "Enter the state or country where it's registered." };
  if (!/^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,39}$/.test(app.regNumber)) return { error: "Enter the registration number or EIN." };
  if (app.website && !domainOf(app.website)) return { error: "That website address doesn't look right." };
  if (app.contactName.length < 2) return { error: "Enter your name." };
  if (!app.role) return { error: "Enter your role in the organization." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.workEmail)) return { error: "Enter your work email." };
  if (app.phone && !/^[+()\d][\d\s().+-]{6,29}$/.test(app.phone)) return { error: "That phone number doesn't look right." };
  if (!Number.isFinite(app.seats) || app.seats < 2 || app.seats > 10000) return { error: "Enter how many people will use it (at least 2)." };
  if (body.confirm !== true) return { error: "Please confirm the organization is legally registered." };
  return { app };
}

// What an admin sees next to an application: the monthly price and the shared pool of credits it gives,
// plus hints worth a closer look.
// discountPct: the new-member discount, when the application was sent in its 48 hours.
export function quoteFor(seats, discountPct = 0) {
  const credits = {};
  for (const t of TIERS) credits[t] = PLAN_TOTALS.enterprise[t] * seats;
  const perSeat = Math.round(seatPrice(seats) * (100 - discountPct)) / 100;
  return { seats, pricePerSeat: perSeat, monthly: Math.round(seats * perSeat * 100) / 100, credits, discountPct };
}
export function warningsFor(app) {
  const w = [];
  if (FREE_MAIL.test(app.workEmail)) w.push("Uses a personal email address, not a company one");
  const site = domainOf(app.website);
  const mail = app.workEmail.split("@")[1] || "";
  if (!app.website) w.push("No company website given");
  else if (site && mail && !FREE_MAIL.test(app.workEmail) && !mail.endsWith(site) && !site.endsWith(mail)) w.push("Email domain doesn't match the website");
  return w;
}

export async function readApps(kv) {
  try {
    const v = await kv.get(KEY, "json");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const saveApps = (kv, apps) => kv.put(KEY, JSON.stringify(apps.slice(0, MAX_APPS)));

export const appOf = (apps, userId) => apps.find((a) => a.userId === userId) || null;

// One application per account; a new or rejected one can be sent again with changes.
export async function submitApplication(kv, user, app) {
  const apps = await readApps(kv);
  const mine = appOf(apps, user.id);
  if (mine && (mine.status === "approved" || mine.status === "active")) {
    throw new Error("Your organization is already approved. We'll be in touch by email.");
  }
  const now = new Date().toISOString();
  // Sent during the account's 48-hour new-member offer: quoted with its discount.
  const offer = offerFor(user);
  if (offer && offer.discountActive) app.discountPct = DISCOUNT_PCT;
  const rec = { ...(mine || {}), ...app, id: (mine && mine.id) || crypto.randomUUID(), userId: user.id, accountEmail: String(user.email || ""), status: "new", at: (mine && mine.at) || now, updatedAt: now };
  await saveApps(kv, [rec, ...apps.filter((a) => a.userId !== user.id)]);
  return rec;
}

export async function updateApplication(kv, id, patch) {
  const apps = await readApps(kv);
  const rec = apps.find((a) => a.id === id);
  if (!rec) throw new Error("Application not found.");
  Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
  await saveApps(kv, apps);
  return rec;
}

// The applicant's own view: no admin notes.
export const publicView = (a) => a && { status: a.status, orgName: a.orgName, seats: a.seats, at: a.at };
