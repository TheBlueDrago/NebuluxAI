// Chats are kept only in this browser (localStorage), so they're lost when the browser
// data is cleared or on another device. These let people save them to a file and bring
// them back. useConversations listens for CHATS_CHANGED to pick up an import.
const KEY = "infinity-ai-conversations";
export const CHATS_CHANGED = "bh-conversations-changed";

function current() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Downloads every chat as a JSON file. Returns how many chats were saved.
export function downloadChats() {
  const chats = current();
  const blob = new Blob([JSON.stringify({ app: "nebulux-ai", kind: "chats", version: 1, chats }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nebulux-chats-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return chats.length;
}

const validMessage = (m) => m && (m.role === "user" || m.role === "ai") && typeof m.content === "string";

// Adds the chats from a downloaded file (skipping ones already here). Returns how many
// were added; throws with a readable message if the file isn't a chat backup.
export async function importChats(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Nebulux AI chat backup.");
  }
  const incoming = Array.isArray(data) ? data : data && data.kind === "chats" && Array.isArray(data.chats) ? data.chats : null;
  if (!incoming) throw new Error("That file isn't a Nebulux AI chat backup.");
  const chats = current();
  const have = new Set(chats.map((c) => c.id));
  const added = incoming
    .filter((c) => c && typeof c.id === "string" && !have.has(c.id) && Array.isArray(c.messages))
    .map((c) => ({
      id: c.id,
      title: String(c.title || "Imported chat").slice(0, 80),
      created_date: Number(c.created_date) || Date.now(),
      messages: c.messages.filter(validMessage).map((m) => ({ role: m.role, content: m.content })),
    }));
  if (!added.length) return 0;
  const merged = [...chats, ...added].sort((a, b) => (b.created_date || 0) - (a.created_date || 0));
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    throw new Error("Not enough browser storage to import these chats.");
  }
  window.dispatchEvent(new Event(CHATS_CHANGED));
  return added.length;
}
