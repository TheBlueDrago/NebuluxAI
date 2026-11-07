// Pushing to GitHub from the designer (src/lib/githubClient.js), against a stand-in for GitHub's API:
// a file over 1 MB that's already there (GitHub only gives its details when asked for the "object" form),
// a new file, a version that changed in between, and errors in plain words.
import { pathToFileURL, fileURLToPath } from "node:url";
const gc = await import(pathToFileURL(fileURLToPath(new URL("../src/lib/githubClient.js", import.meta.url))).href);
let fails = 0, oks = 0;
const ok = (c, m) => { if (c) { oks++; console.log("ok   " + m); } else { fails++; console.log("FAIL " + m); } };

// a tiny GitHub: files by path, each { text, sha }
function fakeGitHub(files, opts = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url), method = init.method || "GET", accept = (init.headers || {}).Accept || "", path = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ""));
    calls.push({ method, accept, path });
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (opts.deny) return json(403, { message: "Resource not accessible by personal access token" });
    const f = files[path];
    if (method == "GET") {
      if (!f) return json(404, { message: "Not Found" });
      if (accept.includes("raw")) return new Response(f.text, { status: 200 });
      const big = f.text.length > 1_000_000;
      if (big && !accept.includes("object")) return json(403, { message: "This API returns blobs up to 1 MB in size. The requested blob is too large to fetch via the API, but you can use the Git Data API to request blobs up to 100 MB in size.", errors: [{ code: "too_large" }] });
      return json(200, { type: "file", sha: f.sha, size: f.text.length, content: big ? "" : Buffer.from(f.text).toString("base64"), encoding: big ? "none" : "base64" });
    }
    if (method == "PUT") {
      const body = JSON.parse(init.body);
      if (opts.conflictOnce) { opts.conflictOnce = 0; f.sha = "changed"; return json(409, { message: "is at changed but expected " + body.sha }); }
      if (f && body.sha !== f.sha) return json(409, { message: "sha mismatch" });
      if (!f && body.sha) return json(422, { message: "sha wasn't expected" });
      const text = Buffer.from(body.content, "base64").toString("utf8");
      files[path] = { text, sha: "v" + Math.random().toString(36).slice(2, 7) };
      return json(f ? 200 : 201, { content: { html_url: "https://github.com/me/site/blob/main/" + path } });
    }
    return json(405, {});
  };
  return calls;
}
const big = "<!doctype html><title>game</title>" + "x".repeat(1_150_000) + " é ";

// 1. updating an index.html that's already over 1 MB (the case that failed)
{ const files = { "index.html": { text: big, sha: "s1" } }; const calls = fakeGitHub(files);
  const url = await gc.pushFile("t", "me/site", big + "new", "Update", "index.html").catch((e) => "ERR " + e.message);
  ok(!String(url).startsWith("ERR") && files["index.html"].text.endsWith("new"), "updates an index.html that's over 1 MB (" + String(url).slice(0, 60) + ")");
  ok(calls.some((c) => c.method == "GET" && c.accept.includes("object")), "asks GitHub for the file's details in the form that works over 1 MB");
  ok(files["index.html"].text.includes(" é "), "keeps accented letters intact"); }
// 2. a new file
{ const files = {}; fakeGitHub(files); await gc.pushFile("t", "me/site", "<p>hi</p>", "Add", "index.html"); ok(files["index.html"] && files["index.html"].text == "<p>hi</p>", "creates index.html in an empty repo"); }
// 3. it changed between looking and saving: one more try
{ const files = { "index.html": { text: "old", sha: "s1" } }; fakeGitHub(files, { conflictOnce: 1 }); const r = await gc.pushFile("t", "me/site", "newer", "Update").catch((e) => "ERR " + e.message); ok(files["index.html"].text == "newer", "tries again if the file changed in between (" + String(r).slice(0, 40) + ")"); }
// 4. reading a big file back (Open from GitHub)
{ const files = { "index.html": { text: big, sha: "s1" } }; fakeGitHub(files); const t = await gc.readFile("t", "me/site", "index.html"); ok(t.length == big.length && t.includes(" é "), "opens a page over 1 MB from GitHub"); ok((await gc.readFile("t", "me/site", "nope.html")) === "", "a missing file reads as empty"); }
// 5. plain-words errors: a token without access says so, other problems don't blame the token
{ fakeGitHub({}, { deny: 1 }); const m = await gc.pushFile("t", "me/site", "x").catch((e) => e.message); ok(/can't use that repository/.test(m), "no access: " + m); }
{ globalThis.fetch = async () => new Response(JSON.stringify({ message: "API rate limit exceeded for user" }), { status: 403 }); const m = await gc.pushFile("t", "me/site", "x").catch((e) => e.message); ok(/too many requests/.test(m) && !/token/.test(m), "rate limit: " + m); }
console.log(`${oks} ok, ${fails} FAIL`); process.exitCode = fails ? 1 : 0;
