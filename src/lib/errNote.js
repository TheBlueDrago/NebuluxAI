// Error notes in a chat (a reply that failed, the AI busy, no connection) carry err: true. Chats saved before that
// start with a warning sign instead (written as \u26A0 here, so no emoji sits in the code), and still count.
export const WARN_SIGN = /^\s*\u26A0\uFE0F?\s*/;
export const isErrNote = (m) => !!m && m.role === "ai" && (m.err === true || WARN_SIGN.test(String(m.content || "")));
