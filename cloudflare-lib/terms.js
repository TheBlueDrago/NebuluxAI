// The user agreement's version and who has accepted it, shared by the agreement itself
// (functions/.../accept-terms.js) and the server parts that refuse to work until it's accepted
// (the AI and publishing), so skipping the popup with developer tools gets nothing.
//
// KV (PUBLISHED_HTML): terms:<userId> = { version, at }.

// Accepted once, kept: this only changes when the owner wants everyone to accept again.
export const TERMS_VERSION = "2026-10-07"; // cloud sessions and Google sign-in on published websites added; everyone asked again
// The owner's own accounts: not asked again and never listed as inactive (owner's request).
export const EXEMPT = new Set(["thebluedragonstriker@gmail.com", "hiuhinarra@gmail.com", "narra.vidish@gmail.com"]);
export const exempt = (u) => EXEMPT.has(String((u && u.email) || "").trim().toLowerCase());

export const TERMS_MESSAGE = "Please accept the Nebulux AI user agreement first (reload the page to see it).";

// Admins and the owner's accounts are always fine; everyone else needs this version accepted.
export async function termsAccepted(kv, user) {
  if (!user || !user.id) return false;
  if (user.role === "admin" || exempt(user)) return true;
  if (!kv) return true;
  try {
    const rec = await kv.get(`terms:${user.id}`, "json");
    return !!rec && rec.version === TERMS_VERSION;
  } catch {
    return true; // storage trouble shouldn't take the whole site down
  }
}
