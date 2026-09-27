// Offline test: which addresses can be connected as a custom domain (functions/.../custom-domain.js).
// Run: node scripts/test-custom-domain.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const { cleanHostname } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/custom-domain.js").href);
assert(cleanHostname("www.MyBakery.com") === "www.mybakery.com", "a normal domain is kept, lowercased");
assert(cleanHostname("https://shop.example.co.uk/about?x=1") === "shop.example.co.uk", "https:// and paths are dropped");
assert(cleanHostname("example.com.") === "example.com", "a trailing dot is fine");
for (const bad of ["nebuluxai.com", "evil.nebuluxai.com", "x.blackhole-ai-tech.com", "a.pages.dev", "x.workers.dev", "localhost", "no spaces.com", "-bad.com", "a..com", "1.2.3.4", ""])
  assert(cleanHostname(bad) === "", `refused: "${bad}"`);
