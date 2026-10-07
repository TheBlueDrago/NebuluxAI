// API key spending limits (cloudflare-lib/apikeys.js) and the low-balance email
// (cloudflare-lib/apibilling.js), on an in-memory SQLite copy of D1.
// Run: node scripts/test-api-limits.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createKey, setLimit, noteSpend, listKeys, keyOwner, spentThisMonth } from "../cloudflare-lib/apikeys.js";
import { lowBalanceEmail } from "../cloudflare-lib/apibilling.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const sq = new DatabaseSync(":memory:");
sq.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
const DB = {
  prepare(sqlText) {
    const st = sq.prepare(sqlText);
    let args = [];
    const api = { bind: (...a) => ((args = a), api), all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) || null, run: async () => st.run(...args) };
    return api;
  },
};

const { key, id } = await createKey(DB, "u1", "test");
let k = (await listKeys(DB, "u1"))[0];
assert(k.limit_mc == null && k.spent_mc === 0, "a new key has no limit and has spent nothing");
await setLimit(DB, "u1", id, 5);
await setLimit(DB, "someone-else", id, 9999);
k = (await listKeys(DB, "u1"))[0];
assert(k.limit_mc === 500000, "the owner sets a $5 limit (and nobody else can change it)");
await noteSpend(DB, id, 120000);
await noteSpend(DB, id, 30000);
const owner = await keyOwner(DB, new Request("https://x/", { headers: { authorization: `Bearer ${key}` } }));
assert(spentThisMonth(owner) === 150000 && owner.limit_mc === 500000, "spending adds up this month and the key's owner lookup sees it");
sq.prepare("UPDATE api_keys SET spent_month = '2000-01'").run();
assert((await listKeys(DB, "u1"))[0].spent_mc === 0, "a new month starts again at 0");
await setLimit(DB, "u1", id, null);
assert((await listKeys(DB, "u1"))[0].limit_mc == null, "the limit can be removed");

sq.prepare("INSERT INTO rows (entity, id, created_date, updated_date, data) VALUES ('User', 'u1', 'x', 'x', ?)").run(JSON.stringify({ email: "dev@example.com" }));
const mails = [];
globalThis.fetch = async (url, init) => {
  mails.push(JSON.parse(init.body));
  return new Response("{}");
};
const env = { DB, RESEND_API_KEY: "t" };
assert((await lowBalanceEmail(env, "u1", "galaxy", 150000, 120000)) === false && mails.length === 0, "no email while still over $1");
assert((await lowBalanceEmail(env, "u1", "galaxy", 110000, 90000)) === true && mails[0].to[0] === "dev@example.com" && /Galaxy/.test(mails[0].subject), "one email when it drops under $1");
assert((await lowBalanceEmail(env, "u1", "galaxy", 90000, 80000)) === false && mails.length === 1, "no more emails after that");
