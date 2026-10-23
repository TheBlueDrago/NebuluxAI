// Offline test of Nebulux AI's session limit (cloudflare-lib/creditSession.js): 50 credits per 5-hour
// session (the first message starts the timer), one limit for every AI and chat, charged by how much
// work each reply takes (the tokens the model produced, thinking included). On an in-memory SQLite
// stand-in for D1, with KV, Base44 and Google faked.
// Run: node scripts/test-credit-session.mjs
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
assert(S.SESSION_LIMIT === 50 && S.SESSION_HOURS === 5, "the session is 50 credits per 5 hours");

// ---- what a reply's work costs ----
const quick = S.workCost({ tokens: { output: 150 }, effort: "medium" });
const everyday = S.workCost({ tokens: { output: 1500 }, effort: "medium" });
const long = S.workCost({ tokens: { output: 10000 }, effort: "medium" });
assert(quick === 0.1 && everyday === 0.8 && long === 5, `more work costs more: a quick answer ${quick}, an everyday one ${everyday}, a long one ${long}`);
assert(quick < 1, "a short, quick answer costs less than a credit (not a flat 1 per message)");
assert(S.workCost({ tokens: { output: 0 }, text: "", effort: "low" }) === 0.1, "every reply costs at least 0.1");
const lowEst = S.workCost({ tokens: null, text: "x".repeat(4000), effort: "low" }), highEst = S.workCost({ tokens: null, text: "x".repeat(4000), effort: "high" });
assert(lowEst === 1 && highEst === 1.5, `without Google's token count it's estimated from the length and effort (low ${lowEst}, high ${highEst})`);
assert(S.sessionMaxChars(1, "medium") > S.sessionMaxChars(0.5, "medium") && S.sessionMaxChars(1, "high") < S.sessionMaxChars(1, "medium") && S.sessionMaxChars(0, "medium") === 0, "how long a reply can get follows what's left and the effort");

// ---- the session ----
const T = Date.parse("2026-10-23T12:00:00Z");
assert((await S.readSession(db, "u1", T)) === null, "no session before the first message");
let o = await S.openSession(db, "u1", T);
assert(o.ok && o.start === T && o.used === 0 && o.remaining === 50, "the first message starts the 5-hour timer (nothing charged yet)");
await S.chargeSession(db, "u1", o.start, quick);
let v = S.sessionView(await S.readSession(db, "u1", T + 1000));
assert(v.used === 0.1 && v.remaining === 49.9 && v.resetAt === T + 5 * 3600e3, `its reply's work is charged (${v.used} used, ${v.remaining} left, resets 5 hours after the first message)`);
o = await S.openSession(db, "u1", T + 3600e3);
assert(o.ok && o.start === T, "a later message joins the same session (the timer doesn't restart)");
await S.chargeSession(db, "u1", o.start, long);
assert(S.sessionView(await S.readSession(db, "u1", T + 3600e3)).used === 5.1, "a long reply takes more of the session");
await S.chargeSession(db, "u1", T, 60);
v = S.sessionView(await S.readSession(db, "u1", T + 2 * 3600e3));
assert(v.used === 50 && v.remaining === 0, "the session never goes past 50");
o = await S.openSession(db, "u1", T + 2 * 3600e3);
assert(!o.ok && o.remaining === 0 && o.start === T, "with the 50 used, the next message waits until the session resets");
o = await S.openSession(db, "u1", T + 5 * 3600e3 + 1);
assert(o.ok && o.start === T + 5 * 3600e3 + 1 && o.used === 0, "once 5 hours have passed, the next message starts a new session");
await S.chargeSession(db, "u1", T, 3);
assert(S.sessionView(await S.readSession(db, "u1", T + 5 * 3600e3 + 2)).used === 0, "a reply from the old session isn't charged to the new one");
assert(S.sessionExempt({ email: "hiuhinarra@gmail.com" }) && !S.sessionExempt({ email: "kid@example.com" }), "the owner's accounts have no session limit");

// ---- the AI itself (chatCompletion.js): one limit for every AI, charged by the reply's work ----
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
let googleFails = false, asked = 0, reply = "Hello!", work = { candidatesTokenCount: 60, thoughtsTokenCount: 140 }, me = { id: "u9", role: "user", email: "kid9@example.com" };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    asked++;
    if (googleFails) return new Response('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}', { status: 400 });
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }], usageMetadata: { promptTokenCount: 50, ...work } })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
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
const used9 = async () => S.sessionView(await S.readSession(db, "u9")).used;
let [st, b] = await send({});
assert(st === 200 && b.sessionCharged === 0.1 && b.credits.session.used === 0.1 && b.credits.session.remaining === 49.9, `a quick answer (200 tokens of work) takes 0.1 of the session: ${b.sessionCharged}, ${b.credits.session.remaining} left`);
work = { candidatesTokenCount: 3000, thoughtsTokenCount: 6000 };
[st, b] = await send({ model: "claude_sonnet_4_6" });
assert(st === 200 && b.sessionCharged === 4.5 && b.credits.session.used === 4.6, `a long, hard answer on a different AI (9,000 tokens, thinking included) takes 4.5 of the same 50 (${b.credits.session.used} used)`);
work = { candidatesTokenCount: 60, thoughtsTokenCount: 140 };
kvPuts = 0;
await send({});
assert(kvPuts === 1, "still one KV write per message (the session is in D1): " + kvPuts);
sq.prepare("UPDATE session_work SET used = 500 WHERE user_id = 'u9'").run();
asked = 0;
[st, b] = await send({});
assert(st === 429 && b.sessionLimit === true && asked === 0 && /all 50 credits for this session/.test(b.error) && /starts in \d+ hours?/.test(b.error), "with the session's 50 used, every AI waits (Google isn't asked): " + b.error);
assert(b.credits.session.remaining === 0 && b.credits.session.resetAt > Date.now(), "...and it says when the session resets");
// a reply bigger than what the session has left stops there, says it was the session, and uses the rest
sq.prepare("UPDATE session_work SET used = 498 WHERE user_id = 'u9'").run();
reply = "word ".repeat(2000);
work = { candidatesTokenCount: 2500, thoughtsTokenCount: 2000 };
[st, b] = await send({});
assert(st === 200 && b.cut === true && b.cutBy === "session" && b.content.length <= S.sessionMaxChars(0.2, "medium") + 5 && (await used9()) === 50, `a reply bigger than the session's last 0.2 stops there, marked as the session's doing (${b.content.length} chars, ${await used9()} used)`);
assert(b.charged === 1, "...and the month's credits are charged only for what was written");
reply = "Hello!";
sq.prepare("UPDATE session_work SET used = 100 WHERE user_id = 'u9'").run();
googleFails = true;
[st, b] = await send({});
googleFails = false;
assert(st === 503 && (await used9()) === 10, "no answer (the AI failed): nothing is charged to the session (" + st + ", " + (await used9()) + ")");
me = { id: "u-owner", role: "user", email: "hiuhinarra@gmail.com" };
[st, b] = await send({});
assert(st === 200 && b.credits.session === null && b.sessionCharged === undefined && !(await S.readSession(db, "u-owner")), "the owner's accounts have no session limit");

// ---- the app's helpers (src/lib/creditRefresh.js, src/lib/creditCost.js) ----
const app = await import(R + "src/lib/creditRefresh.js");
const N = Date.now();
let ss = app.sessionState({ limit: 50, hours: 5, used: 15.5, remaining: 34.5, resetAt: N + 3600e3 }, N);
assert(ss.left === 34.5 && !ss.out && ss.running && app.creditText(ss.left) === "34.5" && app.creditText(50) === "50", "app: a running session shows what's left with one decimal (34.5 of 50)");
ss = app.sessionState({ limit: 50, hours: 5, used: 50, remaining: 0, resetAt: N + 60e3 }, N);
assert(ss.out && ss.left === 0, "app: a used-up session pauses sending");
ss = app.sessionState({ limit: 50, hours: 5, used: 50, remaining: 0, resetAt: N - 1000 }, N);
assert(!ss.out && ss.left === 50 && !ss.running, "app: once its time is up, it counts as fresh even before the next check");
assert(!app.sessionState(null, N).out, "app: no session limit (the owner): nothing changes");
assert(/^tomorrow /.test(app.resetTimeText(N + 30 * 3600e3, N)), "app: the reset time says tomorrow when it's another day");
const cc = await import(R + "src/lib/creditCost.js");
assert(cc.cutNote({ cutBy: "session" }) === cc.SESSION_CUT_NOTE && cc.cutNote({ cut: true }) === cc.OUT_OF_CREDITS_NOTE && !/Upgrade/.test(cc.SESSION_CUT_NOTE), "app: a reply stopped by the session says so (not 'upgrade your plan')");
