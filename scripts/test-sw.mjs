// Offline test: the installed app was removed, so public/sw.js only removes itself (every saved
// file, its registration) and reloads open pages. Run: node scripts/test-sw.mjs
import { readFileSync } from "node:fs";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

const listeners = {};
const deleted = [];
let unregistered = false;
const navigated = [];
const self = {
  addEventListener: (t, f) => (listeners[t] = f),
  skipWaiting: () => {},
  registration: { unregister: async () => (unregistered = true) },
  clients: { matchAll: async () => [{ url: "https://nebuluxai.com/chat", navigate: async (u) => navigated.push(u) }] },
};
const caches = { keys: async () => ["bh-shell-v4", "bh-assets-v1"], delete: async (k) => deleted.push(k) };
new Function("self", "caches", readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"))(self, caches);

assert(!listeners.fetch, "it no longer answers any requests (nothing is served from saved copies)");
let done;
listeners.activate({ waitUntil: (p) => (done = p) });
await done;
assert(deleted.join() === "bh-shell-v4,bh-assets-v1", "every saved file is deleted");
assert(unregistered, "it unregisters itself");
assert(navigated[0] === "https://nebuluxai.com/chat", "open pages reload straight from the website");
