// Chats saved with the account (functions/.../chat-sync.js), so they show on every device someone
// signs in on. Each chat carries `updated` (when it last changed); the newer copy of a chat wins,
// and a deleted chat leaves a marker ({ id, updated }) so it's deleted everywhere. Signed-out
// visitors aren't synced: their chats stay in this browser only, as before.
export const DELETED_KEY = "nx-chats-deleted";

export const changedAt = (c) => Number(c && (c.updated || c.created_date)) || 0;

// The chats to show after bringing this device and the account together, and what this device
// still has to send. local/server: chats; localDeleted/serverDeleted: deletion markers.
export function mergeChats(local, server, localDeleted = [], serverDeleted = []) {
  const deletedAt = new Map();
  for (const d of [...localDeleted, ...serverDeleted]) if (d && d.id) deletedAt.set(d.id, Math.max(deletedAt.get(d.id) || 0, Number(d.updated) || 0));
  const byId = new Map();
  for (const c of server || []) if (c && c.id) byId.set(c.id, { chat: c, from: "server" });
  for (const c of local || []) {
    if (!c || !c.id) continue;
    const have = byId.get(c.id);
    if (!have || changedAt(c) > changedAt(have.chat)) byId.set(c.id, { chat: c, from: "local" });
  }
  const serverAt = new Map((server || []).map((c) => [c.id, changedAt(c)]));
  const serverDel = new Map((serverDeleted || []).map((d) => [d.id, Number(d.updated) || 0]));
  const merged = [];
  const push = [];
  for (const [id, { chat }] of byId) {
    if ((deletedAt.get(id) || 0) >= changedAt(chat)) continue; // deleted after its last change
    merged.push(chat);
    if (changedAt(chat) > (serverAt.get(id) || 0)) push.push({ id, updated: changedAt(chat), chat });
  }
  for (const d of localDeleted || []) if (d && d.id && (Number(d.updated) || 0) > Math.max(serverAt.get(d.id) || 0, serverDel.get(d.id) || 0)) push.push({ id: d.id, updated: Number(d.updated), deleted: true });
  merged.sort((a, b) => changedAt(b) - changedAt(a));
  return { merged, push };
}

// What changed since the last sync (id -> updated), to send.
export function changesSince(chats, synced, deleted = []) {
  const out = [];
  for (const c of chats || []) if (c && c.id && changedAt(c) > (synced.get(c.id) || 0)) out.push({ id: c.id, updated: changedAt(c), chat: c });
  for (const d of deleted || []) if (d && d.id && (Number(d.updated) || 0) > (synced.get(d.id) || 0)) out.push({ id: d.id, updated: Number(d.updated), deleted: true });
  return out;
}

export function readDeleted(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(DELETED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function noteDeleted(id, storage = globalThis.localStorage) {
  try {
    const list = readDeleted(storage).filter((d) => d.id !== id);
    list.push({ id, updated: Date.now() });
    storage.setItem(DELETED_KEY, JSON.stringify(list.slice(-500)));
  } catch {}
}
