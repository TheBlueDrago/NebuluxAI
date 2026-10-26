import { isErrNote } from "./errNote.js";
// The recent conversation, sent with each new message so the AI can follow along ("make it
// shorter", "why?", "next question"). Error notes are left out, each message is capped,
// and only the latest fit under the total. Credits are charged for the reply, not this.
export const HISTORY_MESSAGES = 12;
export const HISTORY_EACH = 2000;
export const HISTORY_TOTAL = 12000;

export function historyBlock(messages) {
  const past = (messages || []).filter((m) => m && m.content && !isErrNote(m));
  const lines = [];
  let total = 0;
  for (const m of past.slice(-HISTORY_MESSAGES).reverse()) {
    let t = String(m.content).replace(/ \(attached: [^)]*\)$/, "");
    if (t.length > HISTORY_EACH) t = t.slice(0, HISTORY_EACH) + " …";
    const line = `${m.role === "user" ? "User" : "Assistant"}: ${t}`;
    if (total + line.length > HISTORY_TOTAL) break;
    lines.unshift(line);
    total += line.length;
  }
  return lines.length ? `Conversation so far (use it as context and answer the latest message):\n\n${lines.join("\n\n")}\n\nLatest message:\n` : "";
}
