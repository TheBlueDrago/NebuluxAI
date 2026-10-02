// Offline test of Nebulux's own database and sign-in (cloudflare-lib/db.js, auth.js), on an
// in-memory SQLite copy of D1 with db/schema.sql. Emails are captured instead of sent.
// Run: node scripts/test-own-backend.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleEntities, create } from "../cloudflare-lib/db.js";
import { handleAuth, sessionUser } from "../cloudflare-lib/auth.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

// A D1-shaped wrapper around node:sqlite.
const sq = new DatabaseSync(":memory:");
sq.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const db = {
  prepare(sqlText) {
    const st = sq.prepare(sqlText);
    let args = [];
    const api = {
      bind: (...a) => ((args = a), api),
      all: async () => ({ results: st.all(...args) }),
      first: async () => st.get(...args) || null,
      run: async () => st.run(...args),
    };
    return api;
  },
};

const mails = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("resend.com")) {
    mails.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }
  throw new Error("unexpected fetch " + url);
};
const env = { RESEND_API_KEY: "test" };
const req = (token) => new Request("https://nebuluxai.com/api/x", { headers: token ? { authorization: `Bearer ${token}` } : {} });
const auth = (path, body, token) => handleAuth(db, env, req(token), path, body);

// A user moved over from Base44 (kept id, no password yet), and an admin.
await create(db, "User", { system: true }, { email: "old@example.com", full_name: "Old User", role: "user", plan: "free" }, { id: "olduser1" });
await create(db, "User", { system: true }, { email: "boss@example.com", full_name: "Boss", role: "admin" }, { id: "admin1" });

// Sign up a new person.
let r = await auth("auth/register", { email: "New@Example.com", password: "short" });
assert(r.status === 400, "a short password is refused");
r = await auth("auth/register", { email: "new@example.com", password: "longenough1" });
assert(r.status === 200 && mails.length === 1, "sign-up sends a code by email");
let code = mails[0].text.match(/\d{6}/)[0];
r = await auth("auth/login", { email: "new@example.com", password: "longenough1" });
assert(r.status === 403 && mails.length === 2, "can't sign in before confirming the email (a new code is sent)");
code = mails[1].text.match(/\d{6}/)[0];
r = await auth("auth/verify-otp", { email: "new@example.com", otp_code: "000000" === code ? "111111" : "000000" });
assert(r.status === 400, "a wrong code is refused");
r = await auth("auth/verify-otp", { email: "new@example.com", otp_code: code });
assert(r.status === 200 && /^nx_/.test(r.body.access_token), "the right code signs them in");
const newTok = r.body.access_token;
const me = await sessionUser(db, req(newTok));
assert(me && me.email === "new@example.com" && me.role === "user", "the session knows who they are");

r = await auth("auth/login", { email: "new@example.com", password: "wrongpass1" });
assert(r.status === 401, "a wrong password is refused");
r = await auth("auth/login", { email: "new@example.com", password: "longenough1" });
assert(r.status === 200 && r.body.access_token, "email and password sign in");

// A moved-over account: first sign-in emails a link to choose a password, and keeps the old id.
mails.length = 0;
r = await auth("auth/login", { email: "old@example.com", password: "whatever12" });
assert(r.status === 403 && mails.length === 1 && /reset-password\?token=/.test(mails[0].text), "a moved-over account is emailed a link to set a password");
const token = mails[0].text.match(/token=([0-9a-f]+)/)[1];
r = await auth("auth/reset-password", { reset_token: token, new_password: "brandnew12" });
assert(r.status === 200, "the link sets the new password");
r = await auth("auth/reset-password", { reset_token: token, new_password: "again12345" });
assert(r.status === 400, "the link only works once");
r = await auth("auth/login", { email: "old@example.com", password: "brandnew12" });
assert(r.status === 200 && r.body.user.id === "olduser1", "they sign in to their old account (same id)");
const oldTok = r.body.access_token;

// Records and their rules.
const call = (token, method, path, body) => sessionUser(db, req(token)).then((u) => handleEntities(db, u, method, path.split("?")[0], path.includes("?") ? "?" + path.split("?")[1] : "", body));
r = await call(oldTok, "PUT", "entities/User/me", { full_name: "Renamed", role: "admin", plan: "pro", name_set: true });
assert(r.status === 200 && r.body.full_name === "Renamed" && r.body.role === "user" && r.body.plan === "free", "people can rename themselves but not make themselves admin or give themselves a plan");
r = await call(oldTok, "GET", "entities/User");
assert(r.status === 200 && r.body.length === 1 && r.body[0].id === "olduser1", "people only see their own user record");
r = await call(null, "GET", "entities/User/me");
assert(r.status === 401, "signed out: no 'me'");

r = await call(oldTok, "POST", "entities/PublishedGame", { name: "mygame", title: "My Game", hidden: false });
assert(r.status === 200 && r.body.created_by_id === "olduser1", "a signed-in person can publish a game");
const gameId = r.body.id;
r = await call(null, "GET", `entities/PublishedGame?q=${encodeURIComponent(JSON.stringify({ name: "mygame" }))}`);
assert(r.status === 200 && r.body.length === 1, "anyone can find a published game by name");
r = await call(newTok, "PUT", `entities/PublishedGame/${gameId}`, { title: "Stolen" });
assert(r.status === 403, "someone else can't change it");
r = await call(newTok, "DELETE", `entities/PublishedGame/${gameId}`);
assert(r.status === 403, "someone else can't delete it");

const bossLogin = await auth("auth/register", { email: "boss@example.com", password: "Violet-Harbor-58" });
const bossCode = mails[mails.length - 1].text.match(/\d{6}/)[0];
r = await auth("auth/verify-otp", { email: "boss@example.com", otp_code: bossCode });
assert(bossLogin.status === 200 && r.body.user.id === "admin1", "an admin signing up again gets their old account back");
const bossTok = r.body.access_token;
r = await call(bossTok, "GET", "entities/User?limit=5000");
assert(r.status === 200 && r.body.length === 3, "admins see every user");
r = await call(bossTok, "PUT", "entities/User/olduser1", { banned: true });
assert(r.status === 200 && r.body.banned === true, "admins can ban");
r = await call(oldTok, "GET", "entities/PromoCode");
assert(r.status === 200 && r.body.length === 0, "promo codes are hidden from normal users");
r = await call(null, "POST", "entities/PublishedGame", { name: "x" });
assert(r.status === 401, "signed out: can't publish");

// Deleting your account removes your sign-in too.
r = await call(newTok, "DELETE", `entities/User/${me.id}`);
assert(r.status === 200 && !(await sessionUser(db, req(newTok))), "deleting your account signs you out everywhere");

// "Continue with Google" (Google's answer is faked here).
const { googleStart, googleCallback } = await import("../cloudflare-lib/auth.js");
const genv = { ...env, GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "sec" };
let s = googleStart(genv, new Request("https://nebuluxai.com/api/apps/auth/google/start?to=/play/fighter"));
const loc = new URL(s.headers.get("location"));
const cookie = s.headers.get("set-cookie").split(";")[0];
assert(loc.host === "accounts.google.com" && loc.searchParams.get("redirect_uri") === "https://nebuluxai.com/api/apps/auth/google/callback", "Google sign-in goes to Google and comes back to nebuluxai.com");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const realFetch = globalThis.fetch;
const googleSays = (claims) =>
  (globalThis.fetch = async (u, i) => (String(u).includes("oauth2.googleapis.com") ? new Response(JSON.stringify({ id_token: `x.${b64(claims)}.y` }), { status: 200 }) : realFetch(u, i)));
const back = (st, ck) => googleCallback(db, genv, new Request(`https://nebuluxai.com/api/apps/auth/google/callback?state=${st}&code=abc`, { headers: { cookie: ck } }));
googleSays({ aud: "cid", email: "Old@Example.com", email_verified: true, name: "Old" });
s = await back("0".repeat(32), cookie);
assert(/google=failed/.test(s.headers.get("location")), "a wrong state is refused");
s = await back(loc.searchParams.get("state"), cookie);
const land = new URL(s.headers.get("location"));
assert(land.pathname === "/play/fighter" && /^nx_/.test(land.searchParams.get("access_token")), "Google sign-in lands back where they were, signed in");
const gu = await sessionUser(db, req(land.searchParams.get("access_token")));
assert(gu && gu.id === "olduser1", "a Google email that matches an account signs in to that account");
googleSays({ aud: "someone-else", email: "x@example.com", email_verified: true });
s = googleStart(genv, new Request("https://nebuluxai.com/api/apps/auth/google/start"));
s = await back(new URL(s.headers.get("location")).searchParams.get("state"), s.headers.get("set-cookie").split(";")[0]);
assert(/google=failed/.test(s.headers.get("location")), "a token meant for another app is refused");
googleSays({ aud: "cid", email: "fresh@example.com", email_verified: true, name: "Fresh Person" });
s = googleStart(genv, new Request("https://nebuluxai.com/api/apps/auth/google/start?to=//evil.com"));
s = await back(new URL(s.headers.get("location")).searchParams.get("state"), s.headers.get("set-cookie").split(";")[0]);
const l2 = new URL(s.headers.get("location"));
assert(l2.host === "nebuluxai.com" && l2.searchParams.get("google") === "check" && !l2.searchParams.get("access_token"), "a new Google user isn't signed in yet: they're told to check their email");
const last = mails[mails.length - 1];
assert(last.to[0] === "fresh@example.com" && /refresh it, and log in/.test(last.text) && /reset-password\?token=/.test(last.text), "they get a link to choose a password, with the steps");

// Signing out cancels the sign-in on the server too (src/lib/signOut.js).
const outLogin = await auth("auth/login", { email: "old@example.com", password: "brandnew12" });
const outTok = outLogin.body.access_token;
assert(!!(await sessionUser(db, req(outTok))), "signed in");
r = await auth("auth/logout", {}, outTok);
assert(r.status === 200 && !(await sessionUser(db, req(outTok))), "after signing out, that sign-in no longer works anywhere");

// "Sign out on all devices" ends every sign-in on the account.
const phone = (await auth("auth/login", { email: "old@example.com", password: "brandnew12" })).body.access_token;
const laptop = (await auth("auth/login", { email: "old@example.com", password: "brandnew12" })).body.access_token;
r = await auth("auth/logout-all", {}, null);
assert(r.status === 401, "signing out everywhere needs a sign-in");
r = await auth("auth/logout-all", {}, phone);
assert(r.status === 200 && !(await sessionUser(db, req(phone))) && !(await sessionUser(db, req(laptop))), "signing out everywhere ends the sign-in on every device");
