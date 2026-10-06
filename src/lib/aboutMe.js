import { languageNote } from "@/lib/prefs";
// "About you": a few words people write once so the AI tailors every answer (grade, interests,
// how they like answers). Kept only in this browser, per account; sent with each message like
// the message itself (the Privacy Policy covers what goes to the AI).
export const ABOUT_MAX = 500;
const key = (userId) => `bh-about-me:${userId || "anon"}`;
const listeners = new Set();

export function readAboutMe(userId, storage = globalThis.localStorage) {
  try {
    return String(storage.getItem(key(userId)) || "").slice(0, ABOUT_MAX);
  } catch {
    return "";
  }
}

export function saveAboutMe(userId, text, storage = globalThis.localStorage) {
  const t = String(text || "").trim().slice(0, ABOUT_MAX);
  try {
    if (t) storage.setItem(key(userId), t);
    else storage.removeItem(key(userId));
  } catch {
    // Storage blocked: it lasts until the page closes.
  }
  listeners.forEach((f) => f(t));
  return t;
}

export function onAboutMe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The note sent before the conversation, or "" when there's nothing saved.
export const aboutMeBlock = (text) =>
  languageNote() + (text ? `About the person you're talking to (from their own settings; use it to tailor your answers and don't repeat it back unless asked): ${text}\n\n` : "");
