// Kept apart (no imports) so scripts/test-connectors.mjs can check it in Node.
// A chat message asking to send something to a connected app, done by the chat itself (and always
// confirmed first): "add buy milk to my Todoist", "post this to my Discord", "write a poem and post it
// to my Discord". Returns { app, op, name, body } (send that text), { …, last: true } (the last answer),
// { …, after: true } (the answer to the rest of the message, once it's written), or null.
const ASKS = [
  { app: "todoist", op: "add", name: "Todoist", re: /\b(?:add|put)\s+([\s\S]+?)\s+(?:to|on|in|into)\s+(?:my\s+)?todoist\b/i, after: false },
  { app: "asana", op: "add", name: "Asana", re: /\b(?:add|put)\s+([\s\S]+?)\s+(?:to|on|in|into)\s+(?:my\s+)?asana\b/i, after: false },
  { app: "discord", op: "post", name: "Discord", re: /\b(?:post|send|share)\s+([\s\S]+?)\s+(?:to|on|in)\s+(?:my\s+)?discord(?:\s+channel)?\b/i, after: true },
];
const POINTER = /^(?:it|this|that|the (?:answer|reply|last (?:one|answer|reply|message))|that (?:answer|reply)|this (?:answer|reply))$/i;
const FILLER = /\b(?:please|pls|now|thanks|thank you|can you|could you|would you|ok|okay|and|then)\b/gi;

// "How do I add a task in Todoist?" is a question about the app, not a request ("can you add…?" still is).
const QUESTION = /^(?:how|what|why|where|when|which|who|is|are|does|do i|can i|should i|could i)\b/i;

export function appIntent(text, connected = []) {
  const t = String(text || "").trim();
  if (QUESTION.test(t)) return null;
  for (const a of ASKS) {
    if (!connected.includes(a.app)) continue;
    const m = a.re.exec(t);
    if (!m) continue;
    const what = m[1].trim().replace(/^["“']|["”']$/g, "").trim();
    const base = { app: a.app, op: a.op, name: a.name };
    if (!POINTER.test(what)) return what ? { ...base, body: what } : null;
    const before = t.slice(0, m.index).replace(FILLER, "").replace(/[^a-z0-9]+/gi, "");
    if (!before) return { ...base, last: true };
    return a.after ? { ...base, after: true } : null;
  }
  return null;
}
