// Service worker: makes the installed app (Safari's "Add to Home Screen", Chrome's Install)
// and repeat visits open fast by keeping the app's own files on the device.
// - /assets/* files have a content hash in their names, so a saved copy is always the right
//   one: downloaded once, then served from the device.
// - The app page for app screens (/, /chat…, sign-in) comes from the network, so it always
//   matches the code that's live (new versions go out many times a day and the old code files
//   are then gone). The saved copy is only used offline or when the network takes over 4s.
// - Everything else goes to the network untouched: /api (sign-in, data, AI, payments),
//   published sites, the public pages built by the server, and other websites.
// To switch this off for everyone, replace this file with one that calls
// self.registration.unregister() and deletes the caches.
// v2: v1 served its saved page first, which after a new version pointed at code that was gone.
// v4: a fresh start for everyone after the stuck "just updated" screen (app pages are now sent
// with "always check with the server", so the browser never hands back an old one).
const SHELL = "bh-shell-v5";
const NETWORK_WAIT_MS = 4000;
const ASSETS = "bh-assets-v1";
const MAX_ASSETS = 250;
const APP_ROUTES = /^\/(chat(\/.*)?|login|register|forgot-password|reset-password|plans|billing|promo-success|ThankYou)?$/;
const isCode = (res) => res && res.ok && !/text\/html/i.test(res.headers.get("content-type") || "");

self.addEventListener("install", (event) => {
  event.waitUntil(refreshShell().catch(() => null).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== SHELL && key !== ASSETS) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// Downloads the app page and the code it starts with, and saves the page only once its code
// is saved, so a saved page never points at code that isn't there.
// `given`: an app page just downloaded for a launch (saves downloading it twice).
let refreshing = null;
function refreshShell(given) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const res = given || (await fetch("/", { cache: "no-store" }));
    if (!res.ok || res.redirected || !/text\/html/i.test(res.headers.get("content-type") || "")) return;
    const html = await res.clone().text();
    const assets = await caches.open(ASSETS);
    const urls = [...new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) || [])];
    const saved = await Promise.all(
      urls.map(async (url) => {
        if (await assets.match(url)) return true;
        const r = await fetch(url).catch(() => null);
        if (!isCode(r)) return false;
        await assets.put(url, r);
        return true;
      })
    );
    if (saved.every(Boolean)) await (await caches.open(SHELL)).put("/", res);
    await trim(assets);
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

// Keeps the newest files (Cache keys come back oldest first).
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && req.destination === "document" && APP_ROUTES.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const network = fetch(req);
        let timer;
        const slow = new Promise((resolve) => (timer = setTimeout(resolve, NETWORK_WAIT_MS, "slow")));
        const first = await Promise.race([network.catch(() => "offline"), slow]);
        clearTimeout(timer);
        // The site is down for maintenance (503): show that, never the saved app.
        if (first !== "slow" && first !== "offline" && first.status === 503) return first;
        if (first !== "slow" && first !== "offline" && first.ok) {
          event.waitUntil(refreshShell(first.clone()).catch(() => {}));
          return first;
        }
        const cached = await (await caches.open(SHELL)).match("/");
        if (cached) {
          // Slow network: the saved copy opens now, and the new page (once it arrives) is saved
          // for next time, so a slow connection doesn't keep opening an old version.
          event.waitUntil(
            network
              .then((res) => (res && res.ok ? refreshShell(res.clone()) : null))
              .catch(() => {})
          );
          return cached;
        }
        return network;
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(req);
        if (hit) return hit;
        let res = await fetch(req);
        // A code file asked for while a new version was going out can come back as the app page,
        // and the browser keeps that copy for hours. Ask the server again, past that copy.
        if (!isCode(res)) res = await fetch(req, { cache: "reload" }).catch(() => res);
        if (isCode(res)) {
          event.waitUntil(cache.put(req, res.clone()).catch(() => {}));
        } else {
          // Code from an older version that's gone (a new version was published): drop the saved
          // page so the app's automatic reload (lib/lazyRetry.js) gets the new one.
          event.waitUntil(caches.delete(SHELL));
        }
        return res;
      })()
    );
  }
});
