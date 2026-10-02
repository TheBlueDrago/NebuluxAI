import { useEffect, useState } from "react";

// What the AI is doing right now, everywhere in the app (a chat, the Website Designer, the Game
// Designer), so the Dashboard can list it and the sidebar can mark chats:
//   working: the AI is writing an answer (a blinking circle)
//   unread:  it finished while you were looking at something else (a blue circle)
//   out:     it stopped because the credits ran out (a red warning triangle)
// Entries are keyed: "chat:<conversationId>", "website", "game". Finished states are kept in this
// browser so the marks survive a reload; "working" isn't (a reload ends the answer).
const KEY = "nx-ai-activity";
const listeners = new Set();
let entries = load();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, e]) => e && e.status !== "working")) : {};
  } catch {
    return {};
  }
}
function save() {
  try {
    const keep = Object.fromEntries(Object.entries(entries).filter(([, e]) => e.status !== "working"));
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch {
    // Private mode: the marks just won't survive a reload.
  }
}
function emit() {
  for (const fn of listeners) fn(entries);
}

// Where the person is looking right now (set by the pages), so a finished answer they're
// already watching isn't marked unread.
let viewing = null;
export function setViewing(key) {
  viewing = key || null;
  if (key && entries[key] && entries[key].status === "unread") markSeen(key);
}

export function startActivity(key, info) {
  if (!key) return;
  entries = { ...entries, [key]: { ...info, key, status: "working", startedAt: Date.now(), chars: 0, meta: null } };
  emit();
}
export function updateActivity(key, patch) {
  if (!key || !entries[key]) return;
  entries = { ...entries, [key]: { ...entries[key], ...patch } };
  emit();
}
// status: "done" | "out" | "stopped" | "error"
export function finishActivity(key, status, extra = {}) {
  if (!key || !entries[key]) return;
  const e = entries[key];
  const path = typeof location !== "undefined" ? location.pathname : "";
  const looking = viewing === key || (key === "website" && path.includes("/designer/build")) || (key === "game" && path.includes("/game-designer"));
  const next = status === "out" ? "out" : status === "done" && !looking ? "unread" : null;
  if (!next) {
    const { [key]: _, ...rest } = entries;
    entries = rest;
  } else entries = { ...entries, [key]: { ...e, ...extra, status: next, endedAt: Date.now(), took: Date.now() - e.startedAt } };
  save();
  emit();
}
export function markSeen(key) {
  const e = entries[key];
  if (!e || e.status === "working" || e.status === "out") return;
  const { [key]: _, ...rest } = entries;
  entries = rest;
  save();
  emit();
}
export function clearOut(key) {
  if (!entries[key] || entries[key].status !== "out") return;
  const { [key]: _, ...rest } = entries;
  entries = rest;
  save();
  emit();
}

export function useAiActivity() {
  const [v, setV] = useState(entries);
  useEffect(() => {
    listeners.add(setV);
    setV(entries);
    return () => listeners.delete(setV);
  }, []);
  return v;
}

// Tokens this answer has used so far: what the AI read, plus what it has written so far (times the
// AI's weight and the effort level), as the server counts them.
export function liveCost(e) {
  if (!e || !e.meta) return null;
  const m = e.meta;
  return (m.inputTokens || 0) + Math.ceil((e.chars || 0) / 4) * (m.mult || 1);
}

// 1,234 -> "1.2K", 1,500,000 -> "1.5M".
export function tokenText(n) {
  const v = Math.max(0, Number(n) || 0);
  const short = (x, big) => x.toFixed(big ? 0 : 1).replace(/\.0$/, "");
  if (v >= 1e9) return short(v / 1e9, v >= 1e10) + "B";
  if (v >= 1e6) return short(v / 1e6, v >= 1e7) + "M";
  if (v >= 1e3) return short(v / 1e3, v >= 1e4) + "K";
  return String(Math.round(v));
}

// A ticking clock for live timers.
export function useNow(ms = 1000, on = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return now;
}

export function elapsedText(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}
