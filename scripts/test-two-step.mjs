// Offline test: authenticator-app codes (functions/.../two-step.js). Run: node scripts/test-two-step.mjs
import { pathToFileURL, fileURLToPath } from "node:url";
const R = fileURLToPath(new URL("..", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const { totp, codeOk, base32Encode, base32Decode } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/two-step.js").href);
// RFC 6238 test secret "12345678901234567890" at 59 seconds: 94287082 -> last 6 digits 287082.
const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
assert(secret === "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "base32 like authenticator apps use");
assert(new TextDecoder().decode(base32Decode(secret)) === "12345678901234567890", "and back");
assert((await totp(secret, 1)) === "287082", "the standard test code (RFC 6238)");
assert(await codeOk(secret, "287082", 59000), "the right code works");
assert(await codeOk(secret, "287 082", 59000 + 30000), "one step late (a slow phone clock) still works, spaces ignored");
assert(!(await codeOk(secret, "287082", 59000 + 120000)), "an old code doesn't");
assert(!(await codeOk(secret, "000000", 59000)), "a wrong code doesn't");
const { maskEmail } = await import(pathToFileURL(R + "functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/two-step.js").href);
assert(maskEmail("sam.jones@gmail.com") === "sa•••••@gmail.com" && maskEmail("ab@x.com") === "ab•@x.com", "emails are shown masked");
