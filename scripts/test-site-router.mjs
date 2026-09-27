// Offline test for the published-sites Worker (workers/nebulux-site-router/worker.js, deployed
// by hand with wrangler): it serves each site with safety headers, never puts the requested
// address into its "not found" page unescaped, and leaves the app's own domain alone.
// Run: node scripts/test-site-router.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const worker = (await import(new URL("../workers/nebulux-site-router/worker.js", import.meta.url).href)).default;
let answer = { html: "<!DOCTYPE html><html><body>Nova</body></html>" };
const asked = [];
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  asked.push(url);
  if (url.includes("/functions/get-site-html")) {
    const { name } = JSON.parse(init.body);
    if (name === "down") throw new Error("offline");
    return answer && name === "nova" ? new Response(JSON.stringify(answer), { status: 200 }) : new Response("{}", { status: 404 });
  }
  if (url.includes("/functions/get-game-html")) {
    const { name } = JSON.parse(init.body);
    return name === "star-catch" ? new Response(JSON.stringify({ html: "<!DOCTYPE html><html><body>Star game</body></html>" }), { status: 200 }) : new Response("{}", { status: 404 });
  }
  return new Response("app", { status: 200 });
};
const get = (host) => worker.fetch(new Request(`https://${host}/`));

let res = await get("nova.blackhole-ai-tech.com");
assert(res.status === 200 && (await res.text()).includes("Nova"), "a published site is served");
for (const [h, v] of [["x-content-type-options", "nosniff"], ["referrer-policy", "strict-origin-when-cross-origin"], ["strict-transport-security", "max-age=31536000"]]) {
  assert(res.headers.get(h) === v, `with ${h}: ${v}`);
}
assert(/camera=\(\)/.test(res.headers.get("permissions-policy") || "") && /payment=\(\)/.test(res.headers.get("permissions-policy") || ""), "and no camera, microphone, USB or payment sheet for pages people make");

res = await get("ghost.blackhole-ai-tech.com");
const page = await res.text();
assert(res.status === 404 && page.includes("ghost") && res.headers.get("x-content-type-options") === "nosniff", "an unknown site gets the not-found page, with the same headers");
res = await get("down.blackhole-ai-tech.com");
assert(res.status === 502, "if the app can't be reached, a clear error page");

// The name comes from the address, and browsers' URL parsing already refuses hostnames with
// HTML characters in them; the Worker escapes it anyway.
{
  let refused = false;
  try {
    new URL('https://a"<img>.blackhole-ai-tech.com/');
  } catch {
    refused = true;
  }
  assert(refused, "a hostname with HTML in it can't even be requested");
}

asked.length = 0;
res = await get("blackhole-ai-tech.com");
assert(asked.length === 1 && !asked[0].includes("get-site-html"), "the app's own domain passes straight through");

// The new address, and games on their own address too.
res = await get("nova.nebuluxai.com");
assert(res.status === 200 && (await res.text()).includes("Nova"), "sites answer on name.nebuluxai.com too");
res = await get("star-catch.nebuluxai.com");
assert(res.status === 200 && (await res.text()).includes("Star game"), "a game gets its own address (no website by that name)");
res = await get("ghost.nebuluxai.com");
assert(res.status === 404, "neither a site nor a game: not found");
asked.length = 0;
res = await get("www.nebuluxai.com");
assert(asked.length === 1 && !asked[0].includes("get-site-html"), "www.nebuluxai.com passes straight through to the app");
res = await get("a.b.nebuluxai.com");
assert(res.status === 404, "deeper addresses aren't sites");

// Custom domains: a connected domain shows its website; any other outside address gets nothing.
{
  const env = { KV: { get: async (k) => (k === "domain:www.mybakery.com" ? { site: "nova" } : null) } };
  let r = await worker.fetch(new Request("https://www.mybakery.com/"), env);
  assert(r.status === 200 && (await r.text()).includes("Nova") && r.headers.get("x-content-type-options") === "nosniff", "a connected custom domain shows its website");
  r = await worker.fetch(new Request("https://random-other.com/"), env);
  assert(r.status === 404, "a domain nobody connected gets nothing");
}
{
  const env = { KV: { get: async (k) => (k === "domain:www.unproven.com" ? { site: "nova", pending: true } : null) } };
  const r = await worker.fetch(new Request("https://www.unproven.com/"), env);
  assert(r.status === 404, "a domain whose owner hasn't proven it yet isn't served");
}
