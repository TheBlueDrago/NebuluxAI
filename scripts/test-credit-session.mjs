// Offline test of Nebulux AI's session limit (cloudflare-lib/creditSession.js): every message takes 1
// credit as it's sent, up to 50 per 5-hour session (the first message starts the timer), one limit for
// every AI and chat. On an in-memory SQLite stand-in for D1, with KV, Base44 and Google faked.
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
const T = Date.parse("2026-10-23T12:00:00Z");
assert((await S.readSession(db, "u1", T)) === null, "no session before the first message");
let t = await S.takeSessionCredit(db, "u1", { now: T });
assert(t.ok && t.counted && t.used === 1 && t.start === T, "the first message takes 1 credit and starts the 5-hour timer then");
assert(S.sessionView(await S.readSession(db, "u1", T + 1000)).resetAt === T + 5 * 3600e3, "the session resets 5 hours after its first message");
for (let i = 0; i < 48; i++) await S.takeSessionCredit(db, "u1", { now: T + 60e3 + i * 1000 });
t = await S.takeSessionCredit(db, "u1", { now: T + 2 * 3600e3 });
assert(t.ok && t.used === 50, "1 message = 1 credit: the 50th message is allowed");
t = await S.takeSessionCredit(db, "u1", { now: T + 2 * 3600e3 + 1000 });
assert(!t.ok && t.used === 50 && t.start === T, "the 51st is refused until the session resets (nothing is taken)");
assert(S.sessionView(await S.readSession(db, "u1", T + 3 * 3600e3)).remaining === 0, "...and it shows 0 left");
t = await S.takeSessionCredit(db, "u1", { now: T + 5 * 3600e3 + 1 });
assert(t.ok && t.used === 1 && t.start === T + 5 * 3600e3 + 1, "once 5 hours have passed, the next message starts a new session");

// messages sent all at once can't slip past the limit (one statement checks and counts)
await Promise.all(Array.from({ length: 80 }, () => S.takeSessionCredit(db, "u2", { now: T })));
assert(S.sessionView(await S.readSession(db, "u2", T)).used === 50, "80 messages at once: exactly 50 are counted");

// a build's automatic "continue" rides on its message (up to 3, within 10 minutes)
await S.takeSessionCredit(db, "u3", { now: T });
for (let i = 0; i < 3; i++) {
  t = await S.takeSessionCredit(db, "u3", { followUp: true, now: T + 1000 * (i + 1) });
  assert(t.ok && !t.counted, `follow-up ${i + 1} is free`);
}
t = await S.takeSessionCredit(db, "u3", { followUp: true, now: T + 5000 });
assert(t.ok && t.counted && t.used === 2, "a 4th follow-up counts as a message");
await S.takeSessionCredit(db, "u4", { now: T });
t = await S.takeSessionCredit(db, "u4", { followUp: true, now: T + 11 * 60e3 });
assert(t.counted && t.used === 2, "a follow-up long after its message counts as a message");

// no answer: the credit goes back
t = await S.takeSessionCredit(db, "u5", { now: T });
await S.giveSessionCredit(db, "u5", t.start);
assert(S.sessionView(await S.readSession(db, "u5", T)).used === 0, "a message that got no answer gets its credit back");
assert(S.sessionExempt({ email: "hiuhinarra@gmail.com" }) && !S.sessionExempt({ email: "kid@example.com" }), "the owner's accounts have no session limit");

// ---- the AI itself (chatCompletion.js): one limit for every AI, taken as the message is sent ----
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
let googleFails = false, asked = 0, me = { id: "u9", role: "user", email: "kid9@example.com" };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    asked++;
    return googleFails ? new Response('{"error":{"code":400,"status":"INVALID_ARGUMENT"}}', { status: 400 }) : new Response('data: {"candidates":[{"content":{"parts":[{"text":"Hello!"}]}}]}\n\n', { status: 200, headers: { "content-type": "text/event-stream" } });
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
let [st, b] = await send({});
assert(st === 200 && b.credits.session.used === 1 && b.credits.session.remaining === 49, "a message takes 1 session credit, and the reply says 49 are left");
[st, b] = await send({ model: "claude_sonnet_4_6" });
assert(st === 200 && b.credits.session.used === 2, "a message to a different AI draws from the same 50");
kvPuts = 0;
await send({});
assert(kvPuts === 1, "still one KV write per message (the session is in D1): " + kvPuts);
sq.prepare("UPDATE credit_sessions SET used = 50 WHERE user_id = 'u9'").run();
asked = 0;
[st, b] = await send({});
assert(st === 429 && b.sessionLimit === true && asked === 0 && /all 50 credits for this session/.test(b.error) && /starts in \d+ hours?/.test(b.error), "with the session's 50 used, every AI waits (Google isn't asked): " + b.error);
assert(b.credits.session.remaining === 0 && b.credits.session.resetAt > Date.now(), "...and it says when the session resets");
sq.prepare("UPDATE credit_sessions SET used = 10 WHERE user_id = 'u9'").run();
[st, b] = await send({ question: "continue" });
assert(st === 200 && b.credits.session.used === 10, 'a build\'s automatic "continue" rides on its message (not counted)');
googleFails = true;
[st, b] = await send({});
googleFails = false;
const after = S.sessionView(await S.readSession(db, "u9"));
assert(st === 503 && after.used === 10, "no answer (the AI failed): the message's credit goes back (" + st + ", " + after.used + ")");
me = { id: "u-owner", role: "user", email: "hiuhinarra@gmail.com" };
[st, b] = await send({});
assert(st === 200 && b.credits.session === null && !(await S.readSession(db, "u-owner")), "the owner's accounts have no session limit");

// ---- the app's helpers (src/lib/creditRefresh.js) ----
const app = await import(R + "src/lib/creditRefresh.js");
const N = Date.now();
let ss = app.sessionState({ limit: 50, hours: 5, used: 20, remaining: 30, resetAt: N + 3600e3 }, N);
assert(ss.left === 30 && !ss.out && ss.running, "app: a running session shows what's left and when it resets");
ss = app.sessionState({ limit: 50, hours: 5, used: 50, remaining: 0, resetAt: N + 60e3 }, N);
assert(ss.out && ss.left === 0, "app: a used-up session pauses sending");
ss = app.sessionState({ limit: 50, hours: 5, used: 50, remaining: 0, resetAt: N - 1000 }, N);
assert(!ss.out && ss.left === 50 && !ss.running, "app: once its time is up, it counts as fresh even before the next check");
assert(!app.sessionState(null, N).out, "app: no session limit (the owner): nothing changes");
assert(/^tomorrow /.test(app.resetTimeText(N + 30 * 3600e3, N)), "app: the reset time says tomorrow when it's another day");
