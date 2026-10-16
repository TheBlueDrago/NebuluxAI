import { useState, useEffect, useCallback, useRef } from "react";
import { CHATS_CHANGED } from "@/lib/chatBackup";
import { base44 } from "@/api/base44Client";
import { mergeChats, changesSince, readDeleted, noteDeleted, changedAt } from "@/lib/chatSync";

const STORAGE_KEY = "infinity-ai-conversations";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

const signedIn = () => {
  try {
    return !!localStorage.getItem("base44_access_token");
  } catch {
    return false;
  }
};

// Sends changes to the account in batches (the server takes 50 at a time). -> ids saved
async function pushChanges(changes) {
  const done = [];
  for (let i = 0; i < changes.length; i += 50) {
    const part = changes.slice(i, i + 50);
    const r = await base44.functions.invoke("chat-sync", { action: "save", changes: part }).catch(() => null);
    if (!r || !r.data || !r.data.ok) break;
    done.push(...part);
  }
  return done;
}

export function useConversations() {
  const [conversations, setConversations] = useState(load);
  const [activeId, setActiveId] = useState(null);
  const convRef = useRef(conversations);
  convRef.current = conversations;

  useEffect(() => {
    const first = conversations.find((c) => c.kind !== "code");
    if (activeId === null && first) {
      setActiveId(first.id);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  // ---- Saved with the account (lib/chatSync.js, functions/.../chat-sync.js): signed-in people
  // get their chats on every device. First bring this device and the account together, then
  // send each change a moment after it happens.
  const synced = useRef(new Map()); // chat id -> `updated` the account has
  const [syncReady, setSyncReady] = useState(false);
  useEffect(() => {
    if (!signedIn()) return;
    let alive = true;
    (async () => {
      const r = await base44.functions.invoke("chat-sync", { action: "load" }).catch(() => null);
      if (!alive || !r || !r.data || !Array.isArray(r.data.chats)) return;
      const { chats, deleted = [] } = r.data;
      for (const c of chats) synced.current.set(c.id, changedAt(c));
      for (const d of deleted) synced.current.set(d.id, Number(d.updated) || 0);
      const { merged, push } = mergeChats(convRef.current, chats, readDeleted(), deleted);
      setConversations(merged);
      setActiveId((cur) => (cur && merged.some((c) => c.id === cur) ? cur : merged[0]?.id || null));
      for (const c of await pushChanges(push)) synced.current.set(c.id, c.updated);
      if (alive) setSyncReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!syncReady || !signedIn()) return;
    const t = setTimeout(async () => {
      const changes = changesSince(convRef.current, synced.current, readDeleted());
      if (!changes.length) return;
      for (const c of await pushChanges(changes)) synced.current.set(c.id, c.updated);
    }, 2500);
    return () => clearTimeout(t);
  }, [conversations, syncReady]);

  const stamp = (c) => ({ ...c, updated: Date.now() });

  // kind "code": a Nebulux Code chat (opens in Code, not in the normal chat).
  const createConversation = useCallback((title = "New Chat", kind) => {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
    const conv = { id, title, messages: [], created_date: Date.now(), updated: Date.now(), ...(kind === "code" ? { kind: "code" } : {}) };
    setConversations((prev) => [conv, ...prev]);
    if (kind !== "code") setActiveId(id);
    return id;
  }, []);

  // Code keeps its own list of messages (with extras like what each answer used) and saves it whole.
  const setConversationMessages = useCallback((convId, messages) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? stamp({ ...c, messages }) : c)));
  }, []);

  const selectConversation = useCallback((id) => setActiveId(id), []);

  const addMessage = useCallback((convId, message) => {
    // Each message remembers when it was sent (shown when you hover over it in the chat).
    const m = message && !message.at ? { ...message, at: Date.now() } : message;
    setConversations((prev) => prev.map((c) => (c.id === convId ? stamp({ ...c, messages: [...c.messages, m] }) : c)));
  }, []);

  const renameConversation = useCallback((id, title) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? stamp({ ...c, title }) : c)));
  }, []);

  const removeMessage = useCallback((convId, index) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? stamp({ ...c, messages: c.messages.filter((_, i) => i !== index) }) : c)));
  }, []);

  const deleteConversation = useCallback((id) => {
    noteDeleted(id); // so it's deleted on the account and the other devices too
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const reload = useCallback(() => setConversations(load), []);

  // Chats imported from a backup file (Settings) show up right away.
  useEffect(() => {
    // detail.open: also make that chat the open one (a shared chat someone continues).
    const onChange = (e) => {
      reload();
      if (e && e.detail && e.detail.open) setActiveId(e.detail.open);
    };
    window.addEventListener(CHATS_CHANGED, onChange);
    return () => window.removeEventListener(CHATS_CHANGED, onChange);
  }, [reload]);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  return {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    selectConversation,
    addMessage,
    setConversationMessages,
    renameConversation,
    removeMessage,
    deleteConversation,
    reload,
  };
}
