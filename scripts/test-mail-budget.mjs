// Offline test for the day's email budget (cloudflare-lib/mail.js): Resend's free plan sends 100 emails a day
// for everything, so sign-up codes come first, extras stop earlier, and a used-up day says so clearly.
// Run: node scripts/test-mail-budget.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
const { sendEmail, takeRoom, sentToday, ROOM, FULL_MESSAGE } = await import(new URL("../cloudflare-lib/mail.js", import.meta.url).href);
const { handleAuth } = await import(new URL("../cloudflare-lib/auth.js", import.meta.url).href);
const { alertOwner } = await import(new URL("../cloudflare-lib/ownerAlerts.js", import.meta.url).href);
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

const sq = new DatabaseSync(":memory:");
sq.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const stmt = (sqlText, args = []) => ({
  bind: (...a) => stmt(sqlText, a),
  all: async () => ({ results: sq.prepare(sqlText).all(...args) }),
  first: async () => sq.prepare(sqlText).get(...args) || null,
  run: async () => (/^\s*(select|pragma)/i.test(sqlText) ? { results: sq.prepare(sqlText).all(...args) } : { meta: { changes: sq.prepare(sqlText).run(...args).changes } }),
});
const db = { prepare: (q) => stmt(q), batch: async (list) => Promise.all(list.map((x) => x.run())) };
const env = { DB: db, RESEND_API_KEY: "test" };
const day = new Date().toISOString().slice(0, 10);
const setSent = (n) => sq.prepare("INSERT INTO mail_days (day, sent) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET sent = excluded.sent").run(day, n);

let mails = [], answers = [];
globalThis.fetch = async (url, init) => {
  if (!String(url).includes("resend.com")) throw new Error("unexpected fetch " + url);
  mails.push(JSON.parse(init.body));
  const a = answers.shift();
  return a ? new Response(JSON.stringify(a.body || {}), { status: a.status }) : new Response("{}", { status: 200 });
};

let r = await sendEmail(env, { to: "sam@example.com", subject: "Hi", text: "Hello", kind: "code" });
assert(r.ok && mails.length === 1 && mails[0].from === "Nebulux AI <support@nebuluxai.com>" && mails[0].to[0] === "sam@example.com" && (await sentToday(db)) === 1, "an email goes out and is counted for the day");

assert(ROOM.code === 100 && ROOM.newacct < ROOM.welcome && ROOM.welcome < ROOM.code && Object.values(ROOM).every((n) => n <= 100), "codes can use the whole day; new-account notes stop first, welcomes before codes");
setSent(ROOM.welcome);
mails = [];
r = await sendEmail(env, { to: "sam@example.com", subject: "Welcome", text: "x", kind: "welcome" });
const code = await sendEmail(env, { to: "sam@example.com", subject: "123456 is your code", text: "x", kind: "code" });
assert(r.full && !r.ok && code.ok && mails.length === 1 && /code/.test(mails[0].subject), "late in the day the welcome email waits, and the sign-up code still goes");

setSent(ROOM.newacct - 1);
assert((await takeRoom(db, "newacct", 1)) === true && (await takeRoom(db, "newacct", 1)) === false, "new-account notes to the owner stop at their share");
setSent(ROOM.alert - 1);
assert((await takeRoom(db, "alert", 2)) === false && (await takeRoom(db, "alert", 1)) === true, "an alert to two owners counts as two emails");

setSent(99);
assert((await takeRoom(db, "code", 1)) === true && (await takeRoom(db, "code", 1)) === false && (await sentToday(db)) === 100, "nothing past 100 in a day, codes included");

// Resend says "too many at once": one more try a moment later.
setSent(0);
mails = [];
answers = [{ status: 429, body: { name: "rate_limit_exceeded", message: "Too many requests" } }];
r = await sendEmail(env, { to: "sam@example.com", subject: "Code", text: "x" });
assert(r.ok && mails.length === 2, "a 'too many at once' answer is tried once more");

// Resend says the day is used up: nothing more is tried today, and Monitor says why once.
mails = [];
answers = [{ status: 429, body: { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." } }];
r = await sendEmail(env, { to: "sam@example.com", subject: "Code", text: "x" });
const again = await sendEmail(env, { to: "pat@example.com", subject: "Code", text: "x" });
const logged = sq.prepare("SELECT message, count FROM error_log WHERE path = 'email'").all();
assert(r.full && again.full && mails.length === 1 && logged.length === 1 && /Emails stopped for today/.test(logged[0].message), "when Resend's day is used up, nothing more is sent today and Monitor says so once");

// Signing up on a used-up day: a clear message that points at Google sign-in.
const req = new Request("https://nebuluxai.com/api/auth/register", { method: "POST" });
const out = await handleAuth(db, env, req, "auth/register", { email: "new@example.com", password: "Violet-Harbor-58", full_name: "New" });
assert(out.status === 503 && out.body.message.startsWith(FULL_MESSAGE) && /Continue with Google/.test(out.body.message), "signing up when the day's emails are used up says so and points to Google (" + out.body.message + ")");

// A new account's note to the owner on a busy day is skipped quietly.
setSent(ROOM.newacct);
mails = [];
sq.prepare("INSERT INTO rows (entity, id, created_date, updated_date, data) VALUES ('User', 'admin1', '2026-11-01', '2026-11-01', ?)").run(JSON.stringify({ email: "owner@example.com", role: "admin" }));
const sentAlert = await alertOwner(env, { kind: "newacct", subject: "New account: Kid", lines: ["Username: Kid"] });
const sentSafety = await alertOwner(env, { subject: "Blocked website", lines: ["Why: card form"] });
assert(sentAlert === false && sentSafety === true && mails.length === 1 && /Blocked/.test(mails[0].subject), "on a busy day the owner still hears about blocked pages, not every new account");

// A database problem never stops an email.
const broken = { prepare: () => { throw new Error("db down"); } };
mails = [];
r = await sendEmail({ DB: broken, RESEND_API_KEY: "test" }, { to: "sam@example.com", subject: "Code", text: "x" });
assert(r.ok && mails.length === 1, "if the count can't be kept, the email still goes");
