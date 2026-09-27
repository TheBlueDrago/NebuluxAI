// Offline test: the monthly user agreement and who counts as inactive (functions/.../accept-terms.js).
// Run: node scripts/test-terms.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const { termsVersion, isOverdue, STARTED, TERMS_VERSION } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/accept-terms.js").href);
const D = 86400000;
assert(termsVersion() === TERMS_VERSION, "accepted once: the version doesn't change by itself each month");
assert(!isOverdue(null, STARTED - 400 * D, STARTED + 10 * D), "nobody is overdue in the first 30 days");
assert(isOverdue(null, STARTED - 400 * D, STARTED + 31 * D), "an old account that never accepted is overdue after 30 days");
assert(!isOverdue(null, STARTED + 20 * D, STARTED + 40 * D), "a new account gets 30 days from signing up");
const now = STARTED + 90 * D;
assert(!isOverdue({ version: TERMS_VERSION, at: new Date(now - 10 * D).toISOString() }, 0, now), "accepted 10 days ago: fine");
assert(!isOverdue({ version: TERMS_VERSION, at: new Date(now - 45 * D).toISOString() }, 0, now), "accepted once, long ago: still fine (not asked again)");
const { EXEMPT } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/accept-terms.js").href);
assert(EXEMPT.has("thebluedragonstriker@gmail.com") && EXEMPT.size === 3, "the owner's three accounts aren't asked again");
assert(isOverdue({ version: "2026-09", at: new Date(STARTED).toISOString() }, 0, STARTED + 31 * D), "an older version accepted doesn't count once the new one's deadline passes");
