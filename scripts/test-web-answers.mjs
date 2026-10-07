// Offline test: questions about now (news, scores, weather, "today") are answered with a Google
// search and list their sources; others aren't searched; if searching fails the question is
// still answered without it; every call knows today's date. Run: node scripts/test-web-answers.mjs
import { fileURLToPath, pathToFileURL } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

let refuseSearch = false;
const bodies = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.includes("generativelanguage")) {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    if (body.tools && refuseSearch) return new Response('{"error":{"code":400,"message":"Search grounding is not supported."}}', { status: 400 });
    const chunk = { candidates: [{ content: { parts: [{ text: "The Lakers won 110-104." }] } }] };
    if (body.tools) chunk.candidates[0].groundingMetadata = { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/redirect/abc", title: "espn.com" } }, { web: { uri: "javascript:alert(1)", title: "bad" } }, { web: { uri: "https://vertexaisearch.cloud.google.com/redirect/def", title: "nba.com" } }] };
    return new Response(`data: ${JSON.stringify(chunk)}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  if (u.endsWith("/entities/User/me")) return new Response(JSON.stringify({ id: "u7", role: "user" }));
  if (u.includes("/entities/")) return new Response("[]");
  return new Response("{}");
};
const cache = new Map();
globalThis.caches = { default: { match: async (r) => (cache.has(r.url) ? new Response(cache.get(r.url)) : undefined), put: async (r, res) => cache.set(r.url, await res.text()) } };
const store = new Map();
// Test accounts have accepted the user agreement (its own tests: test-terms.mjs).
const kv = { get: async (k, t) => (store.has(k) ? (t === "json" ? JSON.parse(store.get(k)) : store.get(k)) : k.startsWith("terms:") ? { version: "2026-10-07-api" } : null), put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) };
const mod = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js").href);
const call = async (question) => {
  const r = await mod.onRequestPost({ request: new Request("https://x/", { method: "POST", headers: { authorization: "Bearer t", "content-type": "application/json" }, body: JSON.stringify({ prompt: question, question, model: "automatic" }) }), env: { PUBLISHED_HTML: kv, GEMINI_API_KEY: "k" }, waitUntil: () => {} });
  return [r.status, await r.json().catch(() => ({}))];
};

const { wantsSearch } = mod;
assert(wantsSearch("Who won the Lakers game last night? scores") && wantsSearch("What's the weather in Austin today?") && wantsSearch("latest iPhone news"), "questions about now are searched");
assert(!wantsSearch("Explain photosynthesis simply") && !wantsSearch("Write a poem about cats"), "everyday questions aren't");

let [s, b] = await call("Who won the Lakers game today?");
const sent = bodies[bodies.length - 1];
assert(s === 200 && Array.isArray(sent.tools) && sent.tools[0].google_search, "a search is asked for");
assert(b.content.startsWith("The Lakers won") && b.content.includes("[espn.com](https://vertexaisearch.cloud.google.com/redirect/abc)") && b.content.includes("nba.com"), "the answer ends with its sources");
assert(!b.content.includes("javascript:"), "only https source links");
assert(/Today's date is \d{4}-\d\d-\d\d\./.test(sent.systemInstruction.parts[0].text), "the AI is told today's date");

bodies.length = 0;
[s, b] = await call("Explain photosynthesis simply");
assert(s === 200 && !bodies[0].tools && !b.content.includes("Sources"), "no search for an everyday question");

bodies.length = 0;
refuseSearch = true;
[s, b] = await call("What's the latest news today?");
assert(s === 200 && bodies.length === 2 && bodies[0].tools && !bodies[1].tools && b.content === "The Lakers won 110-104.", "search refused: answered without it on the same model");

bodies.length = 0;
[s, b] = await call("Any breaking news today?");
assert(s === 200 && bodies.length === 1 && !bodies[0].tools, "after a refusal, search is skipped for a while (no wasted call)");
cache.clear();
refuseSearch = false;
bodies.length = 0;
[s, b] = await call("Any breaking news today?");
assert(bodies[0].tools && b.content.includes("Sources"), "and comes back once that wears off");

// "Who made you?" gets the identity reminder with the question; other questions don't.
{
  const { asksWhoItIs } = mod;
  assert(["Who made you?", "who created you", "What AI model are you?", "are you gemini", "What's your name?", "who are you"].every(asksWhoItIs), "questions about who the AI is are noticed");
  assert(!["Who made the Eiffel Tower?", "Explain photosynthesis", "What is the best AI for coding?"].some(asksWhoItIs), "other questions aren't");
  bodies.length = 0;
  await call("Who made you?");
  assert(JSON.stringify(bodies[0].contents).includes("created and owned by Vidish Narra"), "the reminder goes with that question");
  bodies.length = 0;
  await call("Explain photosynthesis simply");
  assert(!JSON.stringify(bodies[0].contents).includes("Reminder for this answer"), "and not with others");
}

// An answer that ran into the length limit is marked, so the app offers "Keep going".
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes("generativelanguage")) {
      const chunk = { candidates: [{ content: { parts: [{ text: "Part one of a long answer" }] }, finishReason: "MAX_TOKENS" }] };
      return new Response(`data: ${JSON.stringify(chunk)}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    return realFetch(url, opts);
  };
  const [s1, b1] = await call("Explain the whole history of Rome");
  assert(s1 === 200 && b1.more === true, "cut off by the length limit: marked more");
  globalThis.fetch = realFetch;
  const [, b2] = await call("Explain photosynthesis simply");
  assert(!b2.more, "a finished answer isn't");
}
