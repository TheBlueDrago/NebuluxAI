// Notifications in the app (the bell next to the profile button): the AI finishing while you
// were on another tab, purchases and updates, kept on this device, with a short chime.
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

// --- the bell's list
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
// kind: update | purchase | ai. AI replies ring.
export function addNotification({ kind, text, link = "" }) {
  const item = { id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, kind, text, link, read: false, at: new Date().toISOString(), local: true };
  {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([item, ...localNotifications()].slice(0, 30)));
    } catch {
      // Storage blocked.
    }
  }
  if (kind === "ai") playChime();
  bellListeners.forEach((f) => f(item));
}
export function markLocalRead() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(localNotifications().map((n) => ({ ...n, read: true }))));
  } catch {
    // Storage blocked.
  }
}
