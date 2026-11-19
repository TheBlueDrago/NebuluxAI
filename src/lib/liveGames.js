// Live player counts for the Arcade, from the game server (the same one Nebula Royale, Nebula Brawl and the Arcade
// games use for real players). The Arcade games say which game they are in the lobby room ("nr"); Nebula Royale's
// players are in that lobby too, and Nebula Brawl's in "nr-brawl". Nothing is sent about the person looking.
const SERVER = (typeof window !== "undefined" && window.__liveSrv) || "wss://nebula-royale.thebluedragonstriker.workers.dev/play"; // __liveSrv: tests only
export const liveKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function token() {
  let t = "";
  try { t = localStorage.getItem("nr_tok_k") || ""; } catch { /* no storage */ }
  if (!/^[0-9A-HJKMNP-TV-Z]{20}$/.test(t)) {
    const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", b = new Uint8Array(20); crypto.getRandomValues(b);
    t = [...b].map((x) => A[x & 31]).join("");
    try { localStorage.setItem("nr_tok_k", t); } catch { /* this visit only */ }
  }
  return t;
}

// onCounts({ [liveKey(game)]: players }, { [liveKey(game)]: title }) is called whenever the numbers change. Returns a function that stops it.
export function watchLiveGames(onCounts) {
  if (typeof WebSocket === "undefined" || !window.crypto || !crypto.getRandomValues) return () => {};
  const rooms = { nr: new Map(), "nr-brawl": new Map() };
  let ws = null, stopped = false, timer = 0;
  const send = () => {
    const c = {}, names = { nebularoyale: "Nebula Royale", nebulabrawl: "Nebula Brawl" };
    for (const d of rooms.nr.values()) {
      if (!d) continue;
      const k = d.v === 4 ? liveKey(d.g) : d.v === 1 ? "nebularoyale" : "";
      if (k) { c[k] = (c[k] || 0) + 1; if (d.v === 4 && d.g) names[k] = String(d.g).slice(0, 40); }
    }
    for (const d of rooms["nr-brawl"].values()) if (d && d.v === 2) c.nebulabrawl = (c.nebulabrawl || 0) + 1;
    onCounts(c, names);
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(send, 300); };
  try { ws = new WebSocket(SERVER); } catch { return () => {}; }
  ws.onopen = () => ws.send(JSON.stringify({ t: "hi", tok: token(), peer: Math.random().toString(36).slice(2, 10), v: 1 }));
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === "ok") { for (const r of Object.keys(rooms)) ws.send(JSON.stringify({ t: "j", r })); return; }
    const R = rooms[m.r]; if (!R) return;
    if (m.t === "js") { R.clear(); for (const [p, d] of m.peers || []) R.set(p, d); soon(); }
    else if (m.t === "u") { R.set(m.p, m.d); soon(); }
    else if (m.t === "x") { R.delete(m.p); soon(); }
  };
  ws.onerror = () => {};
  return () => { stopped = true; clearTimeout(timer); try { ws && ws.close(); } catch { /* closed */ } };
}

// For the Monitor: is the game server up, and is it the latest version (the one that knows Nebula Brawl's save path)?
// resolves { up: bool, latest: bool|null }. Reads and writes nothing.
export function checkGameServer() {
  return new Promise((resolve) => {
    if (typeof WebSocket === "undefined") return resolve({ up: false, latest: null });
    let ws, done = false;
    const end = (r) => { if (done) return; done = true; try { ws && ws.close(); } catch { /* closed */ } resolve(r); };
    setTimeout(() => end({ up: false, latest: null }), 9000);
    try { ws = new WebSocket(SERVER); } catch { return end({ up: false, latest: null }); }
    ws.onopen = () => ws.send(JSON.stringify({ t: "hi", tok: token(), peer: "mon" + Math.random().toString(36).slice(2, 8), v: 1 }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "ok") ws.send(JSON.stringify({ t: "db", i: 1, op: "get", path: "data/brawl/000000000000000000000000/monitor" }));
      if (m.t === "dbr") end({ up: true, latest: m.code !== "invalid_path" });
    };
    ws.onerror = () => end({ up: false, latest: null });
  });
}
