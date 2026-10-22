// Offline test of Orbit's sign-up page on the Nebulux side (functions/v1/orbit.js: signup, signup_verify,
// signup_resend, signup_settings), running the real sign-up code (cloudflare-lib/auth.js) on an in-memory
// SQLite copy of D1 with db/schema.sql. Emails are captured instead of sent.
// Run: node scripts/test-orbit-signup.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { onRequestPost } from "../functions/v1/orbit.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const sq = new DatabaseSync(":memory:");
sq.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const stmt = (sqlText, args = []) => {
  const api = {
    bind: (...a) => stmt(sqlText, a),
    all: async () => ({ results: sq.prepare(sqlText).all(...args) }),
    first: async () => sq.prepare(sqlText).get(...args) || null,
    run: async () => (/^\s*(select|pragma)/i.test(sqlText) ? { results: sq.prepare(sqlText).all(...args) } : { meta: { changes: sq.prepare(sqlText).run(...args).changes } }),
  };
  return api;
};
const db = { prepare: (q) => stmt(q), batch: async (list) => Promise.all(list.map((x) => x.run())) };
const mails = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("resend.com")) { mails.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); }
  throw new Error("unexpected fetch " + url);
};
const env = { DB: db, RESEND_API_KEY: "test" };
const call = async (body, e = env) => {
  const r = await onRequestPost({ request: new Request("https://nebuluxai.com/v1/orbit", { method: "POST", headers: { "content-type": "application/json", origin: "https://nebuluxorbit.thebluedragonstriker.workers.dev" }, body: JSON.stringify(body) }), env: e });
  return { status: r.status, cors: r.headers.get("access-control-allow-origin"), ...(await r.json()) };
};
const codeIn = (m) => (/\b(\d{6})\b/.exec(m.text || "") || [])[1];

let r = await call({ action: "signup_settings" });
assert(r.status === 200 && r.turnstile_site_key === null && r.cors === "https://nebuluxorbit.thebluedragonstriker.workers.dev", "settings: no robot check when it isn't switched on, and Orbit's site may call it");
r = await call({ action: "signup_settings" }, { ...env, TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET: "s" });
assert(r.turnstile_site_key === "site-key", "settings: the public site key when it is");
r = await call({ action: "signup", email: "kid@example.com", password: "Violet-Harbor-58", full_name: "Kid" }, { ...env, TURNSTILE_SITE_KEY: "k", TURNSTILE_SECRET: "s" });
assert(r.status === 400 && r.code === "turnstile", "with the robot check on, signing up without it is refused");
r = await call({ action: "signup", email: "kid@example.com", password: "password", full_name: "Kid" });
assert(r.status === 400 && /lists attackers try first|too easy|at least/i.test(r.error), "the same password rules as nebuluxai.com (" + r.error + ")");
r = await call({ action: "signup", email: "Sam.Orbit@Example.com", password: "Violet-Harbor-58", full_name: "  Sam <b>Orbit</b>  " });
assert(r.status === 200 && r.ok && mails.length === 1 && mails[0].to[0] === "sam.orbit@example.com", "signing up emails a code to confirm the address");
const user = sq.prepare("SELECT id, data FROM rows WHERE entity = 'User'").all().map((x) => ({ ...JSON.parse(x.data), id: x.id })).find((u) => u.email === "sam.orbit@example.com");
assert(user && user.full_name === "Sam Orbit", "the name they chose is saved (cleaned): " + (user && user.full_name));
r = await call({ action: "signup_verify", email: "sam.orbit@example.com", code: codeIn(mails[0]) === "000000" ? "111111" : "000000" });
assert(r.status === 400 && /isn't right/.test(r.error), "a wrong code is refused");
r = await call({ action: "signup_resend", email: "sam.orbit@example.com" });
assert(r.status === 200 && mails.length === 2, "Resend sends a new code");
r = await call({ action: "signup_verify", email: "sam.orbit@example.com", code: codeIn(mails[1]) });
assert(r.status === 200 && /^[a-f0-9]{48}$/.test(r.token) && r.name === "Sam Orbit", "the right code confirms the account and signs in to Orbit");
const tok = sq.prepare("SELECT user_id FROM orbit_tokens WHERE token = ?").get(r.token);
assert(tok && tok.user_id === user.id, "the Orbit sign-in belongs to the new account");
assert(sq.prepare("SELECT COUNT(*) AS n FROM sessions").get().n === 0, "no Nebulux session is left behind");
assert(sq.prepare("SELECT verified FROM logins WHERE email = 'sam.orbit@example.com'").get().verified === 1, "the email is confirmed");
r = await call({ action: "signup", email: "sam.orbit@example.com", password: "Another-Long-77", full_name: "Imposter" });
assert(r.status === 409 && /already exists/.test(r.error), "an email that already has an account can't be signed up again");
assert(JSON.parse(sq.prepare("SELECT data FROM rows WHERE id = ?").get(user.id).data).full_name === "Sam Orbit", "...and its name isn't changed");
