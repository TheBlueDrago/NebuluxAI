// Notifications in the app (the bell): the AI finishing while you were on another tab, purchases,
// keeps one live connection for new messages, typing and notifications, and plays the
// notification sound. The bell (components/NotificationBell.jsx) also shows things that happen
// in the app itself: the AI finishing while you're on another tab, purchases, updates.
const BASE = "https://chat.nebuluxai.com";
const token = () => {
  try {
    return localStorage.getItem("base44_access_token") || "";
  } catch {
    return "";
  }
};

export async function chatApi(path, method = "GET", body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "Something went wrong.");
    e.status = res.status;
    throw e;
  }
  return data;
}

// --- live connection (shared by every screen), reconnecting after drops
const listeners = new Set();
let ws = null;
let retry = 0;
let wanted = false;
let pingTimer = null;
export const onChatEvent = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const emit = (e) => listeners.forEach((f) => f(e));

export function connectChat() {
  wanted = true;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  const t = token();
  if (!t) return;
  try {
    ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(t)}`);
  } catch {
    return;
  }
  ws.onopen = () => {
    retry = 0;
    emit({ type: "connected" });
    clearInterval(pingTimer);
    pingTimer = setInterval(() => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: "ping" })), 25000);
  };
  ws.onmessage = (m) => {
    let e;
    try {
      e = JSON.parse(m.data);
    } catch {
      return;
    }
    if (e.type === "notification") addNotification({ kind: e.kind, text: e.text, link: e.link, fromServer: true });
    emit(e);
  };
  ws.onclose = () => {
    clearInterval(pingTimer);
    ws = null;
    emit({ type: "disconnected" });
    if (wanted) setTimeout(connectChat, Math.min(30000, 1000 * 2 ** retry++));
  };
}

export function sendTyping(channel, name) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "typing", channel, name }));
}

// --- the notification sound: a short two-note chime made in the browser (no file to download)
let audio = null;
export function playChime() {
  try {
    if (localStorage.getItem("bh-sound-off") === "1") return;
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audio.currentTime;
    [
      [880, 0],
      [1318.5, 0.12],
    ].forEach(([freq, at]) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.35);
      o.connect(g).connect(audio.destination);
      o.start(t0 + at);
      o.stop(t0 + at + 0.4);
    });
  } catch {
    // No sound available.
  }
}
export const soundOn = () => {
  try {
    return localStorage.getItem("bh-sound-off") !== "1";
  } catch {
    return true;
  }
};
export const setSound = (on) => {
  try {
    if (on) localStorage.removeItem("bh-sound-off");
    else localStorage.setItem("bh-sound-off", "1");
  } catch {
    // Storage blocked.
  }
};

// --- the bell's list: chat notifications from the server plus local ones
const LOCAL_KEY = "bh-notifications";
const bellListeners = new Set();
export const onBell = (f) => {
  bellListeners.add(f);
  return () => bellListeners.delete(f);
};
export function localNotifications() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}
// kind: message | friend | reward | update | purchase | ai. Chats and AI replies ring.
export function addNotification({ kind, text, link = "", fromServer = false }) {
  const item = { id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, kind, text, link, read: false, at: new Date().toISOString(), local: !fromServer };
  if (!fromServer) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([item, ...localNotifications()].slice(0, 30)));
    } catch {
      // Storage blocked.
    }
  }
  if (kind === "message" || kind === "ai" || kind === "friend") playChime();
  bellListeners.forEach((f) => f(item));
}
export function markLocalRead() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localNotifications().map((n) => ({ ...n, read: true }))));
  } catch {
    // Storage blocked.
  }
}
