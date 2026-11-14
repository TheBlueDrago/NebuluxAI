// Visit counts (cloudflare-lib/visits.js, functions/visit.js): numbers only, on an in-memory SQLite copy of D1.
// Run: node scripts/test-visits.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { recordHit, hitStats, cleanPath } from "../cloudflare-lib/visits.js";

let failed = 0;
const assert = (c, m) => { if (!c) { console.error("FAIL", m); failed++; } else console.log("ok", m); };
const sq = new DatabaseSync(":memory:");
const DB = { prepare(t) { const st = sq.prepare(t); let a = []; const api = { bind: (...x) => ((a = x), api), all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) || null, run: async () => st.run(...a) }; return api; } };

assert(cleanPath("/Pricing/?ref=abc#x") === "/pricing", "a page is counted without its query or hash");
assert(cleanPath("/chat/c/9f8a7b6c5d") === "/chat" && cleanPath("/chat/arcade") === "/chat/arcade", "chat addresses (which carry ids) are counted as one page");
assert(cleanPath("/published/annas-bakery") === null && cleanPath("/reset-password") === null, "people's own sites and private pages aren't counted");
assert(cleanPath("/a b<script>") === "/other" && cleanPath("javascript:1") === null, "odd addresses can't put text in the table");
assert(cleanPath("@signup-open") === "@signup-open" && cleanPath("@x y") === null, "a step has a fixed shape");

const now = Date.parse("2026-11-14T12:00:00Z"), DAY = 86400000;
await recordHit(DB, "ai", "/", true, now);
await recordHit(DB, "ai", "/pricing", false, now);
await recordHit(DB, "ai", "/pricing", false, now);
await recordHit(DB, "ai", "/pricing", false, now);
await recordHit(DB, "ai", "/", true, now - DAY);
await recordHit(DB, "ai", "/", true, now - 20 * DAY);
await recordHit(DB, "ai", "@signup-open", false, now);
await recordHit(DB, "orbit", "/", true, now);
assert((await recordHit(DB, "elsewhere", "/", true, now)) === false, "only our own sites are counted");
const s = await hitStats(DB, "ai", 14, now);
assert(s.days.length === 14 && s.days[13].visitors === 1 && s.days[13].views === 4 && s.days[12].visitors === 1, "visitors and pages opened, by day");
assert(s.pages[0].path === "/pricing" && s.pages[0].views === 3, "the most opened page is first");
assert(s.funnel[0].n === 2 && s.funnel[1].label === "Opened sign-up" && s.funnel[1].n === 1 && s.funnel[2].n === 0, "where people stop: visited, opened sign-up, made an account");
assert((await hitStats(DB, "orbit", 14, now)).funnel[0].n === 1, "Orbit is counted apart");
const cols = sq.prepare("PRAGMA table_info(site_hits)").all().map((c) => c.name).join(",");
assert(cols === "site,day,path,n,uniq", "the table holds counts and nothing about a person");

// the endpoint: anyone can add a count, only admins read them, crawlers aren't visitors
const src = readFileSync(new URL("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/visit.js", import.meta.url), "utf8");
assert(/role !== "admin"/.test(src) && /BOT\.test/.test(src) && !/INSERT[^;]*ip/i.test(src), "stats are admin only, crawlers are skipped, and the address is never saved");
const client = readFileSync(new URL("../src/lib/visits.js", import.meta.url), "utf8");
assert(/doNotTrack === "1"/.test(client) && /globalPrivacyControl/.test(client) && !/document\.cookie/.test(client), "browsers asking not to be tracked aren't counted, and no cookie is used");
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
