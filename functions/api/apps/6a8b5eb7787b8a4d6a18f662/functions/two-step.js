// Two-step verification: a 6-digit code emailed to the account (sent with Resend from
// support@nebuluxai.com, RESEND_API_KEY secret) or from an authenticator app (Google Authenticator, Microsoft
// Authenticator, Authy...): the site can't email codes to everyone, and app codes are safer anyway.
// Turned on in account settings (components/profile/TwoStepPanel.jsx); when it's on, the app asks
// for a code after signing in (components/TwoStepGate.jsx) unless this device was remembered.
//
// { action: "status" }                   -> { enabled, method: "app" | "email", email (masked) }
// { action: "send" }                     -> emails a code (10 minutes)
// { action: "enable-email", code }       -> { enabled: true } (email codes on)
// { action: "setup" }                    -> { secret, uri }   (not on until "enable")
// { action: "enable", code }             -> { enabled: true }
// { action: "disable", code }            -> { enabled: false }
// { action: "check", code, remember }    -> { ok, device? }   (device: token for "remember me")
// { action: "device", device }           -> { ok }            (is this remembered device still good)
//
// KV (PUBLISHED_HTML): twofa:<id> = { secret, at }, twofa-setup:<id> = secret (10 minutes),
// twofa-dev:<id>:<sha256(device)> = 1 (90 days).
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const REMEMBER_DAYS = 90;

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s) {
  const clean = String(s || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// The standard 6-digit time code (RFC 6238: HMAC-SHA1, 30 seconds).
export async function totp(secret, step) {
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new Uint8Array(8);
  let n = step;
  for (let i = 7; i >= 0; i--) {
    msg[i] = n & 255;
    n = Math.floor(n / 256);
  }
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 15;
  const num = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(num % 1000000).padStart(6, "0");
}

// Right now, or one step either side (phones' clocks drift a little).
export async function codeOk(secret, code, now = Date.now()) {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6 || !secret) return false;
  const step = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) if ((await totp(secret, step + d)) === c) return true;
  return false;
}

const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const random = (n) => crypto.getRandomValues(new Uint8Array(n));

// "sa•••@gmail.com": enough to recognise, not enough to read out.
export const maskEmail = (e) => {
  const s = String(e || "");
  const at = s.indexOf("@");
  return at > 0 ? `${s.slice(0, Math.min(2, at))}${"•".repeat(Math.max(1, Math.min(5, at - 2)))}${s.slice(at)}` : "";
};

async function sendCode(env, to, code) {
  if (!env.RESEND_API_KEY) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "Nebulux AI <support@nebuluxai.com>",
        to: [to],
        subject: `${code} is your Nebulux AI sign-in code`,
        text: `Your Nebulux AI sign-in code is ${code}\n\nIt works for 10 minutes. If you didn't try to sign in, change your password: someone may know it.\n\nNebulux AI`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a"><p>Your Nebulux AI sign-in code:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p><p style="color:#475569;font-size:14px">It works for 10 minutes. If you didn't try to sign in, change your password: someone may know it.</p><p style="color:#475569;font-size:14px">Nebulux AI</p></div>`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const body = await request.json().catch(() => ({}));
    const saved = await kv.get(`twofa:${user.id}`, "json");
    const action = body.action || "status";

    if (action === "status") return json({ enabled: !!saved, method: saved ? (saved.secret ? "app" : "email") : null, email: maskEmail(user.email) });

    // Email a 6-digit code (Resend, from support@nebuluxai.com). Used to turn on email codes, and at
    // sign-in by everyone with two-step on (app users can pick "email me a code instead").
    if (action === "send") {
      if (!user.email) return json({ error: "Your account has no email address." }, 400);
      if (!(await allow(`twofa-send:${user.id}`, 5, 600))) return json({ error: "Too many codes sent. Wait 10 minutes." }, 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      await kv.put(`twofa-code:${user.id}`, await sha(`${user.id}:${code}`), { expirationTtl: 600 });
      const sent = await sendCode(env, user.email, code);
      if (!sent) return json({ error: "Couldn't send the email right now. Try again in a minute." }, 502);
      return json({ sent: true, email: maskEmail(user.email) });
    }
    // The emailed code, once: right and not older than 10 minutes.
    const emailCodeOk = async (code) => {
      const want = await kv.get(`twofa-code:${user.id}`);
      const c = String(code || "").replace(/\D/g, "");
      if (!want || c.length !== 6 || want !== (await sha(`${user.id}:${c}`))) return false;
      await kv.delete(`twofa-code:${user.id}`);
      return true;
    };

    if (action === "enable-email") {
      if (saved) return json({ enabled: true });
      if (!(await allow(`twofa:${user.id}`, 10, 600))) return json({ error: "Too many tries. Wait 10 minutes." }, 429);
      if (!(await emailCodeOk(body.code))) return json({ error: "That code isn't right, or it's older than 10 minutes. Send a new one." }, 400);
      await kv.put(`twofa:${user.id}`, JSON.stringify({ method: "email", at: new Date().toISOString() }));
      return json({ enabled: true, method: "email" });
    }

    if (action === "device") {
      if (!saved) return json({ ok: true });
      const d = String(body.device || "");
      return json({ ok: d.length > 20 && !!(await kv.get(`twofa-dev:${user.id}:${await sha(d)}`)) });
    }

    // Guessing codes: at most 10 tries in 10 minutes.
    const tries = async () => allow(`twofa:${user.id}`, 10, 600);

    if (action === "setup") {
      if (saved) return json({ error: "Two-step verification is already on." }, 400);
      const secret = base32Encode(random(20));
      await kv.put(`twofa-setup:${user.id}`, secret, { expirationTtl: 600 });
      const label = encodeURIComponent(`Nebulux AI:${user.email || user.id}`);
      return json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Nebulux AI")}&digits=6&period=30` });
    }

    if (action === "enable") {
      if (saved) return json({ enabled: true });
      if (!(await tries())) return json({ error: "Too many tries. Wait 10 minutes." }, 429);
      const secret = await kv.get(`twofa-setup:${user.id}`);
      if (!secret) return json({ error: "That took too long. Start again." }, 400);
      if (!(await codeOk(secret, body.code))) return json({ error: "That code isn't right. Check the app and try the newest code." }, 400);
      await kv.put(`twofa:${user.id}`, JSON.stringify({ secret, at: new Date().toISOString() }));
      await kv.delete(`twofa-setup:${user.id}`);
      return json({ enabled: true });
    }

    if (action === "disable" || action === "check") {
      if (!saved) return json(action === "check" ? { ok: true } : { enabled: false });
      if (!(await tries())) return json({ error: "Too many tries. Wait 10 minutes." }, 429);
      // A code from the app (if they use one) or the latest emailed code both work.
      const ok = (saved.secret && (await codeOk(saved.secret, body.code))) || (await emailCodeOk(body.code));
      if (!ok) return json({ error: saved.secret ? "That code isn't right. Try the newest code in your app, or the one we emailed." : "That code isn't right, or it's older than 10 minutes. Send a new one." }, 400);
      if (action === "disable") {
        await kv.delete(`twofa:${user.id}`);
        return json({ enabled: false });
      }
      if (body.remember) {
        const device = base32Encode(random(24));
        await kv.put(`twofa-dev:${user.id}:${await sha(device)}`, "1", { expirationTtl: REMEMBER_DAYS * 86400 });
        return json({ ok: true, device });
      }
      return json({ ok: true });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
