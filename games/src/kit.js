// ---------- Nebulux games kit (games/src/kit.js) ----------
// Shared by the newer 3D games: scripts/build-games.mjs puts it into each game's single HTML file, so
// every game still works on its own. Third person, blocky Roblox-style characters, keyboard + mouse
// and touch controls, box collisions, waypoints for computer players, sounds and leaderboards.
const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ---------- sound (made on the fly, no files) ----------
let AC = null;
const audio = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch { AC = null; } return AC; };
function tone(f, d, type = "square", v = 0.06, slide = 0, when = 0) { const a = audio(); if (!a) return; const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
const SFX = {
  jump: () => tone(300, 0.12, "square", 0.04, 300),
  coin: () => { tone(988, 0.08, "square", 0.05); tone(1319, 0.14, "square", 0.05, 0, 0.07); },
  buy: () => [523, 784, 1047].forEach((n, i) => tone(n, 0.1, "triangle", 0.06, 0, i * 0.06)),
  no: () => tone(180, 0.25, "sawtooth", 0.05, -60),
  win: () => [523, 659, 784, 1047, 1319].forEach((n, i) => tone(n, 0.2, "triangle", 0.08, 0, i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((n, i) => tone(n, 0.25, "triangle", 0.07, 0, i * 0.14)),
  hit: () => tone(220, 0.12, "square", 0.05, -120),
  pop: () => tone(660, 0.08, "sine", 0.06, 500),
  zap: () => tone(1400, 0.3, "sawtooth", 0.04, -1100),
  tick: () => tone(880, 0.05, "square", 0.03),
};

// ---------- world ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement); const cvs = renderer.domElement;
const skyTex = (top, bottom) => { const c = document.createElement("canvas"); c.width = 2; c.height = 256; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.55, bottom); g.addColorStop(1, bottom); x.fillStyle = g; x.fillRect(0, 0, 2, 256); return new THREE.CanvasTexture(c); };
const scene = new THREE.Scene(); scene.background = skyTex("#3d8bff", "#cfe8ff"); scene.fog = new THREE.Fog(0xcfe8ff, 90, 260);
function setSky(top, bottom, fog, near = 90, far = 260) { scene.background = skyTex(top, bottom); scene.fog = new THREE.Fog(fog, near, far); }
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 700);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x88aacc, 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, far: 250 }); scene.add(sun, sun.target);
const mats = {}; const mat = (c, e = 0) => mats[c + "_" + e] || (mats[c + "_" + e] = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.02, color: c, emissive: e }));
const boxMesh = (w, h, d, c, e) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, e)); m.castShadow = m.receiveShadow = true; return m; };
function makeLabel(text, color = "#fff", w = 512, size = 64) {
  const c = document.createElement("canvas"); c.width = w; c.height = 128; const x = c.getContext("2d");
  x.font = `900 ${size}px Segoe UI, system-ui`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = 12; x.strokeStyle = "#000"; x.strokeText(text, w / 2, 64); x.fillStyle = color; x.fillText(text, w / 2, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false })); s.scale.set(w / 128, 1, 1); return s;
}

// Every solid is an axis-aligned box { x, y, z (center), w, h, d }. Walls also block the camera and sight.
const solids = [], sightBlockers = [];
function addBox(x, y, z, w, h, d, color, o = {}) {
  const m = boxMesh(w, h, d, color, o.glow || 0); m.position.set(x, y, z); if (o.noShadow) m.castShadow = false; scene.add(m);
  const s = { x, y, z, w, h, d, m, kind: o.kind || "solid", dx: 0, dz: 0 };
  if (!o.ghost) solids.push(s);
  if (o.wall) sightBlockers.push(m);
  return s;
}
const removeSolid = (s) => { const i = solids.indexOf(s); if (i >= 0) solids.splice(i, 1); scene.remove(s.m); };

// ---------- blocky characters ----------
function makeAvatar({ shirt = 0x1e88e5, pants = 0x37474f, skin = 0xffcc80, hat = null, face = 0x111111 } = {}) {
  const g = new THREE.Group(); const torso = boxMesh(1.6, 1.6, 0.8, shirt); torso.position.y = 2.4; g.add(torso);
  const head = boxMesh(1.1, 1.1, 1.1, skin); head.position.y = 3.75; g.add(head);
  const eyes = boxMesh(0.6, 0.15, 0.05, face); eyes.position.set(0, 3.85, 0.56); g.add(eyes);
  if (hat !== null) { const h = boxMesh(1.25, 0.35, 1.25, hat); h.position.y = 4.45; g.add(h); }
  const legs = [], arms = [];
  for (const sx of [-0.4, 0.4]) {
    const L = new THREE.Group(); L.position.set(sx, 1.6, 0); const l = boxMesh(0.78, 1.6, 0.78, pants); l.position.y = -0.8; L.add(l); g.add(L); legs.push(L);
    const A = new THREE.Group(); A.position.set(sx * 2.5, 3.1, 0); const a = boxMesh(0.75, 1.6, 0.75, skin); a.position.y = -0.7; A.add(a); g.add(A); arms.push(A);
  }
  g.scale.setScalar(0.62); return { g, legs, arms, torso, head };
}
// A name over someone's head (in the body's own units: the body is drawn at 0.62 scale).
function nameTag(text, color = "#fff", throughWalls = false) { const s = makeLabel(text, color, 512, 56); s.scale.set(3.2 / 0.62, 0.8 / 0.62, 1); s.position.y = 5.1; s.material.depthTest = !throughWalls; s.renderOrder = 5; return s; }
// Walk / jump animation. sp: ground speed.
function animate(b, sp, onGround, T) {
  const sw = Math.sin(T * 12) * Math.min(sp / 12, 1) * 0.9;
  b.legs[0].rotation.x = onGround ? sw : -0.5; b.legs[1].rotation.x = onGround ? -sw : 0.3;
  if (!b.pose) { b.arms[0].rotation.x = onGround ? -sw : -2.6; b.arms[1].rotation.x = onGround ? sw : -2.6; }
}
const HW = 0.45, HH = 2.6; // a character's half-width and height
const BOT_COLORS = [0xe53935, 0x8e24aa, 0x3949ab, 0x00897b, 0x7cb342, 0xfdd835, 0xfb8c00, 0x6d4c41, 0xd81b60, 0x00acc1, 0x5e35b1, 0x43a047];
const SKINS = [0xffcc80, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const BOT_NAMES = ["Pixel", "Nova", "Blocky", "Zed", "Mango", "Comet", "Sparky", "Luna", "Echo", "Biscuit", "Jinx", "Orbit", "Turbo", "Maple", "Fizz", "Rocket", "Pepper", "Quill", "Nugget", "Sky"];
const ME_NAME = (window.nebulux && window.nebulux.username && window.nebulux.username !== "Anonymous") ? String(window.nebulux.username).slice(0, 18) : "You";

// One physics step for a character { pos, vel, onGround, ground, coyote, buffer }: walk toward `want`
// (a velocity), gravity, push out of boxes one axis at a time, step up small ledges. -> the box it stands on.
const overlap = (p, s, hw = HW) => Math.abs(p.x - s.x) < s.w / 2 + hw && Math.abs(p.z - s.z) < s.d / 2 + hw && p.y < s.y + s.h / 2 && p.y + HH > s.y - s.h / 2;
function physics(e, want, dt, jumpV = 15.5, accel = 16) {
  if (e.onGround && e.ground) { e.pos.x += e.ground.dx || 0; e.pos.z += e.ground.dz || 0; }
  const k = e.onGround ? accel : 7;
  e.vel.x += (want.x - e.vel.x) * Math.min(1, k * dt); e.vel.z += (want.z - e.vel.z) * Math.min(1, k * dt);
  e.coyote = e.onGround ? 0.1 : (e.coyote || 0) - dt; e.buffer = (e.buffer || 0) - dt;
  if (e.wantJump && e.coyote > 0) { e.vel.y = jumpV; e.coyote = 0; e.buffer = 0; e.onGround = false; e.wantJump = false; if (e === P) SFX.jump(); }
  e.vel.y = Math.max(e.vel.y - 40 * dt, -60);
  let landed = null; e.bumped = false;
  for (const a of ["x", "z", "y"]) {
    e.pos[a] += e.vel[a] * dt;
    for (const s of solids) {
      if (s.off || !overlap(e.pos, s)) continue;
      if (a === "y") { if (e.vel.y <= 0) { e.pos.y = s.y + s.h / 2; landed = s; } else e.pos.y = s.y - s.h / 2 - HH; e.vel.y = 0; }
      else {
        const top = s.y + s.h / 2 - e.pos.y;
        if (top < 0.6 && top > 0) { e.pos.y = s.y + s.h / 2; continue; }
        const c = a === "x" ? s.x : s.z, half = (a === "x" ? s.w : s.d) / 2 + HW;
        e.pos[a] = e.pos[a] > c ? c + half : c - half; e.vel[a] = 0; e.bumped = true;
      }
    }
  }
  e.onGround = !!landed; e.ground = landed; return landed;
}

// ---------- the player ----------
const P = { body: makeAvatar(), pos: V(0, 1, 0), vel: V(), onGround: false, ground: null, yaw: 0, speed: 13, jump: 15.5, canMove: true };
scene.add(P.body.g);
const cam = { yaw: 0, pitch: 0.35, dist: 13, min: 5, max: 30 };
const keys = {}; let started = false, locked = false, rmb = false;
const actions = {}; // key code -> function (the game adds its own, e.g. actions.KeyE = interact)
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (!started) return;
  if (e.code === "Space") { P.wantJump = true; e.preventDefault(); }
  if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "ShiftLeft") { e.preventDefault(); if (locked) document.exitPointerLock?.(); else cvs.requestPointerLock?.(); }
  if (actions[e.code] && !e.repeat) { e.preventDefault(); actions[e.code](); }
});
addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Space") P.wantJump = false; });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cvs; });
cvs.addEventListener("mousedown", (e) => { if (e.button === 2) rmb = true; if (e.button === 0 && started && actions.click) actions.click(); });
addEventListener("mouseup", (e) => { if (e.button === 2) rmb = false; });
cvs.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("mousemove", (e) => { if (rmb || locked) { cam.yaw -= clamp(e.movementX, -60, 60) * 0.005; cam.pitch = clamp(cam.pitch + clamp(e.movementY, -60, 60) * 0.004, -0.3, 1.35); } });
cvs.addEventListener("wheel", (e) => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 1.5, cam.min, cam.max); }, { passive: true });
const joy = { x: 0, y: 0, id: null };
const touch = matchMedia("(pointer: coarse)").matches;
if (touch) document.body.classList.add("touch");
// Touch: a joystick on the left, drag anywhere else to look, and big round buttons on the right.
function touchControls(buttons) {
  if (!touch) return;
  const box = $("touch"); if (!box) return;
  box.innerHTML = '<div id="joy"><div id="knob"></div></div>' + buttons.map((b, i) => `<button class="tb" id="tb${i}" style="bottom:${30 + Math.floor(i / 2) * 104}px;right:${24 + (i % 2) * 104}px;background:${b.color || "rgba(58,209,58,.85)"}">${b.label}</button>`).join("");
  const J = $("joy"), K = $("knob");
  const setJoy = (t) => { const r = J.getBoundingClientRect(); let x = (t.clientX - r.left - r.width / 2) / (r.width / 2), y = (t.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } joy.x = x; joy.y = y; K.style.transform = `translate(${x * 40}px,${y * 40}px)`; };
  J.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.changedTouches[0]; joy.id = t.identifier; setJoy(t); }, { passive: false });
  addEventListener("touchmove", (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) setJoy(t); }, { passive: true });
  const end = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; K.style.transform = ""; } };
  addEventListener("touchend", end); addEventListener("touchcancel", end);
  buttons.forEach((b, i) => {
    const el = $("tb" + i); b.el = el;
    el.addEventListener("touchstart", (e) => { e.preventDefault(); b.down?.(); }, { passive: false });
    el.addEventListener("touchend", (e) => { e.preventDefault(); b.up?.(); }, { passive: false });
  });
  let look = null;
  cvs.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; if (!look) look = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
  cvs.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) if (look && t.identifier === look.id) { cam.yaw -= (t.clientX - look.x) * 0.008; cam.pitch = clamp(cam.pitch + (t.clientY - look.y) * 0.006, -0.3, 1.35); look.x = t.clientX; look.y = t.clientY; } }, { passive: true });
  const endL = (e) => { for (const t of e.changedTouches) if (look && t.identifier === look.id) look = null; };
  cvs.addEventListener("touchend", endL); cvs.addEventListener("touchcancel", endL);
  return buttons;
}
const JUMP_BUTTON = { label: "JUMP", down: () => { P.wantJump = true; }, up: () => { P.wantJump = false; } };
function moveDir() {
  const f = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = V(-f.z, 0, f.x), d = V();
  if (keys.KeyW || keys.ArrowUp) d.add(f); if (keys.KeyS || keys.ArrowDown) d.sub(f); if (keys.KeyD || keys.ArrowRight) d.add(r); if (keys.KeyA || keys.ArrowLeft) d.sub(r);
  if (joy.x || joy.y) d.addScaledVector(r, joy.x).addScaledVector(f, -joy.y);
  return d.lengthSq() > 1 ? d.normalize() : d;
}
// Move the player one frame (unless the game froze them) and turn the body the way they walk.
function stepPlayer(dt, T) {
  const want = P.canMove ? moveDir().multiplyScalar(P.speed) : V();
  if (!P.canMove) P.wantJump = false;
  const landed = physics(P, want, dt, P.jump);
  if (want.lengthSq() > 1) P.yaw = Math.atan2(want.x, want.z);
  if (locked) P.yaw = cam.yaw + Math.PI;
  P.body.g.rotation.y += angDiff(P.yaw, P.body.g.rotation.y) * Math.min(1, 15 * dt);
  P.body.g.position.copy(P.pos);
  animate(P.body, Math.hypot(P.vel.x, P.vel.z), P.onGround, T);
  return landed;
}
// Third-person camera behind `target` (the player unless the game says otherwise); it pulls in
// instead of going through walls.
const ray = new THREE.Raycaster();
function updateCamera(dt, target = P.pos) {
  const head = target.clone().setY(target.y + 2.2);
  const dir = V(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let dist = cam.dist;
  if (sightBlockers.length) { ray.set(head, dir); ray.far = cam.dist; const hit = ray.intersectObjects(sightBlockers, false)[0]; if (hit) dist = Math.max(1.2, hit.distance - 0.5); }
  camera.position.lerp(head.clone().addScaledVector(dir, dist), 1 - Math.exp(-16 * dt)); camera.lookAt(head);
  sun.position.copy(target).add(V(30, 60, 20)); sun.target.position.copy(target);
}
// Can a see b (both points), with no wall in between?
function canSee(a, b) {
  const d = b.clone().sub(a), len = d.length(); if (len < 0.01) return true;
  ray.set(a, d.divideScalar(len)); ray.far = len; return ray.intersectObjects(sightBlockers, false).length === 0;
}

// ---------- waypoints (computer players find their way between rooms) ----------
// nodes: [V], links: [[i, j]]. route(fromPos, toNode) -> the list of points to walk through.
function makeNav(nodes, links) {
  const adj = nodes.map(() => []); for (const [a, b] of links) { adj[a].push(b); adj[b].push(a); }
  const nearest = (p) => { let best = 0, bd = Infinity; nodes.forEach((n, i) => { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd && canSee(p.clone().setY(p.y + 2), n.clone().setY(p.y + 2))) { bd = d; best = i; } }); return best; };
  const route = (from, to) => {
    const s = nearest(from), prev = new Array(nodes.length).fill(-1), q = [s], seen = new Set([s]);
    while (q.length) { const c = q.shift(); if (c === to) break; for (const n of adj[c]) if (!seen.has(n)) { seen.add(n); prev[n] = c; q.push(n); } }
    const path = []; for (let c = to; c !== -1; c = prev[c]) { path.unshift(nodes[c]); if (c === s) break; }
    return path;
  };
  return { nodes, adj, nearest, route };
}
// Walk a computer player { pos, vel, path, ... } along its path. -> true once it has arrived.
function followPath(e, dt, speed) {
  while (e.path && e.path.length && Math.hypot(e.path[0].x - e.pos.x, e.path[0].z - e.pos.z) < 1.2) e.path.shift();
  const t = e.path && e.path[0];
  const want = t ? V(t.x - e.pos.x, 0, t.z - e.pos.z).normalize().multiplyScalar(speed) : V();
  physics(e, want, dt);
  if (e.bumped && e.onGround && Math.random() < 0.08) e.wantJump = true;
  return !t;
}
function walkToward(e, p, dt, speed) { const want = V(p.x - e.pos.x, 0, p.z - e.pos.z); if (want.lengthSq() > 0.01) want.normalize().multiplyScalar(speed); physics(e, want, dt); }
function faceMove(e, dt) { const sp = Math.hypot(e.vel.x, e.vel.z); if (sp > 0.5) e.yaw = Math.atan2(e.vel.x, e.vel.z); e.body.g.rotation.y += angDiff(e.yaw || 0, e.body.g.rotation.y) * Math.min(1, 10 * dt); e.body.g.position.copy(e.pos); return sp; }

// ---------- messages ----------
let msgT = 0;
function show(t, s = 1.8) { const m = $("msg"); if (!m) return; m.innerText = t; m.style.opacity = 1; msgT = s; }
function tickMsg(dt) { if (msgT > 0) { msgT -= dt; if (msgT <= 0 && $("msg")) $("msg").style.opacity = 0; } }

// ---------- leaderboards (on Nebulux AI the game gets window.nebulux.score / .top) ----------
const NX = window.nebulux && window.nebulux.top ? window.nebulux : null;
function sendScore(board, score) { if (NX && Number.isFinite(score)) NX.score(board, score).catch?.(() => {}); }

// ---------- saving (this browser) ----------
function loadSave(key, def) { try { const s = JSON.parse(localStorage.getItem(key) || "null"); return s ? { ...def, ...s } : { ...def }; } catch { return { ...def }; } }
function storeSave(key, s) { try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* no storage */ } }

// ---------- the loop ----------
// Opened with ?test (only by the automated checks): window.__kit can run the game faster.
const TEST = /[?&]test\b/.test(location.search);
let timeScale = 1;
const clock = new THREE.Clock(); let T = 0; const frames = [];
const onFrame = (f) => frames.push(f);
function loop() { requestAnimationFrame(loop); const dt = Math.min(clock.getDelta(), 0.04); for (let i = 0; i < timeScale; i++) { T += dt; for (const f of frames) f(dt, T); tickMsg(dt); } renderer.render(scene, camera); }
if (TEST) window.__kit = { speed: (n) => { timeScale = Math.max(1, Math.min(20, n | 0)); }, P, cam, keys };
// ---------- end of kit ----------
