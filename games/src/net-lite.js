// ---------- real players (the same game server as Nebula Royale and Nebula Brawl) ----------
// Everyone playing this game at the same time shares a room: each page sends where its player is about ten times a
// second and shows the other real players with their names. Nothing is stored; offline the game plays as before.
// Added to the end of the game's own script: NETLITE(() => <the player object with .pos>).
function NETLITE(getMe) {
  const q = /[?&]srv=([^&#]+)/.exec(location.search), sv = q ? decodeURIComponent(q[1]) : "";
  const url = /^ws:\/\/(127\.0\.0\.1|localhost):\d{2,5}\/play$/.test(sv) ? sv : /[?&]test\b/.test(location.search) ? "" : "wss://nebula-royale.thebluedragonstriker.workers.dev/play";
  if (!url || typeof WebSocket == "undefined" || !window.crypto || !crypto.getRandomValues || typeof THREE == "undefined" || typeof scene == "undefined") return null;
  const N = { ws: null, up: false, peers: new Map(), tries: 0, sendT: 0 };
  let h = 0; for (const ch of String(document.title || location.pathname)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  N.room = "nr-k" + h.toString(36).padStart(6, "0").slice(0, 12);
  const un = window.nebulux && window.nebulux.username && window.nebulux.username !== "Anonymous" ? String(window.nebulux.username) : "";
  N.name = (un || "Player " + (100 + Math.floor(Math.random() * 900))).replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 18) || "Player";
  { let x = 0; for (const ch of N.name) x = (x * 33 + ch.charCodeAt(0)) >>> 0; N.c = [0xe53935, 0x8e24aa, 0x3949ab, 0x00897b, 0x7cb342, 0xfdd835, 0xfb8c00, 0xd81b60, 0x00acc1, 0x5e35b1][x % 10]; }
  let tok = ""; try { tok = localStorage.getItem("nr_tok_k") || ""; } catch { /* none */ }
  if (!/^[0-9A-HJKMNP-TV-Z]{20}$/.test(tok)) { const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ", b = new Uint8Array(20); crypto.getRandomValues(b); tok = [...b].map((x) => A[x & 31]).join(""); try { localStorage.setItem("nr_tok_k", tok); } catch { /* this visit only */ } }
  const box = (w, hh, d, c, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); m.position.y = y; return m; };
  function body(nm, shirt) {
    const g = new THREE.Group(); g.add(box(1, 1, 0.5, shirt || 0x29b6f6, 1.5)); g.add(box(0.7, 0.7, 0.7, 0xffcc80, 2.35)); const L1 = box(0.45, 1, 0.45, 0x37474f, 0.5), L2 = L1.clone(); L1.position.x = -0.25; L2.position.x = 0.25; g.add(L1); g.add(L2);
    const c = document.createElement("canvas"); c.width = 512; c.height = 128; const x = c.getContext("2d"); x.font = "900 56px Segoe UI, system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 12; x.strokeStyle = "#000"; x.strokeText(nm, 256, 64); x.fillStyle = "#9fe8ff"; x.fillText(nm, 256, 64);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); s.scale.set(3.2, 0.8, 1); s.position.y = 3.3; g.add(s);
    g.legs = [L1, L2]; return g;
  }
  function peer(p, d) {
    if (!d || d.v !== 3 || !Array.isArray(d.p)) return;
    let o = N.peers.get(p);
    if (!o) { const g = body(String(d.n || "Player").replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 18) || "Player", Number(d.c) & 0xffffff); scene.add(g); o = { g, to: new THREE.Vector3(d.p[0] / 10, d.p[1] / 10, d.p[2] / 10) }; g.position.copy(o.to); N.peers.set(p, o); }
    o.to.set(d.p[0] / 10, d.p[1] / 10, d.p[2] / 10); o.yaw = (d.y | 0) / 100; o.sp = (d.s | 0) / 10; o.at = performance.now();
  }
  const drop = (p) => { const o = N.peers.get(p); if (o) { scene.remove(o.g); N.peers.delete(p); } };
  const open = () => {
    let ws; try { ws = new WebSocket(url); } catch { return; }
    N.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: "hi", tok, peer: Math.random().toString(36).slice(2, 10), v: 1 }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === "ok") { N.up = true; N.tries = 0; ws.send(JSON.stringify({ t: "j", r: N.room })); return; }
      if (m.r !== N.room) return;
      if (m.t === "js") { for (const [p, d] of m.peers || []) peer(p, d); } else if (m.t === "u") peer(m.p, m.d); else if (m.t === "x") drop(m.p);
    };
    ws.onclose = () => { if (N.ws !== ws) return; N.up = false; N.ws = null; for (const p of [...N.peers.keys()]) drop(p); if (N.tries++ < 6) setTimeout(open, 3000 * N.tries); };
  };
  open();
  let last = performance.now(), T = 0;
  const frame = () => {
    requestAnimationFrame(frame); const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
    for (const [p, o] of N.peers) {
      if (now - (o.at || 0) > 6000) { drop(p); continue; }
      o.g.position.lerp(o.to, Math.min(1, dt * 10)); o.g.rotation.y += Math.atan2(Math.sin((o.yaw || 0) - o.g.rotation.y), Math.cos((o.yaw || 0) - o.g.rotation.y)) * Math.min(1, 12 * dt);
      const sw = Math.sin(T * 12) * Math.min((o.sp || 0) / 12, 1) * 0.9; o.g.legs[0].rotation.x = sw; o.g.legs[1].rotation.x = -sw;
    }
    const me = getMe();
    if (N.up && N.ws && me && me.pos && (N.sendT -= dt) <= 0) {
      N.sendT = 0.1;
      const yaw = me.yaw != null ? me.yaw : me.body && me.body.g ? me.body.g.rotation.y : 0, v = me.vel || { x: 0, z: 0 };
      try { N.ws.send(JSON.stringify({ t: "p", r: N.room, d: { v: 3, n: N.name, c: N.c, p: [Math.round(me.pos.x * 10), Math.round(me.pos.y * 10), Math.round(me.pos.z * 10)], y: Math.round(yaw * 100), s: Math.round(Math.hypot(v.x || 0, v.z || 0) * 10) } })); } catch { /* dropped */ }
    }
    let el = document.getElementById("netk"); const n = N.peers.size;
    if (n && !el) { el = document.createElement("div"); el.id = "netk"; el.style.cssText = "position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:30;padding:4px 12px;border-radius:999px;background:#0009;color:#9fe8ff;font:700 13px Segoe UI,system-ui;pointer-events:none"; document.body.appendChild(el); }
    if (el) { if (!n) el.remove(); else el.textContent = n + 1 + " real players here"; }
  };
  requestAnimationFrame(frame);
  if (/[?&]test\b/.test(location.search)) window.__netlite = N;
  return N;
}
