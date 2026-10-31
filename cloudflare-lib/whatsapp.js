// The real WhatsApp connection, through Meta's official WhatsApp Business Platform (Cloud API).
// Nebulux has one WhatsApp number. Someone links their own WhatsApp to their Nebulux account by sending
// it a one-time code (Settings → Connectors → WhatsApp → Connect); after that they can chat with
// Nebulux AI in WhatsApp (functions/v1/whatsapp.js) and say "send this to my WhatsApp" in a chat.
//
// WhatsApp's rules shape it: Nebulux only ever writes to the person's own number, and only within 24
// hours of their last message to it (that's also what keeps it free: Meta charges for conversations a
// business starts, never for replies). It can't read or send anyone's personal chats.
//
// Setup (docs/connectors-setup.md), as Cloudflare secrets on the Nebulux AI Pages project:
//   WHATSAPP_TOKEN         a permanent access token (a System User token with whatsapp_business_messaging)
//   WHATSAPP_PHONE_ID      the phone number ID from WhatsApp → API Setup
//   WHATSAPP_APP_SECRET    the Meta app's secret (checks that webhook calls really come from Meta)
//   WHATSAPP_VERIFY_TOKEN  any long random text, also typed into the webhook settings on Meta
// Until all four are set, WhatsApp stays the simple "Send to WhatsApp" button (wa.me).
import { seal, unseal } from "./seal.js";

const GRAPH = "https://graph.facebook.com/v21.0";
export const WINDOW_MS = 24 * 3600 * 1000;
export const DAILY_MAX = 30; // WhatsApp chats with Nebulux AI per person per day
const CODE_MS = 15 * 60 * 1000;

export const waReady = (env) => !!(env && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN);

let made = null;
export function waEnsure(db) {
  if (!made) made = db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS whatsapp_links (k TEXT PRIMARY KEY, user_id TEXT NOT NULL, last_in INTEGER, day TEXT, n INTEGER DEFAULT 0, hist TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS whatsapp_links_user ON whatsapp_links (user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS whatsapp_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, exp INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS whatsapp_seen (id TEXT PRIMARY KEY, at INTEGER NOT NULL)"),
  ]).catch((e) => { made = null; throw e; });
  return made;
}

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const hmac = async (secret, text) => hex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(text)));
// The person's number is never a lookup key in the clear: links are found by a keyed hash of it.
export const waKey = (env, wa) => hmac(String(env.WHATSAPP_APP_SECRET), "wa|" + String(wa));
// Meta signs every webhook call with the app secret (X-Hub-Signature-256: sha256=<hex>).
export async function signatureOk(env, raw, header) {
  const got = String(header || "").replace(/^sha256=/, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(got)) return false;
  const want = await hmac(String(env.WHATSAPP_APP_SECRET), raw);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// "the number ending in 1234": all the Connectors list shows of it ("Connected as the number ending in 1234").
export const maskNumber = (wa) => "the number ending in " + String(wa).slice(-4);
const bind = (uid) => uid + "|whatsapp";

// Nebulux's own number (digits only), for wa.me links: asked once from Meta, or WHATSAPP_NUMBER.
let numberCache = "";
export async function waNumber(env) {
  if (env.WHATSAPP_NUMBER) return String(env.WHATSAPP_NUMBER).replace(/\D/g, "");
  if (numberCache) return numberCache;
  try {
    const r = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_ID}?fields=display_phone_number`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } });
    const d = await r.json();
    numberCache = String((d && d.display_phone_number) || "").replace(/\D/g, "");
  } catch { /* the link still opens WhatsApp */ }
  return numberCache;
}
export const chatLink = (number, text = "") => `https://wa.me/${number}${text ? "?text=" + encodeURIComponent(text) : ""}`;

// Markdown from the AI → WhatsApp's own formatting (*bold*, _italic_, no headings or tables).
export function toWhatsApp(md) {
  return String(md || "")
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/^\|?\s*:?-{3,}.*$/gm, "")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
// WhatsApp takes up to 4,096 characters a message: longer text goes as a few messages, split at a line.
export function chunks(text, max = 4000, most = 3) {
  const out = [];
  let rest = String(text || "");
  while (rest.length > max && out.length < most - 1) {
    let at = rest.lastIndexOf("\n", max);
    if (at < max / 2) at = rest.lastIndexOf(" ", max);
    if (at < max / 2) at = max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest.length > max ? rest.slice(0, max - 1) + "…" : rest);
  return out;
}

// One text message from Nebulux's number. { ok } or { error, window } (window: the 24 hours had passed).
export async function waSend(env, to, text) {
  for (const body of chunks(text)) {
    const r = await fetch(`${GRAPH}/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: String(to), type: "text", text: { preview_url: false, body } }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      const code = d && d.error && d.error.code;
      return code === 131047 ? { error: WINDOW_TEXT, window: true } : { error: "WhatsApp didn't take the message just now. Please try again." };
    }
  }
  return { ok: true };
}
export const WINDOW_TEXT = "WhatsApp only lets Nebulux message you within 24 hours of your last message to it. Send Nebulux a quick message on WhatsApp, then try again.";
// Shows the person's message as read (blue ticks) while the answer is written.
export const markRead = (env, id) => fetch(`${GRAPH}/${env.WHATSAPP_PHONE_ID}/messages`, {
  method: "POST",
  headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: id }),
}).catch(() => null);

// Connect: a one-time code for this person (15 minutes) to send from their WhatsApp.
export async function newCode(db, uid) {
  await db.prepare("DELETE FROM whatsapp_codes WHERE user_id = ? OR exp < ?").bind(uid, Date.now()).run();
  for (let i = 0; i < 5; i++) {
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const r = await db.prepare("INSERT OR IGNORE INTO whatsapp_codes (code, user_id, exp) VALUES (?, ?, ?)").bind(code, uid, Date.now() + CODE_MS).run();
    if (r && r.meta && r.meta.changes) return code;
  }
  throw new Error("Couldn't make a code. Please try again.");
}

// The code came in from a number: link that number to the code's account (any earlier link of the
// number, or of the account, is replaced). Returns the user id, or null for a wrong or old code.
export async function useCode(env, db, wa, code) {
  const row = await db.prepare("SELECT user_id, exp FROM whatsapp_codes WHERE code = ?").bind(code).first();
  if (!row || row.exp < Date.now()) return null;
  await db.prepare("DELETE FROM whatsapp_codes WHERE code = ?").bind(code).run();
  const uid = row.user_id, k = await waKey(env, wa), now = Date.now();
  const before = await db.prepare("SELECT user_id FROM whatsapp_links WHERE k = ?").bind(k).first();
  if (before && before.user_id !== uid) await db.prepare("DELETE FROM orbit_connections WHERE user_id = ? AND provider = 'whatsapp'").bind(before.user_id).run();
  await db.prepare("DELETE FROM whatsapp_links WHERE user_id = ? OR k = ?").bind(uid, k).run();
  await db.prepare("INSERT INTO whatsapp_links (k, user_id, last_in, day, n, hist) VALUES (?, ?, ?, '', 0, '[]')").bind(k, uid, now).run();
  const sealed = await seal(env, JSON.stringify({ n: String(wa) }), bind(uid));
  await db.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at, scopes, status) VALUES (?, 'whatsapp', ?, ?, ?, NULL, NULL) ON CONFLICT(user_id, provider) DO UPDATE SET refresh = excluded.refresh, email = excluded.email, at = excluded.at, status = NULL")
    .bind(uid, sealed, maskNumber(wa), now).run();
  return uid;
}

// The person's own number, from their sealed connection ("" when only the button is on).
export async function numberOf(env, db, uid) {
  const c = await db.prepare("SELECT refresh FROM orbit_connections WHERE user_id = ? AND provider = 'whatsapp'").bind(uid).first();
  if (!c || !c.refresh || c.refresh === "-") return "";
  try { return String(JSON.parse((await unseal(env, c.refresh, bind(uid))) || "{}").n || ""); } catch { return ""; }
}

// "Send this to my WhatsApp" from Nebulux AI or a reply's button: to their own number, inside the 24 hours.
export async function sendToOwn(env, db, uid, text) {
  const body = String(text || "").trim();
  if (!body) return { error: "There's nothing to send." };
  const wa = await numberOf(env, db, uid);
  if (!wa) return { error: "Link your WhatsApp first: Settings → Connectors → WhatsApp → Connect." };
  const link = await db.prepare("SELECT last_in FROM whatsapp_links WHERE k = ?").bind(await waKey(env, wa)).first();
  if (!link || !link.last_in || Date.now() - link.last_in > WINDOW_MS - 60000) return { error: WINDOW_TEXT, window: true, chat: chatLink(await waNumber(env), "Hi") };
  const r = await waSend(env, wa, toWhatsApp(body));
  return r.ok ? { ok: true } : { ...r, ...(r.window ? { chat: chatLink(await waNumber(env), "Hi") } : {}) };
}

// Disconnect (or account deleted): the link goes too.
export const unlink = (db, uid) => db.prepare("DELETE FROM whatsapp_links WHERE user_id = ?").bind(uid).run().catch(() => {});

// What the AI is told when it answers in WhatsApp.
export const WA_RULES = `You are Nebulux AI, answering a message on WhatsApp. Be helpful, friendly and brief: a few short paragraphs or a short list at most, because it's read on a phone. Use WhatsApp formatting only: *bold*, _italic_, simple lists with "-" or numbers. No tables, no headings and no code blocks unless they ask for code. From WhatsApp you can't see their Nebulux chats or files and you can't build websites or games; for those, tell them to open nebuluxai.com. Never ask for passwords, card numbers or other private details.`;
