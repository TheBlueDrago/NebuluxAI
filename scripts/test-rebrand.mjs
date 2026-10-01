// Offline test: pages made before the rename show Nebulux AI, not the old name
// (cloudflare-lib/pageserve.js rebrand). Run: node scripts/test-rebrand.mjs
import { rebrand } from "../cloudflare-lib/pageserve.js";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
assert(rebrand("<footer>Made with Blackhole AI</footer>") === "<footer>Made with Nebulux AI</footer>", "'Blackhole AI' becomes 'Nebulux AI'");
assert(rebrand("Checkout by BLACKHOLE AI") === "Checkout by NEBULUX AI", "capitals stay capitals");
assert(rebrand("Powered by BlackholeAI and blackhole ai") === "Powered by Nebulux AI and Nebulux AI", "no-space and lower-case versions too");
assert(rebrand('<a href="https://nova.blackhole-ai-tech.com/x">') === '<a href="https://nova.nebuluxai.com/x">', "old site links point to nebuluxai.com");
assert(rebrand("Visit blackhole-ai-tech.com today") === "Visit nebuluxai.com today", "the old address in text");
assert(rebrand("<h1>Black holes</h1><p>A black hole pulls in light.</p>") === "<h1>Black holes</h1><p>A black hole pulls in light.</p>", "black holes in space are left alone");
assert(rebrand('<script id="blackhole-products">') === '<script id="blackhole-products">', "code names aren't changed (they'd break the page)");
