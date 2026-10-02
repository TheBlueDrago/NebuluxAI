// Limits on sign-in, sign-up and password-reset calls. They go through the /api proxy
// (functions/api/[[path]].js), which counts them here before Nebulux's own sign-in
// (cloudflare-lib/auth.js) answers. This stops someone guessing a password or a 6-digit
// sign-up code, and stops sign-up-code or reset emails being sent to someone over and over.
// auth.js adds its own cap: 5 wrong tries per emailed code.
//
// Counts are per Cloudflare data centre and not exact (cloudflare-lib/ratelimit.js), so an
// attack spread around the world is slowed rather than stopped. The limits per network are
// high on purpose: a whole class on one school network may sign up or sign in at once.
import { allow } from "./ratelimit.js";

const MIN = 60;
const HOUR = 60 * MIN;

// For each auth call: [what's counted, max, window in seconds]. "pair" is the account's
// email together with the visitor's network, "email" the account from anywhere, "ip" the
// network across every account (someone trying one password on lots of accounts).
export const AUTH_LIMITS = {
  login: [["pair", 10, 15 * MIN], ["email", 50, 15 * MIN], ["ip", 200, 15 * MIN]],
  "verify-otp": [["pair", 10, 15 * MIN], ["email", 20, 15 * MIN], ["ip", 200, 15 * MIN]],
  "resend-otp": [["email", 5, HOUR], ["ip", 60, HOUR]],
  register: [["email", 5, HOUR], ["ip", 60, HOUR]],
  "reset-password-request": [["email", 5, HOUR], ["ip", 60, HOUR]],
  "reset-password": [["ip", 30, HOUR]],
  "change-password": [["ip", 30, HOUR]],
};

// Sign-in bodies are tiny; anything bigger isn't read here.
const MAX_BODY = 16 * 1024;

// The path after /api/, e.g. apps/<app id>/auth/login.
const AUTH_PATH = /^apps\/[^/]+\/auth\/([a-z-]+)\/?$/;

export function tooManyMessage(windowSec) {
  const wait = windowSec >= HOUR ? "up to an hour" : `up to ${Math.round(windowSec / MIN)} minutes`;
  return `Too many tries. To keep accounts safe, please wait ${wait} and try again.`;
}

// null when the call may go ahead; otherwise the 429 response to send instead of it.
// Never blocks anything because the counting itself failed.
export async function authLimit(request, path) {
  if (request.method !== "POST") return null;
  const m = AUTH_PATH.exec(path || "");
  const rules = m && AUTH_LIMITS[m[1]];
  if (!rules) return null;
  try {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    let email = "";
    const size = Number(request.headers.get("content-length") || 0);
    if (rules.some(([by]) => by !== "ip") && size > 0 && size <= MAX_BODY) {
      // Read a copy, so the original body still goes to Base44 untouched. A body that's too
      // big for a sign-in, or doesn't say its size (the app's always does), isn't read: it's
      // still counted by network.
      const body = await request.clone().json().catch(() => null);
      email = String((body && body.email) || "").trim().toLowerCase().slice(0, 254);
    }
    for (const [by, max, sec] of rules) {
      if (by !== "ip" && !email) continue;
      const who = by === "ip" ? ip : by === "email" ? email : `${email}|${ip}`;
      if (!(await allow(`auth:${m[1]}:${by}:${who}`, max, sec))) {
        const message = tooManyMessage(sec);
        return new Response(JSON.stringify({ message, detail: message }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": String(sec), "x-content-type-options": "nosniff" },
        });
      }
    }
  } catch {
    // Fall through: the limiter must never lock people out by failing.
  }
  return null;
}
