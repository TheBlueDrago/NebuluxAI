// Offline test: attached images reach Gemini (with limits); free "internal" AI calls (chat titles) are held to the basic model, a
// short prompt and a per-user rate; normal calls are still charged. Run: node scripts/test-ai-internal.mjs
const F = new URL("../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/", import.meta.url).pathname;
const assert = (c, m) => { if (!c) { console.error("FAIL", m); process.exitCode = 1; } else console.log("ok", m); };
// Rate limits count per clock minute or hour: pin the clock 30 seconds past an hour so a run
// can't straddle two windows (which made the per-minute check fail now and then).
const pinnedNow = Math.floor(Date.now() / 3600000) * 3600000 + 30000;
Date.now = () => pinnedNow;
const models = [];
const bodies = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    models.push(u.split("/models/")[1].split(":")[0]);
    bodies.push(JSON.parse(opts.body));
    const sse = 'data: {"candidates":[{"content":{"parts":[{"text":"My Title"}]}}]}\n\n';
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  if (u.endsWith("/entities/User/me")) return new Response(JSON.stringify({ id: "u1", role: "user" }));
  if (u.includes("/entities/")) return new Response("[]");
  return new Response("{}");
};
const cache = new Map();
globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
const store = new Map();
// Test accounts have accepted the user agreement (its own tests: test-terms.mjs).
const kv = { get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : k.startsWith("terms:") ? { version: "2026-10-07-api" } : null), put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) };
const { onRequestPost } = await import(F + "chatCompletion.js");
const call = async (body) => {
  const r = await onRequestPost({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify(body) }), env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k" }, waitUntil: () => {} });
  return [r.status, await r.json().catch(() => ({}))];
};
let [s, b] = await call({ prompt: "Name this chat", internal: true, model: "claude-sonnet-5" });
assert(s === 200 && b.content === "My Title" && models.join(",") === "gemini-3.6-flash", "internal call uses the basic model only");
{
  const sent = bodies[bodies.length - 1];
  const rules = sent.systemInstruction && sent.systemInstruction.parts && sent.systemInstruction.parts[0].text;
  assert(typeof rules === "string" && /children/.test(rules) && /recovery phrase/.test(rules) && /bully/.test(rules), "every call carries the server's safety rules as the system instruction");
  assert(Object.keys(sent).sort().join() === "contents,generationConfig,systemInstruction", "and only the fields Gemini accepts");
}
[s, b] = await call({ prompt: "x".repeat(2000), internal: true });
assert(s === 400, "long internal prompt refused");
let last;
for (let i = 0; i < 30; i++) [last] = await call({ prompt: "t", internal: true });
assert(last === 429, "31st internal call in an hour throttled");
// the Help assistant: free, basic model, its guide added on the server, history kept short
bodies.length = 0; models.length = 0;
const helpUsage = [...store.keys()].filter((k) => k.startsWith("usage:")).length;
[s, b] = await call({ help: true, prompt: "How do I publish a website?", history: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hello!" }], model: "claude-sonnet-5" });
{
  const text = JSON.stringify(bodies[bodies.length - 1].contents);
  assert(s === 200 && b.content === "My Title" && models.join(",") === "gemini-3.6-flash", "help answers with the basic model");
  assert(/WEBSITE DESIGNER/.test(text) && /How do I publish a website/.test(text) && /User: hi/.test(text), "help sends its guide, the history and the question");
  assert([...store.keys()].filter((k) => k.startsWith("usage:")).length === helpUsage && !b.charged, "help is free");
}
[s, b] = await call({ help: true, prompt: "   " });
assert(s === 400, "an empty help question is refused");
models.length = 0;
[s, b] = await call({ prompt: "hello", model: "automatic" });
assert(s === 200 && b.charged === 1 && [...store.keys()].some((k) => k.startsWith("usage:")), "normal call is charged");

// ---- images ----
bodies.length = 0;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
[s, b] = await call({ prompt: "what is this?", images: [{ mimeType: "image/png", data: png }] });
const parts = bodies[0].contents[0].parts;
assert(s === 200 && parts.length === 2 && parts[1].inline_data.mime_type === "image/png" && parts[1].inline_data.data === png, "image forwarded to Gemini");
[s, b] = await call({ prompt: "x", images: [{ mimeType: "text/html", data: "PGh0bWw+" }] });
assert(s === 400 && /isn't supported/.test(b.error), "bad image type refused");
[s, b] = await call({ prompt: "x", images: [1, 2, 3, 4].map(() => ({ mimeType: "image/png", data: png })) });
assert(s === 400 && /at most 3/.test(b.error), "more than 3 images refused");
bodies.length = 0;
cache.clear();
[s, b] = await call({ prompt: "Name it", internal: true, images: [{ mimeType: "image/png", data: png }] });
assert(s === 200 && bodies[0].contents[0].parts.length === 1, "internal calls ignore images");

// ---- Stop: the app hangs up mid-reply ----
// A fake Gemini stream that sends 50 chunks of 1,000 characters, slowly.
let chunksSent = 0;
const realFetch2 = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (!String(url).includes("generativelanguage")) return realFetch2(url, opts);
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async pull(ctrl) {
      if (chunksSent >= 50) return ctrl.close();
      await new Promise((r) => setTimeout(r, 5));
      chunksSent++;
      ctrl.enqueue(enc.encode(`data: {"candidates":[{"content":{"parts":[{"text":"${"x".repeat(1000)}"}]}}]}\n\n`));
    },
  });
  return new Response(body, { status: 200 });
};
const usageBefore = () => { const k = [...store.keys()].find((x) => x.startsWith("usage:")); return k ? JSON.parse(store.get(k)).ai || 0 : 0; };
const streamCall = async (stopAfterDeltas) => {
  let work;
  const r = await onRequestPost({
    request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify({ prompt: "write a lot", model: "automatic", stream: true, effort: "low" }) }),
    env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k" },
    waitUntil: (p) => { work = p; },
  });
  const reader = r.body.getReader();
  let deltas = 0;
  if (stopAfterDeltas === Infinity) { for (;;) { const { done } = await reader.read(); if (done) break; } }
  else {
    while (deltas < stopAfterDeltas) { const { value } = await reader.read(); deltas += new TextDecoder().decode(value).split("\n").filter((l) => l.includes('"delta"')).length; }
    await reader.cancel();
  }
  await work;
};
chunksSent = 0;
let u0 = usageBefore();
await streamCall(Infinity);
const fullCost = usageBefore() - u0;
assert(chunksSent === 50 && fullCost === 5, "a full 50,000-character reply costs 5 credits (" + fullCost + ")");
chunksSent = 0;
u0 = usageBefore();
await streamCall(3);
const stoppedCost = usageBefore() - u0;
assert(chunksSent < 20 && stoppedCost >= 1 && stoppedCost < 5, `pressing Stop ends generation early (${chunksSent}/50 chunks) and charges only what was written (${stoppedCost} credit)`);

// Message size cap and the per-minute limit on new replies.
{
  const [st, bd] = await call({ prompt: "x".repeat(800001), model: "automatic" });
  assert(st === 413 && /too long/.test(bd.error), "a message over 800,000 characters is refused");
  cache.clear();
  const statuses = [];
  for (let i = 0; i < 16; i++) statuses.push((await call({ prompt: "hi", model: "automatic" }))[0]);
  assert(statuses.slice(0, 15).every((x) => x !== 429) && statuses[15] === 429, "the 16th reply started within a minute is refused: " + statuses.join(","));
  cache.clear();
}
