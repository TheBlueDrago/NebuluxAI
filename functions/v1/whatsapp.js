// Meta's webhook for Nebulux's WhatsApp number (cloudflare-lib/whatsapp.js has the whole picture).
//   GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...   Meta checking the address once
//   POST (signed with the app secret)                                  messages people send to Nebulux
// A message with a Connect code links that number to the code's account. From a linked number, Nebulux
// AI answers in the chat (up to DAILY_MAX a day); "STOP" unlinks. Anyone else gets one hello a day
// telling them how to link. Answers are written after Meta gets its quick "ok" (waitUntil).
import { waReady, waEnsure, signatureOk, waKey, waSend, markRead, useCode, toWhatsApp, WA_RULES, DAILY_MAX } from "../../cloudflare-lib/whatsapp.js";
import { orbitGenerate } from "../api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js";
import { ageStatus } from "../../cloudflare-lib/agegate.js";
import { allow } from "../../cloudflare-lib/ratelimit.js";

export const LINKED_TEXT = "Linked! This WhatsApp is now connected to your Nebulux AI account. Ask me anything here, and in any Nebulux AI chat you can say \"send this to my WhatsApp\". Send STOP any time to unlink.";
export const HELLO_TEXT = "Hi! This is Nebulux AI. To chat with me here, link your WhatsApp first: on nebuluxai.com open Settings, then Connectors, then WhatsApp, press Connect, and send me the code it shows.";
export const BAD_CODE_TEXT = "That code didn't work, or it's more than 15 minutes old. Get a new one in Nebulux AI: Settings, Connectors, WhatsApp, Connect.";
export const UNLINKED_TEXT = "Done: this WhatsApp isn't linked to Nebulux any more. You can link it again any time in Settings, Connectors.";
export const TEXT_ONLY = "I can only read text messages here for now. Type your question and I'll answer.";
export const SORRY_TEXT = "Sorry, I couldn't answer that just now. Please try again in a minute.";
export const limitText = (n) => `That's today's ${n} messages here. You can keep chatting at nebuluxai.com, or come back tomorrow.`;

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (waReady(env) && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge") || "", { headers: { "content-type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!waReady(env) || !env.DB) return new Response("Not set up", { status: 503 });
  const raw = await request.text();
  if (!(await signatureOk(env, raw, request.headers.get("x-hub-signature-256")))) return new Response("Bad signature", { status: 401 });
  let body = {};
  try { body = JSON.parse(raw); } catch { return new Response("ok"); }
  const msgs = [];
  for (const e of body.entry || []) for (const c of e.changes || []) {
    const v = (c && c.value) || {};
    if (v.metadata && String(v.metadata.phone_number_id) !== String(env.WHATSAPP_PHONE_ID)) continue;
    for (const m of v.messages || []) msgs.push(m);
  }
  if (msgs.length) {
    const work = (async () => { await waEnsure(env.DB); for (const m of msgs.slice(0, 10)) await handle(env, m).catch(() => {}); })();
    if (context.waitUntil) context.waitUntil(work); else await work;
  }
  return new Response("ok");
}

// One message from someone's WhatsApp. gen: the AI (the tests pass a stand-in).
export async function handle(env, m, gen = orbitGenerate) {
  const db = env.DB, wa = String((m && m.from) || "");
  if (!/^\d{6,15}$/.test(wa) || !m.id) return;
  // Meta sometimes delivers a message twice: answer it once.
  const fresh = await db.prepare("INSERT OR IGNORE INTO whatsapp_seen (id, at) VALUES (?, ?)").bind(String(m.id), Date.now()).run();
  if (!fresh || !fresh.meta || !fresh.meta.changes) return;
  if (Math.random() < 0.02) await db.prepare("DELETE FROM whatsapp_seen WHERE at < ?").bind(Date.now() - 3 * 864e5).run();
  const text = m.type === "text" ? String((m.text && m.text.body) || "").trim() : "";
  const k = await waKey(env, wa);
  const link = await db.prepare("SELECT user_id, day, n, hist FROM whatsapp_links WHERE k = ?").bind(k).first();

  // A Connect code: "Link Nebulux 123456" (what the Connect button fills in), or just the six digits.
  const code = (/(?:^|\D)(\d{6})(?:\D|$)/.exec(text) || [])[1];
  if (code && (!link || /\b(link|nebulux|code)\b/i.test(text) || text === code)) {
    if (await useCode(env, db, wa, code)) return waSend(env, wa, LINKED_TEXT);
    if (!link) return waSend(env, wa, BAD_CODE_TEXT);
  }
  if (!link) {
    if (await allow(`wa-hello:${k}`, 1, 86400)) await waSend(env, wa, HELLO_TEXT);
    return;
  }
  await db.prepare("UPDATE whatsapp_links SET last_in = ? WHERE k = ?").bind(Date.now(), k).run();
  if (/^(stop|unlink|disconnect)[.!]?$/i.test(text)) {
    await db.prepare("DELETE FROM whatsapp_links WHERE k = ?").bind(k).run();
    await db.prepare("DELETE FROM orbit_connections WHERE user_id = ? AND provider = 'whatsapp'").bind(link.user_id).run();
    return waSend(env, wa, UNLINKED_TEXT);
  }
  if (!text) return waSend(env, wa, TEXT_ONLY);
  const age = await ageStatus(db, link.user_id).catch(() => ({}));
  if (age.blocked) return;
  const today = new Date().toISOString().slice(0, 10);
  const n = link.day === today ? Number(link.n) || 0 : 0;
  if (n >= DAILY_MAX) {
    if (n === DAILY_MAX) {
      await db.prepare("UPDATE whatsapp_links SET day = ?, n = ? WHERE k = ?").bind(today, n + 1, k).run();
      await waSend(env, wa, limitText(DAILY_MAX));
    }
    return;
  }
  markRead(env, m.id);
  let hist = [];
  try { hist = JSON.parse(link.hist || "[]"); } catch { hist = []; }
  if (!Array.isArray(hist)) hist = [];
  const past = hist.map((h) => `User: ${h.u}\nAssistant: ${h.a}`).join("\n\n");
  const prompt = `${WA_RULES}\n\n${past ? past + "\n\n" : ""}User: ${text.slice(0, 2000)}\nAssistant:`;
  let reply = "";
  try { reply = toWhatsApp((await gen(env, prompt, 3500)).text); } catch { reply = ""; }
  await waSend(env, wa, reply || SORRY_TEXT);
  // The last few messages, so a follow-up question makes sense (deleted when the number is unlinked).
  const next = reply ? [...hist, { u: text.slice(0, 600), a: reply.slice(0, 900) }].slice(-6) : hist;
  await db.prepare("UPDATE whatsapp_links SET day = ?, n = ?, hist = ? WHERE k = ?").bind(today, n + 1, JSON.stringify(next), k).run();
}
