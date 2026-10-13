// In-page replacements for window.confirm / window.prompt / window.alert. Those browser pop-ups
// are silently switched off in some places people use the app (the Claude app's browser, the
// in-app browsers of Instagram, TikTok and others): confirm() answers "No" at once and nothing
// shows, so every button that asked "Are you sure?" did nothing. These show a dialog in the
// page instead (components/DialogHost.jsx, mounted once in App.jsx) and resolve when answered.
let current = null;
const queue = [];
const listeners = new Set();
const notify = () => listeners.forEach((f) => f(current));

export function onDialog(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

function open(dialog) {
  return new Promise((resolve) => {
    queue.push({ ...dialog, resolve });
    if (!current) next();
  });
}

function next() {
  current = queue.shift() || null;
  notify();
}

// Called by the host with the answer: true/false (confirm), a string or null (text), or
// undefined (notice).
export function answer(value) {
  if (!current) return;
  const { resolve } = current;
  next();
  resolve(value);
}

// "Are you sure?" → true or false. `danger` makes the button red (deleting, banning).
export const askConfirm = (message, { confirmLabel = "OK", cancelLabel = "Cancel", danger = false } = {}) =>
  open({ type: "confirm", message, confirmLabel, cancelLabel, danger });

// A short answer → the text, or null if cancelled.
export const askText = (message, { defaultValue = "", placeholder = "", maxLength = 500, confirmLabel = "OK" } = {}) =>
  open({ type: "text", message, defaultValue, placeholder, maxLength, confirmLabel, cancelLabel: "Cancel" });

// A message with one button.
export const showNotice = (message, { confirmLabel = "OK" } = {}) => open({ type: "notice", message, confirmLabel });

// The share card for a chat link (copy, send with the phone's share sheet, or open in a new tab).
export const showShare = ({ url, title, kind, count, note, copied }) => open({ type: "share", url, title, kind, count, note, copied, confirmLabel: "Done" });
