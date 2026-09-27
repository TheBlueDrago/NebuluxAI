// The installed app was removed (owner, 2026-09-27). This service worker only removes itself:
// devices that still have the old one fetch this, which deletes every saved file, unregisters,
// and reloads open pages so they come straight from the website.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url).catch(() => {});
    })()
  );
});
