// Offline test: chats saved with the account — the merge rules (src/lib/chatSync.js) and the
// server (functions/.../chat-sync.js) on an in-memory SQLite copy of D1.
// Run: node scripts/test-chat-sync.mjs
import { DatabaseSync } from "node:sqlite";
import { mergeChats, changesSince } from "../src/lib/chatSync.js";
import { onRequestPost, storable, MAX_CHAT_BYTES } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chat-sync.js";
import { useOwnDb } from "../cloudflare-lib/published.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

// ---- Merge rules
const a1 = { id: "a", title: "Old A", updated: 100, messages: [] };
const a2 = { id: "a", title: "New A", updated: 200, messages: [] };
let m = mergeChats([a1], [a2]);
assert(m.merged[0].title === "New A" && m.push.length === 0, "the newer copy wins (here: the account's)");
m = mergeChats([a2], [a1]);
assert(m.merged[0].title === "New A" && m.push.length === 1 && m.push[0].id === "a", "a newer chat on this device is sent to the account");
m = mergeChats([], [{ id: "b", title: "Phone chat", updated: 50, messages: [] }]);
assert(m.merged.length === 1 && m.merged[0].title === "Phone chat", "a chat made on another device shows up here");
m = mergeChats([{ id: "c", title: "Laptop chat", updated: 60, messages: [] }], []);
assert(m.push.length === 1, "a chat only on this device is sent up");
m = mergeChats([{ id: "d", updated: 10, messages: [] }], [], [], [{ id: "d", updated: 20 }]);
assert(m.merged.length === 0, "a chat deleted on another device is deleted here too");
m = mergeChats([], [{ id: "e", updated: 10, messages: [] }], [{ id: "e", updated: 30 }]);
assert(m.merged.length === 0 && m.push.some((p) => p.id === "e" && p.deleted), "a chat deleted here is deleted on the account");
m = mergeChats([], [{ id: "f", updated: 50, messages: [] }], [{ id: "f", updated: 30 }]);
assert(m.merged.length === 1, "a chat changed after it was deleted elsewhere is kept");
const synced = new Map([["a", 200]]);
assert(changesSince([a2, { id: "g", updated: 5 }], synced).map((c) => c.id).join() === "g", "only what changed since the last save is sent");

// ---- Server
const sq = new DatabaseSync(":memory:");
const db = {
  prepare(sql) {
    const st = sq.prepare(sql);
    let args = [];
    const api = { bind: (...a) => ((args = a), api), all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) || null, run: async () => st.run(...args) };
    return api;
  },
};
useOwnDb(null);
let who = "u1";
globalThis.fetch = async (url) => (String(url).includes("entities/User/me") ? new Response(JSON.stringify({ id: who, email: who + "@x.y" })) : new Response("{}"));
const call = async (body, auth = true) => {
  const res = await onRequestPost({ request: new Request("https://nebuluxai.com/x", { method: "POST", headers: auth ? { authorization: "Bearer t" } : {}, body: JSON.stringify(body) }), env: { DB: db } });
  return { status: res.status, body: await res.json() };
};
let r = await call({ action: "load" }, false);
assert(r.status === 401, "signed out: no chats from the account");
r = await call({ action: "save", changes: [{ id: "a", updated: 100, chat: { title: "Homework", messages: [{ role: "user", content: "hi" }] } }] });
assert(r.body.saved === 1, "a chat is saved to the account");
r = await call({ action: "save", changes: [{ id: "a", updated: 50, chat: { title: "Older copy", messages: [] } }] });
assert(r.body.saved === 0, "an older copy doesn't overwrite a newer one");
r = await call({ action: "load" });
assert(r.body.chats.length === 1 && r.body.chats[0].title === "Homework" && r.body.chats[0].updated === 100, "another device loads it");
who = "u2";
r = await call({ action: "load" });
assert(r.body.chats.length === 0, "nobody else can see it");
who = "u1";
r = await call({ action: "save", changes: [{ id: "a", updated: 150, deleted: true }] });
r = await call({ action: "load" });
assert(r.body.chats.length === 0 && r.body.deleted[0].id === "a", "deleting a chat deletes it on the account, with a marker for other devices");
const huge = { id: "h", title: "Pics", messages: [{ role: "user", content: "look", images: ["data:image/png;base64," + "A".repeat(MAX_CHAT_BYTES)] }] };
const kept = storable(huge);
assert(kept && !kept.messages[0].images && /picture/.test(kept.messages[0].note), "big attached pictures aren't kept with the account (the text is)");
r = await call({ action: "clear" });
r = await call({ action: "load" });
assert(r.body.chats.length === 0 && r.body.deleted.length === 0, "deleting the account removes all its chats");
