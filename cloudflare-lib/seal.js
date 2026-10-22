// Secrets kept at rest, such as the long-lived permission (refresh token) a person gives Orbit when they
// connect Gmail, Calendar or GitHub. Sealed with AES-GCM (256-bit) under a key derived with HKDF from
// a secret the site already has on Cloudflare: ORBIT_TOKEN_KEY if the owner sets one, otherwise
// GOOGLE_CLIENT_SECRET, otherwise GITHUB_CLIENT_SECRET. Each value is tied to its row (the "bind"
// text, e.g. "<user>|gmail"), so a sealed value copied onto someone else's row won't open.
// Stored as "s1.<key letter>.<base64url of iv + ciphertext>". A value without that prefix is an older
// plain one: it's read as-is and sealed the next time it's used.
// If the secret a value was sealed with changes or is removed, it can't be opened any more; the
// person is asked to reconnect (the connection shows "Needs reconnect").
const SOURCES = [["k", "ORBIT_TOKEN_KEY"], ["g", "GOOGLE_CLIENT_SECRET"], ["h", "GITHUB_CLIENT_SECRET"]];
const PREFIX = "s1.";
const enc = new TextEncoder(), dec = new TextDecoder();
const keys = new Map();

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function keyOf(env, letter) {
  const name = (SOURCES.find((s) => s[0] === letter) || [])[1];
  const secret = name && env && env[name];
  if (!secret) return null;
  const id = letter + ":" + secret;
  if (!keys.has(id)) {
    const base = await crypto.subtle.importKey("raw", enc.encode(String(secret)), "HKDF", false, ["deriveKey"]);
    keys.set(id, await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: enc.encode("nebulux-seal-v1"), info: enc.encode("orbit-connection-token") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
  }
  return keys.get(id);
}

export const isSealed = (v) => String(v || "").startsWith(PREFIX);

// Throws when no secret is set: a refresh token is never stored in plain text.
export async function seal(env, plain, bind = "") {
  const src = SOURCES.find(([, name]) => env && env[name]);
  if (!src) throw new Error("No key to seal with (set ORBIT_TOKEN_KEY or GOOGLE_CLIENT_SECRET on Cloudflare).");
  const key = await keyOf(env, src[0]), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(bind) }, key, enc.encode(String(plain))));
  const all = new Uint8Array(iv.length + ct.length); all.set(iv); all.set(ct, iv.length);
  return PREFIX + src[0] + "." + b64u(all);
}

// The plain value, or null when it can't be opened (wrong row, changed secret, damaged).
export async function unseal(env, stored, bind = "") {
  const s = String(stored || "");
  if (!isSealed(s)) return s || null;
  const [, letter, body] = s.split(".");
  try {
    const key = await keyOf(env, letter); if (!key || !body) return null;
    const all = unb64u(body);
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12), additionalData: enc.encode(bind) }, key, all.slice(12)));
  } catch {
    return null;
  }
}
