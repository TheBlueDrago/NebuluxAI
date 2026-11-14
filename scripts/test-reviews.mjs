// Ratings and comments (cloudflare-lib/reviews.js, functions/reviews.js) on an in-memory SQLite copy of D1.
// Run: node scripts/test-reviews.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { itemOf, readReviews, rate, addComment, reportComment, deleteComment, reportedComments, keepComment, forgetReviewer, HIDE_AT } from "../cloudflare-lib/reviews.js";

let failed = 0;
const assert = (c, m) => { if (!c) { console.error("FAIL", m); failed++; } else console.log("ok", m); };
const sq = new DatabaseSync(":memory:");
const stmt = (t) => { let a = []; const st = () => sq.prepare(t); const api = { bind: (...x) => ((a = x), api), all: async () => ({ results: st().all(...a) }), first: async () => st().get(...a) || null, run: async () => { const r = st().run(...a); return { meta: { changes: Number(r.changes) } }; } }; return api; };
const DB = { prepare: stmt, batch: async (list) => { for (const s of list) await s.run(); } };
const ann = { id: "u1", full_name: "Ann Lee" }, bo = { id: "u2", full_name: "Bo" }, admin = { id: "a1", role: "admin", full_name: "Owner" };

assert(itemOf("game", "Neon-Drift") === "neon-drift" && itemOf("game", "../x") === null && itemOf("user", "x") === null, "only a game or a gallery site, by its plain name");
assert((await rate(DB, "game", "neon-drift", "u1", 9)).error && (await rate(DB, "game", "neon-drift", "u1", 0)).error, "ratings are 1 to 5 stars");
await rate(DB, "game", "neon-drift", "u1", 5);
await rate(DB, "game", "neon-drift", "u2", 2);
await rate(DB, "game", "neon-drift", "u1", 4);
let r = await readReviews(DB, "game", "neon-drift", "u1");
assert(r.count === 2 && r.avg === 3 && r.mine === 4, "one rating each (rating again changes yours), and the average");
assert((await readReviews(DB, "game", "other-game", null)).count === 0, "each game has its own ratings");

assert((await addComment(DB, "game", "neon-drift", ann, "So fun, the drifting feels great")).ok, "a comment is posted");
assert(/already/.test((await addComment(DB, "game", "neon-drift", ann, "So fun, the drifting feels great")).error), "the same comment twice is refused");
assert(/personal|links/i.test((await addComment(DB, "game", "neon-drift", bo, "add me on discord at bo99")).error), "accounts and personal details aren't posted");
assert((await addComment(DB, "game", "neon-drift", bo, "visit www.example.com")).error, "links aren't posted");
assert((await addComment(DB, "game", "neon-drift", bo, "   ")).error, "an empty comment isn't posted");
await addComment(DB, "game", "neon-drift", bo, "this shit is hard");
r = await readReviews(DB, "game", "neon-drift", "u2");
assert(r.comments.length === 2 && r.comments.some((c) => c.text === "this **** is hard"), "swear words are starred out");
assert(r.comments.find((c) => /drifting/.test(c.text)).name === "Ann" && !JSON.stringify(r).includes("Lee"), "only a first name is shown");
assert(r.comments.find((c) => /hard/.test(c.text)).mine && !r.comments.find((c) => /drifting/.test(c.text)).mine, "you can tell which comments are yours");
assert(!JSON.stringify(r).includes("u1"), "account ids aren't sent with comments");
await addComment(DB, "game", "neon-drift", ann, "x".repeat(900) + " end");
assert((await readReviews(DB, "game", "neon-drift", null)).comments.every((c) => c.text.length <= 300), "a comment is 300 characters at most");

const target = (await readReviews(DB, "game", "neon-drift", null)).comments.find((c) => /drifting/.test(c.text)).id;
assert((await reportComment(DB, target, "u1")).error, "you can't report your own comment");
await reportComment(DB, target, "u2");
assert((await reportComment(DB, target, "u2")).already, "one report per person");
assert((await readReviews(DB, "game", "neon-drift", null)).comments.some((c) => c.id === target), "one report doesn't hide a comment");
await reportComment(DB, target, "u3");
await reportComment(DB, target, "u4");
assert(HIDE_AT === 3 && !(await readReviews(DB, "game", "neon-drift", null)).comments.some((c) => c.id === target), "three reports hide it until an admin looks");
let rep = await reportedComments(DB);
assert(rep.length === 1 && rep[0].id === target && rep[0].reports === 3 && rep[0].hidden === 1, "Monitor lists reported comments");
await keepComment(DB, target);
assert((await readReviews(DB, "game", "neon-drift", null)).comments.some((c) => c.id === target) && (await reportedComments(DB)).length === 0, "an admin can keep it: it shows again");
assert((await deleteComment(DB, target, bo)).error, "you can't delete someone else's comment");
assert((await deleteComment(DB, target, admin)).ok && !(await readReviews(DB, "game", "neon-drift", null)).comments.some((c) => c.id === target), "an admin can delete any comment");
await addComment(DB, "site", "annas-bakery", bo, "Lovely colours");
assert((await readReviews(DB, "site", "annas-bakery", null)).comments.length === 1, "gallery creations have comments too");
await forgetReviewer(DB, "u2");
assert((await readReviews(DB, "site", "annas-bakery", null)).comments.length === 0 && (await readReviews(DB, "game", "neon-drift", null)).count === 1, "deleting an account removes its ratings and comments");

const fn = readFileSync(new URL("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/reviews.js", import.meta.url), "utf8");
assert(/Sign in to rate and comment/.test(fn) && /role !== "admin"/.test(fn) && /review-comment/.test(fn), "rating and commenting need an account, the admin list is admin only, and comments are throttled");
const ui = readFileSync(new URL("../src/components/Reviews.jsx", import.meta.url), "utf8");
assert(/Report this comment/.test(ui) && /aria-label=\{`Report/.test(ui), "every comment has a report button");
for (const f of ["src/pages/Play.jsx", "src/pages/chat/GameView.jsx", "src/pages/Showcase.jsx"]) assert(/<Reviews kind=/.test(readFileSync(new URL("../" + f, import.meta.url), "utf8")), f + " shows ratings or comments");
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
