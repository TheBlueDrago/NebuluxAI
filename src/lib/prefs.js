// Small per-browser settings from Settings → General: reply language, reduced motion, and
// "notify me when a reply is done".
const get = (k, d) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const set = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Storage blocked: lasts until the page closes.
  }
};

export const LANGUAGES = ["Auto", "English", "Spanish", "French", "German", "Portuguese", "Italian", "Hindi", "Telugu", "Tamil", "Chinese", "Japanese", "Korean", "Arabic", "Russian"];
export const readLanguage = () => get("nx-language", "Auto");
export const saveLanguage = (v) => set("nx-language", v);
export const languageNote = () => {
  const l = readLanguage();
  return l && l !== "Auto" ? `Always reply in ${l}, unless the person asks for another language.\n\n` : "";
};

export const readMotion = () => get("nx-motion", "system");
export function applyMotion(v = readMotion()) {
  document.documentElement.classList.toggle("reduce-motion", v === "reduced");
}
export const saveMotion = (v) => {
  set("nx-motion", v);
  applyMotion(v);
};

export const readNotify = () => get("nx-notify", "off") === "on";
export const saveNotify = (on) => set("nx-notify", on ? "on" : "off");
// A reply finished: tell the person if they're on another tab and asked for it.
export function notifyDone(text) {
  if (!readNotify() || typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    new Notification("Nebulux AI finished a response", { body: String(text || "").replace(/[`#*_>]/g, "").slice(0, 120), icon: "/logo-small.jpg" });
  } catch {
    // Some phones only allow notifications from an installed app.
  }
}
