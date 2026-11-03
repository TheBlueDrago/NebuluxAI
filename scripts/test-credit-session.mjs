// Offline test of Nebulux AI's usage limits, like Claude's (cloudflare-lib/creditSession.js; owner,
// 2026-11-03): one pool of tokens for every AI and chat with a 5-hour limit (100,000) and a weekly limit
// (1,000,000); a message uses tokens for what was typed, the reply and (at a quarter) its thinking, not
// the chat history; stronger AIs use more. On an in-memory SQLite stand-in for D1, with KV, Base44 and
// Google faked. Run: node scripts/test-credit-session.mjs
import { DatabaseSync } from "node:sqlite";
const R = new URL("../", import.meta.url).pathname;
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

// D1-shaped wrapper around node:sqlite
const sq = new DatabaseSync(":memory:");
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  first: async () => sq.prepare(q).get(...args) ?? null,
  all: async () => ({ results: sq.prepare(q).all(...args) }),
  run: async () => ({ meta: { changes: sq.prepare(q).run(...args).changes } }),
});
const db = { prepare: (q) => stmt(q) };

const S = await import(R + "cloudflare-lib/creditSession.js");
const L = S.limitsFor("free");
assert(L.session === 100000 && L.week === 1000000 && S.SESSION_HOURS === 5 && S.WEEK_DAYS === 7, "Free: 100,000 tokens per 5 hours and 1,000,000 per week");
assert(S.limitsFor("pro") === S.POOL_LIMITS.free && S.limitsFor("nope") === S.POOL_LIMITS.free, "until the owner sets the paid plans' limits, every plan has Free's");

// ---- what a message uses ----
const use = (o) => S.tokensUsed({ effort: "medium", tier: "ai", question: "", ...o });
assert(use({ tokens: { answer: 800, thinking: 0 } }) === 800, "the reply's tokens count");
assert(use({ tokens: { answer: 800, thinking: 6000 } }) === 2300, "thinking counts at a quarter (800 + 6,000/4 = 2,300)");
assert(use({ tokens: { answer: 800, thinking: 6000 } }) / L.session < 0.03, "an everyday medium-thinking reply is about 2% of the 5-hour limit (it was about 4 of the old 50 credits)");
assert(use({ question: "x".repeat(400), tokens: { answer: 100, thinking: 0 } }) === 200 && use({ question: "", images: 2, tokens: { answer: 100, thinking: 0 } }) === 100 + 2 * S.IMAGE_TOKENS, "what they typed counts (about 4 characters a token) and so do pictures");
const work = { tokens: { answer: 800, thinking: 6000 } };
const by = (tier) => use({ ...work, tier });
assert(by("ai") === 2300 && by("aiCode") === 3450 && by("galaxy5") === 4600 && by("space5") === 6900, `stronger AIs use more: Nebulux AI ${by("ai")}, Galaxy ${by("aiCode")}, Space ${by("galaxy5")}, Nebula ${by("space5")}`);
assert(use({ tokens: null, text: "x".repeat(4000), effort: "low" }) === 1125 && use({ tokens: null, text: "x".repeat(4000), effort: "high" }) === 2000, "without Google's counts, thinking is estimated from the reply's length and the effort");
assert(use({ tokens: { answer: 0, thinking: 0 }, text: "" }) === 1, "every message uses at least 1 token");
assert(S.maxCharsFor(10000, "medium", "ai") > S.maxCharsFor(5000, "medium", "ai") && S.maxCharsFor(10000, "medium", "space5") < S.maxCharsFor(10000, "medium", "ai") && S.maxCharsFor(0, "medium", "ai") === 0, "how long a reply can get follows what's left, the AI and the effort");

// ---- the two limits ----
const T = Date.parse("2026-11-03T12:00:00Z");
assert((await S.readPool(db, "u1")) === null, "no limits running before the first message");
let o = await S.openPool(db, "u1", L, T);
assert(o.ok && o.row.sStart === T && o.row.wStart === T && o.left === 100000, "the first message starts both timers (nothing used yet)");
await S.chargePool(db, "u1", o.row, 2300, L);
let v = S.poolView(await S.readPool(db, "u1"), L, T + 1000);
assert(v.session.used === 2300 && v.session.pct === 2 && v.session.resetAt === T + 5 * 3600e3 && v.week.used === 2300 && v.week.resetAt === T + 7 * 864e5 && !v.out, `a message counts toward both (${v.session.pct}% of the 5 hours, resets 5 hours and 7 days after the first message)`);
o = await S.openPool(db, "u1", L, T + 3600e3);
assert(o.ok && o.row.sStart === T, "a later message joins the same 5 hours (the timer doesn't restart)");
await S.chargePool(db, "u1", o.row, 500000, L);
v = S.poolView(await S.readPool(db, "u1"), L, T + 3600e3);
assert(v.session.used === 100000 && v.session.pct === 100 && v.out === "session", "the 5-hour limit never goes past 100,000, and then it's used up");
o = await S.openPool(db, "u1", L, T + 2 * 3600e3);
assert(!o.ok && o.out === "session", "with the 5-hour limit used up, the next message waits");
o = await S.openPool(db, "u1", L, T + 5 * 3600e3 + 1);
assert(o.ok && o.row.sStart === T + 5 * 3600e3 + 1 && o.row.sUsed === 0 && o.row.wStart === T && o.row.wUsed === 502300, "after 5 hours a new session starts, but the week keeps counting");
await S.chargePool(db, "u1", { sStart: T, wStart: T }, 3000, L);
v = S.poolView(await S.readPool(db, "u1"), L, T + 5 * 3600e3 + 2);
assert(v.session.used === 0 && v.week.used === 505300, "a reply from the old session isn't charged to the new one (the week still counts it)");
sq.prepare("UPDATE token_pool SET w_used = 1000000 WHERE user_id = 'u1'").run();
o = await S.openPool(db, "u1", L, T + 6 * 3600e3);
assert(!o.ok && o.out === "week" && /weekly limit/.test(S.limitMessage(o.view, T + 6 * 3600e3)) && /resets in \d+ days?/.test(S.limitMessage(o.view, T + 6 * 3600e3)), "the weekly limit stops every AI too, and says when it resets: " + S.limitMessage(o.view, T + 6 * 3600e3));
o = await S.openPool(db, "u1", L, T + 7 * 864e5 + 1);
assert(o.ok && o.row.wUsed === 0 && o.row.wStart === T + 7 * 864e5 + 1, "after 7 days a new week starts");
assert(S.sessionExempt({ email: "hiuhinarra@gmail.com" }) && !S.sessionExempt({ email: "kid@example.com" }), "the owner's accounts have no limits");

// ---- the AI itself (chatCompletion.js): one pool for every AI ----
const { TERMS_VERSION } = await import(R + "cloudflare-lib/terms.js");
const store = new Map();
let kvPuts = 0;
const kv = {
  get: async (k, ty) => (store.has(k) ? (ty === "json" ? JSON.parse(store.get(k)) : store.get(k)) : k.startsWith("terms:") ? (ty === "json" ? { version: TERMS_VERSION } : JSON.stringify({ version: TERMS_VERSION })) : null),
  put: async (k, v) => {
    kvPuts++;
    store.set(k, String(v));
  },
  delete: async (k) => store.delete(k),
};
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
let googleFails = false, asked = 0, reply = "Hello!", gwork = { candidatesTokenCount: 60, thoughtsTokenCount: 140 }, me = { id: "u9", role: "user", email: "kid9@example.com" };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    asked++;
    if (googleFails) return new Response('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}', { status: 400 });
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }], usageMetadata: { promptTokenCount: 50000, ...gwork } })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  if (u.endsWith("/entities/User/me")) return new Response(JSON.stringify(me));
  if (u.endsWith("/functions/my-team")) return new Response(JSON.stringify({ team: null }));
  return new Response(u.includes("/entities/") ? "[]" : "{}");
};
const { onRequestPost } = await import(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js");
const send = async (body) => {
  const r = await onRequestPost({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ prompt: "hi", question: "hi", model: "automatic", ...body }) }), env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k", DB: db }, waitUntil: () => {} });
  return [r.status, await r.json().catch(() => ({}))];
};
const sUsed = async () => (await S.readPool(db, "u9")).sUsed;
let [st, b] = await send({});
assert(st === 200 && b.used === 96 && b.credits.limits.session.used === 96 && b.credits.limits.week.used === 96, `a quick answer uses its tokens (1 typed + 60 + 140 thinking/4 = ${b.used}), not the 50,000-token chat history`);
gwork = { candidatesTokenCount: 3000, thoughtsTokenCount: 6000 };
[st, b] = await send({ model: "claude_sonnet_4_6" });
assert(st === 200 && b.used === 6752 && b.credits.limits.session.used === 6848, `a long answer on Galaxy uses 1.5 times as much, from the same pool (${b.used}, ${b.credits.limits.session.used} used in all)`);
[st, b] = await send({ model: "claude-sonnet-5" });
assert(st === 200 && b.used === 13503, `the same answer on Nebula uses 3 times as much (${b.used})`);
gwork = { candidatesTokenCount: 60, thoughtsTokenCount: 140 };
kvPuts = 0;
await send({});
assert(kvPuts === 1, "still one KV write per message (the limits are in D1): " + kvPuts);
sq.prepare("UPDATE token_pool SET s_used = 100000 WHERE user_id = 'u9'").run();
asked = 0;
[st, b] = await send({ model: "claude_opus_4_8" });
assert(st === 429 && b.sessionLimit === true && b.limit === "session" && asked === 0 && /You've hit your 5-hour limit\. It resets in \d+ hours?/.test(b.error), "with the 5-hour limit used up, every AI waits (Google isn't asked): " + b.error);
assert(b.credits.limits.out === "session" && b.credits.limits.session.pct === 100 && b.credits.limits.session.resetAt > Date.now(), "...and the status says which limit and when it resets");
sq.prepare("UPDATE token_pool SET s_used = 0, w_used = 1000000 WHERE user_id = 'u9'").run();
[st, b] = await send({});
assert(st === 429 && b.limit === "week" && /weekly limit/.test(b.error), "the weekly limit stops it too: " + b.error);
// a reply bigger than what's left stops there, says it was the limit, and uses the rest
sq.prepare("UPDATE token_pool SET s_used = 99800, w_used = 0 WHERE user_id = 'u9'").run();
reply = "word ".repeat(2000);
gwork = { candidatesTokenCount: 2500, thoughtsTokenCount: 2000 };
[st, b] = await send({});
assert(st === 200 && b.cut === true && b.cutBy === "session" && b.content.length <= S.maxCharsFor(199, "medium", "ai") + 5 && (await sUsed()) === 100000, `a reply bigger than the last 200 tokens stops there, marked as the limit's doing (${b.content.length} chars, ${await sUsed()} used)`);
reply = "Hello!";
sq.prepare("UPDATE token_pool SET s_used = 100 WHERE user_id = 'u9'").run();
googleFails = true;
[st, b] = await send({});
googleFails = false;
assert(st === 503 && (await sUsed()) === 100, "no answer (the AI failed): nothing is used (" + st + ", " + (await sUsed()) + ")");
store.set("usage:u9:" + new Date().toISOString().slice(0, 7), JSON.stringify({ ai: 100000, aiCode: 100000, galaxy5: 100000, space5: 100000 }));
gwork = { candidatesTokenCount: 60, thoughtsTokenCount: 140 };
[st, b] = await send({ model: "claude-sonnet-5" });
assert(st === 200 && b.content === "Hello!", "the old per-AI monthly credits no longer stop anything (all used up, it still answers)");
me = { id: "u-owner", role: "user", email: "hiuhinarra@gmail.com" };
[st, b] = await send({});
assert(st === 200 && b.credits.limits === null && !(await S.readPool(db, "u-owner")), "the owner's accounts have no limits");

// ---- the app's helpers (src/lib/creditRefresh.js, src/lib/creditCost.js) ----
const app = await import(R + "src/lib/creditRefresh.js");
const N = Date.now();
let ls = app.limitsState({ session: { pct: 23, left: 77000, resetAt: N + 3600e3 }, week: { pct: 8, left: 920000, resetAt: N + 3 * 864e5 }, out: null }, N);
assert(!ls.out && ls.session.pct === 23 && ls.week.pct === 8, "app: both limits show % used");
ls = app.limitsState({ session: { pct: 100, left: 0, resetAt: N + 60e3 }, week: { pct: 40, left: 600000, resetAt: N + 864e5 }, out: "session" }, N);
assert(ls.out === "session" && ls.resetAt === N + 60e3, "app: a used-up 5-hour limit pauses sending until it resets");
ls = app.limitsState({ session: { pct: 100, left: 0, resetAt: N - 1000 }, week: { pct: 40, left: 600000, resetAt: N + 864e5 }, out: "session" }, N);
assert(!ls.out && ls.session.pct === 0, "app: once its time is up, it counts as fresh even before the next check");
assert(app.limitsState(null, N).out === null, "app: no limits (the owner): nothing is paused");
assert(app.resetsText(N + (3 * 60 + 12) * 60000, N) === "Resets in 3 hr 12 min" && app.resetsText(N + 45 * 60000, N) === "Resets in 45 min", "app: the 5-hour limit says when it resets like Claude (Resets in 3 hr 12 min)");
assert(/^Resets \w{3} \d/.test(app.resetsText(N + 3 * 864e5, N, true)), "app: the weekly limit names the day: " + app.resetsText(N + 3 * 864e5, N, true));
const cc = await import(R + "src/lib/creditCost.js");
assert(cc.cutNote({ cutBy: "session" }) === cc.SESSION_CUT_NOTE && /usage limit/.test(cc.SESSION_CUT_NOTE) && !/Upgrade/.test(cc.SESSION_CUT_NOTE + cc.OUT_OF_CREDITS_NOTE), "app: a reply stopped by a limit says so (not 'upgrade your plan')");
