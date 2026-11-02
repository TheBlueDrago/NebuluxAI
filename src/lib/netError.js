// A request that never got an answer (offline, or the connection dropped): fetch rejects with
// a TypeError and axios says "Network Error", with no response either way. Shown in plain
// words instead of "Failed to fetch".
export function isNetworkError(e, online = typeof navigator === "undefined" ? true : navigator.onLine) {
  if (e?.response) return false;
  if (online === false) return true;
  return e?.name === "TypeError" || e?.code === "ERR_NETWORK" || /network ?error|failed to fetch|load failed|fetch failed/i.test(String(e?.message || ""));
}

export const OFFLINE_NOTE = "Couldn't reach Nebulux AI. You may be offline, or the connection dropped. Check your connection and try again.";

// The server's own words from an error answer: the first of these that is real text (an object here used to
// become the message "[object Object]"), or "" when there are none.
export function serverText(body) {
  for (const v of [body?.error, body?.error?.message, body?.message, body?.detail]) if (typeof v === "string" && v.trim()) return v;
  return "";
}

// The words for a server answer that came without its own message (instead of "Request failed with status code 500").
export function statusNote(status) {
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That couldn't be found. It may have been moved or deleted.";
  if (status === 413) return "That's too big to send. Try something smaller.";
  if (status === 429) return "Too many requests at once. Please wait a moment and try again.";
  if (status >= 500) return "Nebulux AI is having trouble right now. Please try again in a minute.";
  return `Something went wrong (error ${status}). Please try again.`;
}
