// Saves a chat to the device as a Markdown (.md) file: the title, then each message under
// "You" or "Nebulux AI". Opens in any text editor, and in Notion, Obsidian, GitHub and the like.
export function chatToMarkdown(title, messages) {
  const parts = [`# ${title || "Chat"}`, `_Saved from Nebulux AI on ${new Date().toLocaleString()}_`];
  for (const m of messages || []) {
    const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("\n") : "";
    if (!text.trim()) continue;
    const when = m.at ? ` · ${new Date(m.at).toLocaleString()}` : "";
    parts.push(`## ${m.role === "user" ? "You" : "Nebulux AI"}${when}\n\n${text.trim()}`);
  }
  return parts.join("\n\n") + "\n";
}

export function downloadChat(title, messages) {
  const name = (String(title || "chat").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "chat").replace(/\s+/g, "-");
  const url = URL.createObjectURL(new Blob([chatToMarkdown(title, messages)], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
