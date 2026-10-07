// The "I'm not a robot" check (cloudflare-lib/turnstile.js) on sign-up and "Forgot password":
// off without its keys, and once on, a missing or failed answer is refused before any email.
// Run: node scripts/test-turnstile.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleAuth } from "../cloudflare-lib/auth.js";
import { turnstileOk } from "../cloudflare-lib/turnstile.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

const sq = new DatabaseSync(":memory:");
sq.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const db = {
  prepare(sqlText) {
    const st = sq.prepare(sqlText);
    let args = [];
    const api = { bind: (...a) => ((args = a), api), all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) || null, run: async () => st.run(...args) };
    return api;
  },
};

const mails = [];
const checks = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes("resend.com")) {
    mails.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }
  if (url.includes("challenges.cloudflare.com")) {
    const f = init.body;
    checks.push({ secret: f.get("secret"), response: f.get("response"), ip: f.get("remoteip") });
    return new Response(JSON.stringify({ success: f.get("response") === "good-token" }), { status: 200 });
  }
  throw new Error("unexpected fetch " + url);
};
const req = () => new Request("https://nebuluxai.com/api/x", { method: "POST", headers: { "cf-connecting-ip": "1.2.3.4" } });

let env = { RESEND_API_KEY: "test" };
let r = await handleAuth(db, env, req(), "auth/register", { email: "a@example.com", password: "longenough1" });
assert(r.status === 200 && mails.length === 1 && checks.length === 0, "off without keys: sign-up works as before");

env = { RESEND_API_KEY: "test", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET: "sec" };
r = await handleAuth(db, env, req(), "auth/register", { email: "b@example.com", password: "longenough1" });
assert(r.status === 400 && r.body.code === "turnstile" && mails.length === 1, "on: no answer, no account and no email");
r = await handleAuth(db, env, req(), "auth/register", { email: "b@example.com", password: "longenough1", turnstile_token: "bad" });
assert(r.status === 400 && mails.length === 1, "on: a failed answer is refused");
r = await handleAuth(db, env, req(), "auth/register", { email: "b@example.com", password: "longenough1", turnstile_token: "good-token" });
assert(r.status === 200 && mails.length === 2, "on: a passed check signs up");
assert(checks.at(-1).secret === "sec" && checks.at(-1).ip === "1.2.3.4", "the check sends the secret and the visitor's network");

r = await handleAuth(db, env, req(), "auth/reset-password-request", { email: "a@example.com" });
assert(r.status === 400 && r.body.code === "turnstile", "on: forgot password needs the check too");
r = await handleAuth(db, env, req(), "auth/reset-password-request", { email: "a@example.com", turnstile_token: "good-token" });
assert(r.status === 200, "on: forgot password with the check");

r = await handleAuth(db, env, req(), "auth/login", { email: "zzz@example.com", password: "whatever12" });
assert(r.body.code !== "turnstile", "signing in doesn't need it");

globalThis.fetch = async () => {
  throw new Error("down");
};
assert((await turnstileOk(env, req(), "anything")) === true, "if Cloudflare's check is down, nobody is locked out");
