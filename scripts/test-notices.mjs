// Account notice emails (cloudflare-lib/mail.js accountNotice): only what someone needs to know.
// Run: node scripts/test-notices.mjs
import { readFileSync } from "node:fs";
import { accountNotice, NOTICES } from "../cloudflare-lib/mail.js";
let failed = 0;
const assert = (c, m) => { if (!c) { console.error("FAIL", m); failed++; } else console.log("ok", m); };
const sent = [];
globalThis.fetch = async (u, init) => { sent.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); };
const env = { RESEND_API_KEY: "re_test" };
let r = await accountNotice(env, "ann@example.com", "password");
assert(r.ok && sent.length === 1 && sent[0].to[0] === "ann@example.com" && /password was changed/.test(sent[0].subject) && /forgot-password/.test(sent[0].text), "a changed password is emailed, with what to do if it wasn't you");
r = await accountNotice(env, "ann@example.com", "deleted");
assert(r.ok && /account was deleted/.test(sent[1].subject) && /won't get any more emails/.test(sent[1].text), "a deleted account gets one last email");
assert(!(await accountNotice(env, "ann@example.com", "newsletter")).ok && sent.length === 2, "only the known notices exist: nothing else can be sent this way");
assert(!(await accountNotice({}, "ann@example.com", "password")).ok && sent.length === 2, "no email key: nothing is sent and nothing breaks");
assert(Object.values(NOTICES).every((n) => !/sale|offer|upgrade|% off|new feature/i.test(n.subject + n.text)), "notices carry no offers or news");
const auth = readFileSync(new URL("../cloudflare-lib/auth.js", import.meta.url), "utf8");
assert((auth.match(/accountNotice\(env, [a-z.]+, "password"\)/g) || []).length === 2, "both ways of changing a password send the notice");
const del = readFileSync(new URL("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/delete-account.js", import.meta.url), "utf8");
assert(/accountNotice\(env, user\.email, "deleted"\)/.test(del), "deleting an account sends the notice");
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
