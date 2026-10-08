// Offline guard for the Cloudflare functions (functions/api/apps/<app>/functions/*.js): every
// one either checks who's signed in, or is on the short list of endpoints that are public on
// purpose; admin endpoints check the admin role on the server. A new endpoint that forgets
// fails here until it does (or is added below with a reason).
// Run: node scripts/test-endpoints.mjs
import { readdirSync, readFileSync } from "node:fs";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const dir = new URL("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/", import.meta.url);

// Public on purpose, and why.
const PUBLIC = {
  status: "the public status page: AI answer totals only",
  "client-error": "crash reports from browsers (rate limited; listing is admin-only)",
  "check-email": "sign-up asks whether an email is free before an account exists (rate-limited per network)",
  "game-plays": "play counts and taken-down games for the public game lists",
  "get-site-html": "serves published sites to anyone",
  "page-status": "whether a page was taken down, for game views and Base44's checkout",
  "taken-down": "names of taken-down pages for public lists",
};
// Admin-only endpoints (by name), and ones that also offer admin-only actions.
const ADMIN = ["admin-content", "admin-credits", "admin-grant", "admin-log", "admin-reports", "manage-promos", "userActivity"];

const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
assert(files.length >= 30, `found the functions (${files.length})`);
for (const f of files) {
  const name = f.replace(/\.js$/, "");
  const src = readFileSync(new URL(f, dir), "utf8");
  const signsIn = /currentUser\(|publish\(context/.test(src);
  if (PUBLIC[name]) {
    assert(true, `${name} is public: ${PUBLIC[name]}`);
    continue;
  }
  assert(signsIn, `${name} checks who's signed in`);
  if (ADMIN.includes(name)) assert(/role !== "admin"|role === "admin"/.test(src), `${name} checks the admin role on the server`);
}
for (const name of [...Object.keys(PUBLIC), ...ADMIN]) assert(files.includes(`${name}.js`), `${name} still exists (keep these lists current)`);

// Function answers can't be taken as a page or a script by the browser (_headers doesn't
// cover them): the shared json() helper sets nosniff.
{
  const { json } = await import(new URL("../cloudflare-lib/published.js", import.meta.url).href);
  const r = json({ ok: true }, 201);
  assert(r.status === 201 && r.headers.get("content-type") === "application/json" && r.headers.get("x-content-type-options") === "nosniff", "function answers are JSON with nosniff");
}
