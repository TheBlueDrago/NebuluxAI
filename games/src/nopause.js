// ---------- no pausing (owner rule: games never pause, like a real online game) ----------
// Browsers stop animation frames while the tab is hidden, which would freeze the game. Every frame callback is kept
// here; the browser runs it as usual, and while the tab is hidden a worker timer runs it instead (about 30 a second),
// so the game, its bots and its timers carry on until you come back.
(() => {
  if (window.__noPause) return; window.__noPause = 1;
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window), pend = new Map(), nat = new Map();
  let n = 0, w = null;
  const runAll = () => { const t = performance.now(), cbs = [...pend.entries()]; pend.clear(); for (const [k, f] of cbs) { const x = nat.get(k); if (x) { caf(x); nat.delete(k); } try { f(t); } catch (e) { console.error(e); } } };
  const tick = () => { if (document.hidden) runAll(); };
  const start = () => { if (w) return; try { w = new Worker(URL.createObjectURL(new Blob(["setInterval(function(){postMessage(0)},33)"], { type: "text/javascript" }))); w.onmessage = tick; } catch (e) { w = { iv: setInterval(tick, 33) }; } };
  const stop = () => { if (!w) return; if (w.terminate) w.terminate(); else clearInterval(w.iv); w = null; };
  window.requestAnimationFrame = (f) => { const k = ++n; pend.set(k, f); nat.set(k, raf((t) => { nat.delete(k); const g = pend.get(k); if (g) { pend.delete(k); g(t); } })); if (document.hidden) start(); return k; };
  window.cancelAnimationFrame = (k) => { pend.delete(k); const x = nat.get(k); if (x) { caf(x); nat.delete(k); } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) start(); else stop(); });
})();
