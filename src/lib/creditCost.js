// Credits are charged on the server (cloudflare-lib/credits.js): whole numbers,
// 1 per started 10,000 characters of reply times the effort level, and a reply that
// costs more than the user has left comes back cut off with `cut: true`.
// A reply stopped by the session limit (50 credits per 5-hour session) instead: more come when it resets.
export const SESSION_CUT_NOTE =
  "⚠ This session's credits ran out, so this reply was stopped partway through. Your next session starts when the timer above the message box runs out.";
// The note for a cut reply: `r` is the reply's result (cutBy "session" when the session limit stopped it).
export const cutNote = (r) => (r && r.cutBy === "session" ? SESSION_CUT_NOTE : OUT_OF_CREDITS_NOTE);
export const OUT_OF_CREDITS_NOTE =
  "⚠ You've run out of credits, so this reply was stopped partway through. Upgrade your plan for more credits (your profile → Upgrade plan).";
