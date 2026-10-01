// Offline test: the Website Designer's account autosave (functions/.../site-draft.js).
// Run: node scripts/test-site-draft.mjs
import { onRequestPost, cleanDraft } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/site-draft.js";
import { useOwnDb } from "../cloudflare-lib/published.js";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const store = new Map();
let writes = 0;
const kv = {
  get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : null),
  put: async (k, v) => (writes++, store.set(k, v)),
};
// A signed-in user, as the shared code sees it.
useOwnDb(null);
globalThis.fetch = async (url) => {
  if (String(url).includes("entities/User/me")) return new Response(JSON.stringify({ id: "u1", email: "a@b.c" }));
  return new Response("{}");
};
const call = async (body, auth = true) => {
  const res = await onRequestPost({ request: new Request("https://nebuluxai.com/x", { method: "POST", headers: auth ? { authorization: "Bearer t", "content-type": "application/json" } : {}, body: JSON.stringify(body) }), env: { PUBLISHED_HTML: kv } });
  return { status: res.status, body: await res.json() };
};
let r = await call({ action: "load" }, false);
assert(r.status === 401, "signed out: no draft");
r = await call({ action: "load" });
assert(r.body.draft === null, "nothing saved yet");
r = await call({ action: "save", siteName: "bakery", html: "<html>v1</html>", userTurns: ["make a bakery site"], projectId: "p1" });
assert(r.body.ok && writes === 1, "saves the site being worked on");
r = await call({ action: "save", siteName: "bakery", html: "<html>v1</html>", userTurns: ["make a bakery site"], projectId: "p1" });
assert(r.body.unchanged && writes === 1, "an unchanged save doesn't write again");
r = await call({ action: "load" });
assert(r.body.draft && r.body.draft.html === "<html>v1</html>" && r.body.draft.siteName === "bakery", "loads it back on another device");
r = await call({ action: "clear" });
r = await call({ action: "load" });
assert(r.body.draft === null, "cleared drafts don't come back");
const big = cleanDraft({ userTurns: Array.from({ length: 80 }, (_, i) => "x".repeat(5000) + i) });
assert(big.userTurns.length === 50 && big.userTurns[0].length === 4000, "requests are capped, so one account can't fill the storage");
