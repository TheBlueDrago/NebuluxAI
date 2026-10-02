import { CHATS_CHANGED } from "./chatBackup.js";

// Chats are kept in this browser (useConversations), not per account. So signing out puts your
// chats aside under your account id, and signing in brings back that account's own: on a
// shared computer the next person starts with an empty chat list instead of reading yours.
// Nothing is deleted (Settings → Security can clear the browser completely).
const KEY = "infinity-ai-conversations";
export const STASH_PREFIX = "bh-chats-stash:";
const stashKey = (userId) => STASH_PREFIX + userId;

const read = (storage, k) => {
  try {
    const v = JSON.parse(storage.getItem(k) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// At sign-out.
export function stashChats(userId, storage = globalThis.localStorage) {
  if (!userId) return;
  try {
    const mine = read(storage, KEY);
    if (mine.length) storage.setItem(stashKey(userId), JSON.stringify(mine));
    storage.removeItem(KEY);
    // "Deleted chat" notes for the account sync (lib/chatSync.js) belong to this account too.
    storage.removeItem("nx-chats-deleted");
  } catch {
    // storage blocked
  }
}

// Once the signed-in account is known. Chats already here (made before signing in, or from
// before this existed) are kept, with the account's own added. -> true when it brought any back.
export function restoreChats(userId, storage = globalThis.localStorage) {
  if (!userId) return false;
  try {
    const saved = read(storage, stashKey(userId));
    if (!saved.length) return false;
    const here = read(storage, KEY);
    const ids = new Set(here.map((c) => c && c.id));
    storage.setItem(KEY, JSON.stringify([...here, ...saved.filter((c) => c && !ids.has(c.id))]));
    storage.removeItem(stashKey(userId));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHATS_CHANGED));
    return true;
  } catch {
    return false;
  }
}
