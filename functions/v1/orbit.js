// Nebulux Orbit (https://github.com/TheBlueDrago/nebulux-orbit): a personal AI agent website that signs
// people in with their Nebulux AI account and has its own, separate credits ("Orbit credits").
//   { action: "link" }                     (from nebuluxai.com, with the person's Nebulux sign-in)
//                                          -> { code }   a one-time code, good for 5 minutes
//   { action: "exchange", code }           -> { token, name }   the Orbit sign-in (kept by the Orbit site)
//   { action: "me" }                       -> { name, credits, daily }
//   { action: "chat", messages, memory }   -> { reply, credits }
//   { action: "plan", goal, memory }       -> { steps: [string], credits }
//   { action: "signout" }                  -> { ok }
// Orbit calls send "Authorization: Orbit <token>". Orbit tokens: ORBIT_WEEKLY free every week (no money
// involved). Paid in tokens: what was sent and written (about 4 letters a token). Separate from Nebulux AI.
// Orbit only talks and plans: it can't buy anything, send messages, or see cards or passwords.
import { currentUser } from "../../cloudflare-lib/credits.js";
import { allow } from "../../cloudflare-lib/ratelimit.js";
import { orbitGenerate } from "../api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js";

const ORIGINS = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev$/, /^https:\/\/([a-z0-9-]+\.)?nebulux-orbit\.pages\.dev$/, /^https:\/\/orbit\.nebuluxai\.com$/, /^https:\/\/nebuluxai\.com$/, /^http:\/\/localhost(:\d+)?$/];
const ORBIT_WEEKLY = 1000000; // free Orbit tokens each week (a token is about 4 letters)
const MIN_TOKENS = 300; // what one more reply needs at least
const corsFor = (request) => {
  const o = request.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://nebuluxorbit.thebluedragonstriker.workers.dev", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", Vary: "Origin" };
};
const out = (request, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...corsFor(request) } });
const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
// The week starts on Monday (UTC); the free tokens refill then.
const weekKey = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const tokensOf = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t || "").length, 0) / 4);

let ready = null;
const ensure = (db) =>
  (ready ||= db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, exp INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_wallets (user_id TEXT PRIMARY KEY, credits INTEGER NOT NULL, day TEXT NOT NULL)"),
  ]).catch((e) => { ready = null; throw e; }));

async function orbitUser(db, request) {
  const m = /^Orbit\s+([a-f0-9]{48})$/i.exec(request.headers.get("authorization") || "");
  if (!m) return null;
  return await db.prepare("SELECT user_id, name FROM orbit_tokens WHERE token = ?").bind(m[1]).first();
}
// The week's free tokens are topped up the first time they're looked at each week.
async function wallet(db, uid) {
  const w = await db.prepare("SELECT credits, day FROM orbit_wallets WHERE user_id = ?").bind(uid).first();
  if (!w || w.day !== weekKey()) {
    const credits = ORBIT_WEEKLY;
    await db.prepare("INSERT INTO orbit_wallets (user_id, credits, day) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET credits = excluded.credits, day = excluded.day").bind(uid, credits, weekKey()).run();
    return credits;
  }
  return w.credits;
}
const spend = (db, uid, n) => db.prepare("UPDATE orbit_wallets SET credits = MAX(0, credits - ?) WHERE user_id = ?").bind(n, uid).run();

const ORBIT_RULES = `You are Nebulux Orbit, a friendly personal AI agent made by Nebulux AI. You help the person with their day: answering questions, remembering what they tell you (see "What you know about them"), planning goals step by step, and keeping track of tasks. You only talk and plan: you cannot browse, buy or pay for anything, send messages or emails, or reach their computer, and you never ask for passwords, card numbers or other private details. If they ask you to do one of those, say you can't and tell them how they can do it themselves. Keep answers clear and warm.`;
const memoryBlock = (memory) => {
  const m = String(memory || "").trim().slice(0, 4000);
  return m ? `What you know about them (they wrote or approved this):\n${m}\n\n` : "";
};

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: corsFor(request) });

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  if (!db) return out(request, { error: "Nebulux Orbit isn't available right now." }, 503);
  try {
    await ensure(db);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "link") {
      const user = await currentUser(request);
      if (!user) return out(request, { error: "Sign in to Nebulux AI first." }, 401);
      if (!(await allow(`orbit-link:${user.id}`, 10, 600))) return out(request, { error: "Too many tries. Wait a few minutes." }, 429);
      const code = rand(16);
      await db.prepare("INSERT INTO orbit_codes (code, user_id, name, exp) VALUES (?, ?, ?, ?)").bind(code, user.id, String(user.full_name || "").slice(0, 60), Date.now() + 5 * 60000).run();
      return out(request, { code });
    }
    if (action === "exchange") {
      const ip = request.headers.get("cf-connecting-ip") || "x";
      if (!(await allow(`orbit-ex:${ip}`, 20, 600))) return out(request, { error: "Too many tries. Wait a few minutes." }, 429);
      const code = String(body.code || "").toLowerCase();
      if (!/^[a-f0-9]{32}$/.test(code)) return out(request, { error: "That sign-in link isn't valid." }, 400);
      const row = await db.prepare("SELECT user_id, name, exp FROM orbit_codes WHERE code = ?").bind(code).first();
      await db.prepare("DELETE FROM orbit_codes WHERE code = ? OR exp < ?").bind(code, Date.now()).run();
      if (!row || row.exp < Date.now()) return out(request, { error: "That sign-in link has expired. Try again." }, 400);
      const token = rand(24);
      await db.prepare("INSERT INTO orbit_tokens (token, user_id, name, at) VALUES (?, ?, ?, ?)").bind(token, row.user_id, row.name, Date.now()).run();
      return out(request, { token, name: row.name || "there" });
    }

    const me = await orbitUser(db, request);
    if (!me) return out(request, { error: "Please sign in with Nebulux again." }, 401);
    if (action === "signout") {
      await db.prepare("DELETE FROM orbit_tokens WHERE token = ?").bind(String(request.headers.get("authorization")).split(/\s+/)[1]).run();
      return out(request, { ok: true });
    }
    if (action === "me") return out(request, { name: me.name || "there", credits: await wallet(db, me.user_id), weekly: ORBIT_WEEKLY });

    if (action === "chat" || action === "plan") {
      if (!(await allow(`orbit-ai:${me.user_id}`, 12, 60))) return out(request, { error: "Slow down a little: up to 12 a minute." }, 429);
      const have = await wallet(db, me.user_id);
      if (have < MIN_TOKENS) return out(request, { error: `You've used this week's Orbit tokens. You get ${ORBIT_WEEKLY.toLocaleString("en-US")} free again on Monday.`, credits: have }, 402);
      let prompt;
      if (action === "chat") {
        const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-16).map((m) => `${m.role === "assistant" ? "Orbit" : "Them"}: ${String(m.content || "").slice(0, 3000)}`).join("\n\n");
        if (!msgs) return out(request, { error: "Say something first." }, 400);
        prompt = `${ORBIT_RULES}\n\n${memoryBlock(body.memory)}The conversation so far:\n${msgs}\n\nReply as Orbit to their last message.`;
      } else {
        const goal = String(body.goal || "").trim().slice(0, 600);
        if (!goal) return out(request, { error: "Type a goal first." }, 400);
        prompt = `${ORBIT_RULES}\n\n${memoryBlock(body.memory)}Make a short, practical step-by-step plan for this goal: "${goal}". Answer ONLY with the steps, one per line, 3 to 8 steps, each starting with "- ", no other text.`;
      }
      const text = String(await orbitGenerate(env, prompt, 8000)).trim();
      await spend(db, me.user_id, tokensOf(prompt, text));
      const credits = await wallet(db, me.user_id);
      if (action === "chat") return out(request, { reply: text, credits });
      const steps = text.split("\n").map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 8);
      return out(request, { steps, credits });
    }
    return out(request, { error: "Unknown action." }, 400);
  } catch (err) {
    return out(request, { error: (err && err.message) || "Something went wrong." }, 500);
  }
}
