// Offline test: when Google's free AI is busy the server goes round the models once more before
// giving up, a busy answer is flagged (so the app asks again by itself) and not charged; chat
// titles are made without the AI (src/lib/chatTitle.js); Open from GitHub puts a page's own
// CSS/JS files into it (src/lib/repoPage.js). Run: node scripts/test-busy.mjs
import { fileURLToPath, pathToFileURL } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

let failFirst = 0;
const models = [];
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    models.push(u.split("/models/")[1].split(":")[0]);
    if (models.length <= failFirst) return new Response('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}', { status: 429 });
    const sse = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello!"}]}}]}\n\n';
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  if (u.endsWith("/entities/User/me")) return new Response(JSON.stringify({ id: "u9", role: "user" }));
  if (u.includes("/entities/")) return new Response("[]");
  return new Response("{}");
};
const cache = new Map();
globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
const store = new Map();
// Test accounts have accepted the user agreement (its own tests: test-terms.mjs).
const kv = { get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : k.startsWith("terms:") ? { version: "2026-10-07" } : null), put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) };
const { onRequestPost } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js").href);
const call = async (body) => {
  const r = await onRequestPost({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) }), env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k" }, waitUntil: () => {} });
  return [r.status, await r.json().catch(() => ({}))];
};
const charged = () => [...store.keys()].filter((k) => k.startsWith("usage:")).length;

failFirst = 4;
let [s, b] = await call({ prompt: "hi", model: "automatic" });
assert(s === 200 && b.content === "Hello!" && models.length === 5, "every model rate-limited: tried once more after a moment, and answered");

models.length = 0;
failFirst = 99;
[s, b] = await call({ prompt: "hi", model: "automatic" });
assert(s === 503 && b.busy === true && models.length === 8, "still busy after two rounds: a busy answer the app can ask again for");
assert(/very busy/.test(b.error) && !/Google|free tier/i.test(b.error), "the message doesn't talk about Google's free tier");
const before = charged();
assert(before <= 1, "busy answers aren't charged");

// Google finishing with an empty answer: the next model answers instead of a blank reply.
{
  let n = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("generativelanguage") && n++ === 0) return new Response('data: {"candidates":[{"finishReason":"OTHER","content":{"parts":[]}}]}\n\n', { status: 200 });
    return realFetch(url, init);
  };
  models.length = 0;
  failFirst = 0;
  const [s2, b2] = await call({ prompt: "hi", model: "automatic" });
  assert(s2 === 200 && b2.content === "Hello!", "an empty answer from Google falls through to the next model");
  globalThis.fetch = realFetch;
}
// A second free key: when the first key's limit is used up, the same model is asked with it.
{
  const keysSeen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("generativelanguage")) {
      const key = init.headers["x-goog-api-key"];
      keysSeen.push(key + "@" + String(url).split("/models/")[1].split(":")[0]);
      if (key === "k") return new Response('{"error":{"code":429}}', { status: 429 });
      return new Response('data: {"candidates":[{"content":{"parts":[{"text":"From key 2"}]}}]}\n\n', { status: 200 });
    }
    return realFetch(url, init);
  };
  const r = await onRequestPost({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ prompt: "hi", model: "automatic" }) }), env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k", GEMINI_API_KEY_2: "k2" }, waitUntil: () => {} });
  const j = await r.json();
  assert(j.content === "From key 2" && keysSeen.length === 2 && keysSeen[0].split("@")[1] === keysSeen[1].split("@")[1], "a used-up key moves to the next key on the same model");
  globalThis.fetch = realFetch;
}

// ---- chat titles ----
const { chatTitle } = await import(pathToFileURL(R + "src/lib/chatTitle.js").href);
assert(chatTitle("Hey, can you explain photosynthesis?") === "Explain photosynthesis", "filler words are dropped");
assert(chatTitle("what is a black hole") === "What is a black hole", "short questions kept, capitalised");
const long = chatTitle("Write me a really long story about a dragon who learns to bake bread in Paris");
assert(long.length <= 41 && long.endsWith("…") && !long.includes("  "), "long ones cut at a word");
assert(chatTitle("```js\nconst x = 1\n```") === "New chat" && chatTitle("") === "New chat", "code or nothing: New chat");

// ---- Open from GitHub ----
const { repoPathOf, inlineRepoFiles } = await import(pathToFileURL(R + "src/lib/repoPage.js").href);
assert(repoPathOf("style.css", "index.html") === "style.css" && repoPathOf("css/a.css", "docs/page.html") === "docs/css/a.css", "paths next to the page");
assert(repoPathOf("../a.css", "docs/page.html") === "a.css" && repoPathOf("/a.css", "docs/page.html") === "a.css", ".. and / paths");
assert(repoPathOf("../../a.css", "docs/page.html") === "" && repoPathOf("https://cdn.x/a.css", "index.html") === "" && repoPathOf("//cdn.x/a.css", "i.html") === "" && repoPathOf("data:text/css,x", "i.html") === "", "outside addresses left alone");
const files = { "style.css": "body{color:red}</style><script>alert(1)</script>", "js/app.js": "console.log('</script>')" };
const page = `<html><head><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="https://cdn.example/x.css"><link rel="icon" href="fav.png"></head><body><script src="js/app.js" defer></script><script src="missing.js"></script></body></html>`;
const out = await inlineRepoFiles(page, "index.html", async (p) => files[p] || "");
assert(out.inlined.join() === "style.css,js/app.js" && out.missing.join() === "missing.js", "its own CSS and JS are put in; missing files listed");
assert(out.html.includes('<style data-from="style.css">') && out.html.includes("https://cdn.example/x.css") && out.html.includes('href="fav.png"'), "outside stylesheets and icons stay links");
assert(!/<\/style><script>alert/.test(out.html) && out.html.includes("<\\/script>')"), "a file can't close its tag early and run something else");
assert(out.html.includes('<script data-from="js/app.js" defer>'), "script attributes kept");

// ---- GitHub: which pages Open repo lists, and reading a file back ----
{
  const gh = await import(pathToFileURL(R + "src/lib/githubClient.js").href);
  const tree = ["index.html", "about.htm", "docs/guide.html", "node_modules/pkg/readme.html", "style.css", "a/.git/x.html"].map((path) => ({ type: "blob", path, size: 100 }));
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/git/trees/")) return new Response(JSON.stringify({ tree }));
    if (u.includes("/contents/docs/my%20page.html")) return new Response(JSON.stringify({ content: Buffer.from("<p>héllo</p>").toString("base64").replace(/(.{8})/g, "$1\n") }));
    return new Response("{}", { status: 404 });
  };
  const pages = await gh.listPages("t", "me/site", "main");
  assert(pages.join() === "about.htm,index.html,docs/guide.html", "only web pages, skipping node_modules and .git, top folder first");
  assert((await gh.readFile("t", "me/site", "docs/my page.html")) === "<p>héllo</p>", "files are read back as UTF-8 (GitHub wraps its base64)");
  assert((await gh.readFile("t", "me/site", "nope.html")) === "", "a missing file reads as empty");
  let bad = "";
  await gh.listPages("t", "not a repo", "main").catch((e) => (bad = e.message));
  assert(/Pick a repository/.test(bad), "a bad repo name is refused before calling GitHub");
}
