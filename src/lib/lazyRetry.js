import { lazy } from "react";
import { freshReload } from "@/lib/updateReload";

// Pages load on demand in separate files whose names change with every deploy. Anyone
// who had the app open during a deploy asks for the OLD file names, which no longer
// exist, and the page failed to load (the whole app went blank). When that happens,
// reload once to pick up the new version; if it still fails, let the error show.
// "Once" means once in 30 seconds: a flag kept for the whole session meant a second deploy
// later the same day showed the crash screen instead of reloading.
const KEY = "blackhole-chunk-reload";
const RETRY_AFTER_MS = 30000;

export function lazyRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
      return mod;
    } catch (err) {
      let reloaded = false;
      try {
        reloaded = Date.now() - (Number(sessionStorage.getItem(KEY)) || 0) < RETRY_AFTER_MS;
        if (!reloaded) sessionStorage.setItem(KEY, String(Date.now()));
      } catch {}
      if (!reloaded) {
        freshReload();
        // Keep React waiting while the page reloads.
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
