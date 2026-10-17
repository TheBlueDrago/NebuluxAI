// Emails to the owner (every admin account's email) when something happens they want to know
// about: a new account, a plan bought or asked for, a blocked website or game, a rude username,
// a message the AI's safety filter blocked, or suspicious activity like many failed sign-ins.
// Sent with Resend (RESEND_API_KEY), whose free plan allows 100 emails a day for everything,
// sign-up codes included, so owner alerts are capped at ALERTS_PER_DAY and the same alert
// (same key) isn't sent again within an hour.
import { allow } from "./ratelimit.js";

const ALERTS_PER_DAY = 80;

export async function ownerEmails(db) {
  if (!db) return [];
  const r = await db
    .prepare("SELECT json_extract(data, '$.email') AS email FROM rows WHERE entity = 'User' AND json_extract(data, '$.role') = 'admin'")
    .all()
    .catch(() => ({ results: [] }));
  return [...new Set((r.results || []).map((x) => x.email).filter(Boolean))].slice(0, 5);
}

// Where a request came from, as Cloudflare sees it (city, region, country).
export function placeOf(request) {
  const cf = (request && request.cf) || {};
  return [cf.city, cf.region, cf.country].filter(Boolean).join(", ") || "unknown";
}

// alertOwner(env, { key, subject, lines }): lines is a list of "Label: value" strings.
export async function alertOwner(env, { key, subject, lines }) {
  try {
    if (!env || !env.RESEND_API_KEY || !env.DB) return false;
    if (key && !(await allow(`owner-alert:${key}`, 1, 3600))) return false;
    if (!(await allow("owner-alert-day", ALERTS_PER_DAY, 86400))) return false;
    const to = await ownerEmails(env.DB);
    if (!to.length) return false;
    const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const text = [...lines, `Time: ${when}`, "", "Sent by Nebulux AI. See Monitor for more."].join("\n");
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5"><h2 style="margin:0 0 12px">${esc(subject)}</h2>${text
      .split("\n")
      .map((l) => (l ? `<div>${esc(l)}</div>` : "<br>"))
      .join("")}</div>`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: "Nebulux AI <support@nebuluxai.com>", to, subject: `[Nebulux] ${subject}`, text, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Words that make a username, site or game name inappropriate (also inside longer words for the
// worst ones). Light on purpose: it flags for the owner to look at, it doesn't block anyone.
// Inside any word: these never appear in normal words.
const RUDE = ["fuck", "shit", "bitch", "cunt", "pussy", "asshole", "slut", "whore", "nigger", "nigga", "faggot", "retard", "porn", "hitler", "killyourself"];
// Only as a whole word, so "grape", "peacock", "Dickens" and "Essex" are fine.
const RUDE_WORDS = ["rape", "cock", "dick", "sex", "nude", "nudes", "kys", "nazi", "fag"];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
export function rudeText(t) {
  const low = String(t || "").toLowerCase().replace(/[0-9@$!]/g, (c) => LEET[c] || c);
  const joined = low.replace(/[^a-z]/g, "");
  const words = low.split(/[^a-z]+/).filter(Boolean);
  return RUDE.find((w) => joined.includes(w)) || RUDE_WORDS.find((w) => words.includes(w)) || "";
}
