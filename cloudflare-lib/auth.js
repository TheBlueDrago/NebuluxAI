// Nebulux's own sign-in, replacing Base44's. Same addresses and answers as Base44's auth API
// (the app's sign-in pages didn't change), backed by the D1 tables logins / sessions / codes
// (db/schema.sql) and email from support@nebuluxai.com (Resend, RESEND_API_KEY secret).
//   POST auth/register {email, password}         -> sends a 6-digit code to confirm the email
//   POST auth/verify-otp {email, otp_code}       -> { access_token, user }
//   POST auth/resend-otp {email}
//   POST auth/login {email, password}            -> { access_token, user }
//   POST auth/reset-password-request {email}     -> emails a link to /reset-password?token=...
//   POST auth/reset-password {reset_token, new_password}
//   POST auth/change-password {current_password, new_password}
// Accounts moved over from Base44 keep their id and everything linked to it, but not their
// password (Base44 never gave it out): their first sign-in emails them a link to set one.
import { create, getRow, all } from "./db.js";
import { passwordProblem } from "../src/lib/passwordCheck.js";
import { turnstileOk, TURNSTILE_FAILED } from "./turnstile.js";

const SESSION_DAYS = 60;
const enc = new TextEncoder();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(String(s))));
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const cleanEmail = (e) => String(e || "").trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}

function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The same rules as the sign-up page (src/lib/passwordCheck.js), checked here so they can't be skipped.
function checkPassword(p, email) {
  if (typeof p !== "string") throw new AuthError(400, "Please choose a password.");
  const problem = passwordProblem(p, email);
  if (problem) throw new AuthError(400, problem);
}

async function sendMail(env, to, subject, text, html) {
  if (!env.RESEND_API_KEY) throw new AuthError(503, "Email isn't set up yet. Please try again later.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Nebulux AI <support@nebuluxai.com>", to: [to], subject, text, html }),
  }).catch(() => null);
  if (!r || !r.ok) throw new AuthError(502, "We couldn't send the email. Please try again in a minute.");
}

const box = (inner) => `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a">${inner}<p style="color:#475569;font-size:14px">Nebulux AI</p></div>`;

async function sendSignupCode(env, db, email) {
  const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  await db
    .prepare("INSERT OR REPLACE INTO codes (email, purpose, code_hash, expires, tries) VALUES (?, 'signup', ?, ?, 0)")
    .bind(email, await sha(code), Date.now() + 15 * 60 * 1000)
    .run();
  await sendMail(
    env,
    email,
    `${code} is your Nebulux AI code`,
    `Your Nebulux AI code is ${code}\n\nIt works for 15 minutes. If you didn't sign up, ignore this email.`,
    box(`<p>Your Nebulux AI code:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p><p style="color:#475569;font-size:14px">It works for 15 minutes. If you didn't sign up, ignore this email.</p>`)
  );
}

async function sendResetLink(env, db, email, origin, firstTime) {
  const token = randomHex(24);
  await db
    .prepare("INSERT OR REPLACE INTO codes (email, purpose, code_hash, expires, tries) VALUES (?, 'reset', ?, ?, 0)")
    .bind(email, await sha(token), Date.now() + 60 * 60 * 1000)
    .run();
  const link = `${origin}/reset-password?token=${token}`;
  const why =
    firstTime === "google"
      ? "You signed in to Nebulux AI with Google. To finish, choose a password for your account. Then go back to the Nebulux AI page you were on, refresh it, and log in with your email and new password."
      : firstTime
        ? "Nebulux AI has a new sign-in system. Your account, credits, websites and games are all still here: just choose a password to keep using it."
        : "Someone (hopefully you) asked to reset your Nebulux AI password.";
  await sendMail(
    env,
    email,
    firstTime ? "Set your new Nebulux AI password" : "Reset your Nebulux AI password",
    `${why}\n\nChoose a password here (the link works for 1 hour):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    box(`<p>${why}</p><p style="margin:20px 0"><a href="${link}" style="background:#6366f1;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Choose a password</a></p><p style="color:#475569;font-size:14px">The link works for 1 hour. If you didn't ask for this, ignore this email.</p>`)
  );
}

async function newSession(db, userId) {
  // Tidy up while here: expired sign-ins and codes would otherwise pile up in the database.
  const now = Date.now();
  await db.prepare("DELETE FROM sessions WHERE expires < ?").bind(now).run();
  await db.prepare("DELETE FROM codes WHERE expires < ?").bind(now).run();
  const token = "nx_" + randomHex(32);
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)").bind(await sha(token), userId, Date.now() + SESSION_DAYS * 86400000).run();
  return token;
}

async function userByEmail(db, email) {
  return (await all(db, "User")).find((u) => cleanEmail(u.email) === email) || null;
}

// The signed-in user for a request's "Authorization: Bearer <token>", or null.
export async function sessionUser(db, request) {
  const h = (request && request.headers.get("authorization")) || "";
  const m = h.match(/^Bearer\s+(nx_[0-9a-f]{64})$/i);
  if (!m || !db) return null;
  const s = await db.prepare("SELECT user_id, expires FROM sessions WHERE token_hash = ?").bind(await sha(m[1])).first();
  if (!s || s.expires < Date.now()) return null;
  const u = await getRow(db, "User", s.user_id);
  if (!u || u.removed === true) return null;
  return u;
}

async function login(db, env, body, origin) {
  const email = cleanEmail(body.email);
  const password = String(body.password || "");
  const row = await db.prepare("SELECT * FROM logins WHERE email = ?").bind(email).first();
  if (!row || !row.pw_hash) {
    // An account moved over from Base44 that hasn't chosen a new password yet.
    const u = await userByEmail(db, email);
    // (Also someone who only ever used Google: the link lets them add a password.)
    if (u) {
      await sendResetLink(env, db, email, origin, true);
      throw new AuthError(403, "Nebulux AI has a new sign-in system. We've emailed you a link to choose your password: your account and everything in it are still here.");
    }
    throw new AuthError(401, "Invalid email or password");
  }
  if (!sameHex(await hashPassword(password, row.pw_salt), row.pw_hash)) throw new AuthError(401, "Invalid email or password");
  if (!row.verified) {
    await sendSignupCode(env, db, email);
    throw new AuthError(403, "Please confirm your email first: we've sent you a new code.");
  }
  const user = await getRow(db, "User", row.user_id);
  if (!user) throw new AuthError(401, "Invalid email or password");
  return { access_token: await newSession(db, row.user_id), user };
}

async function register(db, env, body) {
  const email = cleanEmail(body.email);
  if (!validEmail(email)) throw new AuthError(400, "Please enter a valid email address.");
  checkPassword(body.password, email);
  const row = await db.prepare("SELECT * FROM logins WHERE email = ?").bind(email).first();
  if (row && row.verified) throw new AuthError(409, "An account with this email already exists. Log in instead.");
  const salt = randomHex(16);
  const hash = await hashPassword(body.password, salt);
  let userId = row && row.user_id;
  if (!userId) {
    // Someone moved over from Base44 signing up again gets their old account back.
    const existing = await userByEmail(db, email);
    userId = existing
      ? existing.id
      : (await create(db, "User", { system: true }, { email, full_name: email.split("@")[0], role: "user", status: "active" })).id;
  }
  await db
    .prepare("INSERT OR REPLACE INTO logins (email, user_id, pw_hash, pw_salt, verified) VALUES (?, ?, ?, ?, 0)")
    .bind(email, userId, hash, salt)
    .run();
  await sendSignupCode(env, db, email);
  return { success: true, email };
}

async function verifyOtp(db, body) {
  const email = cleanEmail(body.email);
  const c = await db.prepare("SELECT * FROM codes WHERE email = ? AND purpose = 'signup'").bind(email).first();
  if (!c || c.expires < Date.now() || c.tries >= 5) throw new AuthError(400, "That code has expired. Send a new one.");
  if (!sameHex(await sha(String(body.otp_code || "").trim()), c.code_hash)) {
    await db.prepare("UPDATE codes SET tries = tries + 1 WHERE email = ? AND purpose = 'signup'").bind(email).run();
    throw new AuthError(400, "That code isn't right. Check it and try again.");
  }
  await db.prepare("DELETE FROM codes WHERE email = ? AND purpose = 'signup'").bind(email).run();
  const row = await db.prepare("SELECT * FROM logins WHERE email = ?").bind(email).first();
  if (!row) throw new AuthError(400, "Please sign up again.");
  await db.prepare("UPDATE logins SET verified = 1 WHERE email = ?").bind(email).run();
  return { access_token: await newSession(db, row.user_id), user: await getRow(db, "User", row.user_id) };
}

async function resetPassword(db, body) {
  checkPassword(body.new_password);
  const h = await sha(String(body.reset_token || ""));
  const c = await db.prepare("SELECT * FROM codes WHERE purpose = 'reset' AND code_hash = ?").bind(h).first();
  if (!c || c.expires < Date.now()) throw new AuthError(400, "This link has expired. Ask for a new one.");
  const email = c.email;
  let row = await db.prepare("SELECT * FROM logins WHERE email = ?").bind(email).first();
  const userId = (row && row.user_id) || ((await userByEmail(db, email)) || {}).id;
  if (!userId) throw new AuthError(400, "This link has expired. Ask for a new one.");
  const salt = randomHex(16);
  await db
    .prepare("INSERT OR REPLACE INTO logins (email, user_id, pw_hash, pw_salt, verified) VALUES (?, ?, ?, ?, 1)")
    .bind(email, userId, await hashPassword(body.new_password, salt), salt)
    .run();
  await db.prepare("DELETE FROM codes WHERE email = ? AND purpose = 'reset'").bind(email).run();
  // Every other device is signed out after a reset.
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  return { success: true };
}

async function changePassword(db, request, body) {
  const user = await sessionUser(db, request);
  if (!user) throw new AuthError(401, "Please sign in.");
  checkPassword(body.new_password);
  const row = await db.prepare("SELECT * FROM logins WHERE user_id = ?").bind(user.id).first();
  if (!row || !sameHex(await hashPassword(String(body.current_password || ""), row.pw_salt), row.pw_hash)) throw new AuthError(400, "Your current password isn't right.");
  const salt = randomHex(16);
  await db.prepare("UPDATE logins SET pw_hash = ?, pw_salt = ? WHERE email = ?").bind(await hashPassword(body.new_password, salt), salt, row.email).run();
  return { success: true };
}

// One sign-in call (path after /api/apps/<appId>/, e.g. "auth/login"). -> { status, body }
export async function handleAuth(db, env, request, path, body) {
  const origin = new URL(request.url).origin.replace(/\/\/[^/]*pages\.dev$/, "//nebuluxai.com");
  try {
    const action = path.replace(/^auth\//, "");
    // The "I'm not a robot" check on the two forms that send emails (cloudflare-lib/turnstile.js).
    if ((action === "register" || action === "reset-password-request") && !(await turnstileOk(env, request, body.turnstile_token))) {
      return { status: 400, body: { message: TURNSTILE_FAILED, code: "turnstile" } };
    }
    let out;
    if (action === "login") out = await login(db, env, body, origin);
    else if (action === "register") out = await register(db, env, body);
    else if (action === "verify-otp") out = await verifyOtp(db, body);
    else if (action === "resend-otp") {
      const email = cleanEmail(body.email);
      const row = await db.prepare("SELECT verified FROM logins WHERE email = ?").bind(email).first();
      if (row && !row.verified) await sendSignupCode(env, db, email);
      out = { success: true };
    } else if (action === "reset-password-request") {
      const email = cleanEmail(body.email);
      const known = (await db.prepare("SELECT 1 FROM logins WHERE email = ?").bind(email).first()) || (await userByEmail(db, email));
      if (known) await sendResetLink(env, db, email, origin, false);
      out = { success: true }; // same answer either way, so it can't be used to find accounts
    } else if (action === "reset-password") out = await resetPassword(db, body);
    else if (action === "change-password") out = await changePassword(db, request, body);
    // Signing out (src/lib/signOut.js): this device's sign-in stops working on the server too.
    else if (action === "logout") {
      await logout(db, request);
      out = { success: true };
    }
    // "Sign out on all devices" (Settings → Security): every sign-in on the account ends.
    else if (action === "logout-all") {
      const user = await sessionUser(db, request);
      if (!user) throw new AuthError(401, "Please sign in.");
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id).run();
      out = { success: true };
    }
    else return { status: 404, body: { message: "Not found" } };
    return { status: 200, body: out };
  } catch (err) {
    return { status: (err && err.status) || 500, body: { message: (err && err.message) || "Something went wrong" } };
  }
}

// Signing out: forget this session (the app sends its token), then go where it asked.
export async function logout(db, request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(nx_[0-9a-f]{64})$/i);
  if (m && db) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha(m[1])).run();
}

// ---- "Continue with Google" (our own Google sign-in: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// secrets from the owner's Google Cloud project, redirect URI <origin>/api/apps/auth/google/callback).
// Start: a random state is kept in a short cookie with where to go afterwards, then Google.
// Back: the state must match, the code is swapped for the person's verified email with Google
// directly, and they're signed in to the account with that email (a new one if there's none).
const GOOGLE_COOKIE = "nx_google";

function samePath(to) {
  const p = String(to || "/");
  return p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") && p.length < 500 ? p : "/";
}

export function googleStart(env, request) {
  const url = new URL(request.url);
  if (!env.GOOGLE_CLIENT_ID) return Response.redirect(url.origin + "/login?google=soon", 302);
  let to = url.searchParams.get("to") || "/chat";
  const from = url.searchParams.get("from_url");
  if (from) {
    try {
      const f = new URL(from);
      if (f.origin === url.origin) to = f.pathname + f.search;
    } catch {}
  }
  const state = randomHex(16);
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", url.origin + "/api/apps/auth/google/callback");
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("prompt", "select_account");
  const cookie = `${GOOGLE_COOKIE}=${state}.${encodeURIComponent(samePath(to))}; Path=/api/apps/auth/google; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
  return new Response(null, { status: 302, headers: { location: google.toString(), "set-cookie": cookie, "cache-control": "no-store" } });
}

export async function googleCallback(db, env, request) {
  const url = new URL(request.url);
  const fail = (why) =>
    new Response(null, { status: 302, headers: { location: `${url.origin}/login?google=failed&why=${encodeURIComponent(why)}`, "set-cookie": `${GOOGLE_COOKIE}=; Path=/api/apps/auth/google; Max-Age=0`, "cache-control": "no-store" } });
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\s*)${GOOGLE_COOKIE}=([0-9a-f]{32})\.([^;]*)`));
  const state = url.searchParams.get("state") || "";
  if (!m || !sameHex(m[1], state)) return fail("expired");
  const code = url.searchParams.get("code");
  if (!code) return fail("cancelled");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + "/api/apps/auth/google/callback",
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  const tok = res && res.ok ? await res.json().catch(() => null) : null;
  if (!tok || !tok.id_token) return fail("google");
  // Straight from Google over HTTPS, so its contents can be trusted without checking the signature.
  let info = null;
  try {
    const part = tok.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    info = JSON.parse(atob(part + "===".slice((part.length + 3) % 4)));
  } catch {}
  if (!info || info.aud !== env.GOOGLE_CLIENT_ID || !info.email || info.email_verified !== true) return fail("email");
  const email = cleanEmail(info.email);
  const row = await db.prepare("SELECT * FROM logins WHERE email = ?").bind(email).first();
  let userId = row && row.user_id;
  if (!userId) {
    const existing = await userByEmail(db, email);
    userId = existing
      ? existing.id
      : (await create(db, "User", { system: true }, { email, full_name: String(info.name || email.split("@")[0]).slice(0, 80), role: "user", status: "active" })).id;
  }
  // Google has confirmed the email, so the login counts as verified (the password stays as it was).
  if (row) await db.prepare("UPDATE logins SET verified = 1 WHERE email = ?").bind(email).run();
  else await db.prepare("INSERT INTO logins (email, user_id, pw_hash, pw_salt, verified) VALUES (?, ?, NULL, NULL, 1)").bind(email, userId).run();
  const user = await getRow(db, "User", userId);
  if (!user || user.removed === true) return fail("removed");
  // No password yet (new, or moved over from Base44): Google only confirms who they are. They're
  // emailed a link to choose a password, then log in with it on the page they came from.
  const pw = await db.prepare("SELECT pw_hash FROM logins WHERE email = ?").bind(email).first();
  if (!pw || !pw.pw_hash) {
    await sendResetLink(env, db, email, url.origin, "google").catch(() => {});
    return new Response(null, {
      status: 302,
      headers: { location: `${url.origin}/login?google=check`, "set-cookie": `${GOOGLE_COOKIE}=; Path=/api/apps/auth/google; Max-Age=0`, "cache-control": "no-store" },
    });
  }
  const session = await newSession(db, userId);
  const to = new URL(samePath(decodeURIComponent(m[2] || "/")), url.origin);
  to.searchParams.set("access_token", session);
  return new Response(null, {
    status: 302,
    headers: { location: to.toString(), "set-cookie": `${GOOGLE_COOKIE}=; Path=/api/apps/auth/google; Max-Age=0`, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
