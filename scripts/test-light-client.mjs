// The app's small fetch client (src/api/base44Client.js) against the real /api handler
// (functions/api/[[path]].js) on an in-memory SQLite copy of D1: sign-up, the emailed code,
// "me", records, functions, and the error shapes callers read (e.status, e.response.data).
// Run: node scripts/test-light-client.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { onRequest } from "../functions/api/[[path]].js";

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

// A browser-ish world for the client.
const store = new Map();
globalThis.window = {
  location: { href: "https://nebuluxai.com/chat", origin: "https://nebuluxai.com", search: "", pathname: "/chat", hash: "" },
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  history: { replaceState() {} },
};
globalThis.document = { cookie: "", title: "" };

const mails = [];
const seen = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("resend.com")) {
    mails.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }
  const full = new URL(url, "https://nebuluxai.com");
  const req = new Request(full, init);
  seen.push({ method: req.method, path: full.pathname + full.search, auth: req.headers.get("authorization"), ct: req.headers.get("content-type") });
  if (full.pathname.includes("/functions/echo")) {
    const body = await req.json();
    return body.fail ? new Response(JSON.stringify({ error: "nope" }), { status: 402 }) : new Response(JSON.stringify({ got: body, who: req.headers.get("authorization") }), { status: 200 });
  }
  const path = full.pathname.replace(/^\/api\//, "").split("/");
  return onRequest({ request: req, params: { path }, env: { DB, RESEND_API_KEY: "test" }, waitUntil() {} });
};

// Bundle the client the way Vite would (the @ alias, import.meta.env).
const dir = mkdtempSync(join(tmpdir(), "nxclient-"));
const out = join(dir, "client.mjs");
await build({
  entryPoints: [new URL("../src/api/base44Client.js", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  alias: { "@": new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") },
  define: { "import.meta.env": "{}" },
  logLevel: "silent",
});
const { base44, getPublicSettings } = await import(pathToFileURL(out).href);

let s = await getPublicSettings();
assert(s && s.id, "public settings load");

let e = await base44.auth.me().catch((x) => x);
assert(e instanceof Error && e.status === 401, "signed out: me() fails with status 401");

await base44.auth.register({ email: "kid@example.com", password: "longenough1" });
assert(mails.length === 1, "register sends the code");
e = await base44.auth.verifyOtp({ email: "kid@example.com", otpCode: "000001" }).catch((x) => x);
assert(e instanceof Error && e.status === 400 && e.message && !e.response, "a wrong code fails like the SDK did (status, message, no .response)");
const code = mails[0].text.match(/\d{6}/)[0];
const v = await base44.auth.verifyOtp({ email: "kid@example.com", otpCode: code });
assert(/^nx_/.test(v.access_token), "the right code returns a token");
base44.auth.setToken(v.access_token);
assert(store.get("base44_access_token") === v.access_token, "setToken saves it");

const me = await base44.auth.me();
assert(me.email === "kid@example.com", "me() returns the person");
const [a, b] = await Promise.all([base44.auth.me(), base44.auth.me()]);
assert(a.id === b.id && seen.filter((x) => x.path.endsWith("/User/me") && x.method === "GET").length === 3, "two me() at once share one request");

const upd = await base44.auth.updateMe({ full_name: "Kid" });
assert(upd.full_name === "Kid", "updateMe works");

const g = await base44.entities.PublishedGame.create({ name: "mygame", title: "My Game", hidden: false });
assert(g.id && g.created_by_id === me.id, "entities.create");
const found = await base44.entities.PublishedGame.filter({ name: "mygame" }, "-created_date", 5);
assert(Array.isArray(found) && found.length === 1, "entities.filter with sort and limit");
const q = seen.find((x) => x.method === "GET" && x.path.includes("PublishedGame?"));
assert(q && q.path.includes("q=%7B%22name%22%3A%22mygame%22%7D") && q.path.includes("sort=-created_date") && q.path.includes("limit=5"), "filter sends q, sort, limit");
const list = await base44.entities.PublishedGame.list();
assert(Array.isArray(list) && list.length === 1, "entities.list");
await base44.entities.PublishedGame.update(g.id, { title: "New" });
assert((await base44.entities.PublishedGame.filter({ name: "mygame" }))[0].title === "New", "entities.update");
await base44.entities.PublishedGame.delete(g.id);
assert((await base44.entities.PublishedGame.list()).length === 0, "entities.delete");

const r = await base44.functions.invoke("echo", { hi: 1 });
assert(r.status === 200 && r.data.got.hi === 1 && r.data.who === `Bearer ${v.access_token}`, "functions.invoke returns { data, status } and sends the token");
e = await base44.functions.invoke("echo", { fail: true }).catch((x) => x);
assert(e.response && e.response.status === 402 && e.response.data.error === "nope" && e.status === 402, "functions errors carry e.response.data like axios");
assert(seen.filter((x) => x.path.includes("/functions/echo")).every((x) => x.ct === "application/json"), "functions send JSON");

const login = await base44.auth.loginViaEmailPassword("kid@example.com", "longenough1");
assert(login.access_token && login.user.email === "kid@example.com", "email + password sign-in");
e = await base44.auth.loginViaEmailPassword("kid@example.com", "wrongpass1").catch((x) => x);
assert(e.status === 401, "a wrong password fails with 401");

globalThis.fetch = async () => {
  throw new TypeError("Failed to fetch");
};
e = await base44.functions.invoke("echo", {}).catch((x) => x);
assert(e.message === "Network Error" && !e.response, "offline looks like axios's Network Error");
writeFileSync(out, "");
