// Usage is charged on the server against the limits every AI shares, like Claude's
// (cloudflare-lib/creditSession.js: a 5-hour limit and a weekly limit, in tokens). A reply that would
// go past what's left comes back cut off with `cut: true` and `cutBy: "session"`.
export const SESSION_CUT_NOTE =
  "You hit your usage limit, so this reply stopped partway through. It can carry on once the limit resets (the note above the message box says when).";
// The note for a cut reply: `r` is the reply's result (cutBy "session" when a usage limit stopped it).
export const cutNote = (r) => (r && r.cutBy === "session" ? SESSION_CUT_NOTE : OUT_OF_CREDITS_NOTE);
export const OUT_OF_CREDITS_NOTE =
  "You've reached your usage limit, so this reply was stopped partway through. It can carry on once the limit resets.";
