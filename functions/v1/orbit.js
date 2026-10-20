// Nebulux Orbit (https://github.com/TheBlueDrago/nebulux-orbit): a personal AI agent website that signs
// people in with their Nebulux AI account and has its own, separate credits ("Orbit credits").
//   { action: "link" }                     (from nebuluxai.com, with the person's Nebulux sign-in)
//                                          -> { code }   a one-time code, good for 5 minutes
//   { action: "exchange", code }           -> { token, name }   the Orbit sign-in (kept by the Orbit site)
//   { action: "me" }                       -> { name, credits, daily }
//   { action: "chat", messages, memory }   -> { reply, credits }
//   { action: "plan", goal, memory }       -> { steps: [string], credits }
//   { action: "load" } / { action: "save", data } -> the person's tasks, goals, chat and memory
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
export const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const rand = randHex;
// Addresses the Orbit site can come back to after connecting something (orbit-google/start.js).
export const ORBIT_RETURN = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev(\/|$)/, /^https:\/\/orbit\.nebuluxai\.com(\/|$)/, /^http:\/\/localhost(:\d+)?(\/|$)/];
// The week starts on Monday (UTC); the free tokens refill then.
const weekKey = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const tokensOf = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t || "").length, 0) / 4);

let ready = null;
const ensure = (db) =>
  (ready ||= db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, exp INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_wallets (user_id TEXT PRIMARY KEY, credits INTEGER NOT NULL, day TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_data (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL)"),
    // Connections (Gmail for now): the permission Google gave, kept until they disconnect.
    // Orbit is for ages 13 and up: the birthday is asked once and can't be changed afterwards.
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_ages (user_id TEXT PRIMARY KEY, birth TEXT NOT NULL, at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_states (state TEXT PRIMARY KEY, user_id TEXT NOT NULL, back TEXT NOT NULL, exp INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_connections (user_id TEXT NOT NULL, provider TEXT NOT NULL, refresh TEXT NOT NULL, email TEXT, at INTEGER NOT NULL, PRIMARY KEY (user_id, provider))"),
  ]).catch((e) => { ready = null; throw e; }));
export const orbitEnsure = ensure;

export async function orbitUserByToken(db, token) {
  if (!/^[a-f0-9]{48}$/i.test(String(token || ""))) return null;
  return await db.prepare("SELECT user_id, name FROM orbit_tokens WHERE token = ?").bind(String(token)).first();
}
async function orbitUser(db, request) {
  const m = /^Orbit\s+([a-f0-9]{48})$/i.exec(request.headers.get("authorization") || "");
  return m ? orbitUserByToken(db, m[1]) : null;
}

// ---- Gmail (only after the person connects it, and sending only when they press Send) ----
async function googleAccess(env, db, uid, provider) {
  const c = await db.prepare("SELECT refresh, email FROM orbit_connections WHERE user_id = ? AND provider = ?").bind(uid, provider).first();
  if (!c) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: c.refresh, grant_type: "refresh_token" }),
  }).catch(() => null);
  const t = r && r.ok ? await r.json().catch(() => null) : null;
  return t && t.access_token ? { token: t.access_token, email: c.email } : null;
}
const gmailAccess = (env, db, uid) => googleAccess(env, db, uid, "gmail");
const gapi = (access, url, init = {}) => fetch(url, { ...init, headers: { Authorization: "Bearer " + access.token, "Content-Type": "application/json", ...(init.headers || {}) } });
// Google Calendar: the next events, and adding one the person approved.
async function calendarList(access) {
  const now = new Date().toISOString();
  const r = await gapi(access, `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&maxResults=12&singleEvents=true&orderBy=startTime`);
  const d = r.ok ? await r.json() : null;
  return ((d && d.items) || []).map((e) => ({ id: e.id, title: e.summary || "(no title)", start: (e.start && (e.start.dateTime || e.start.date)) || "", end: (e.end && (e.end.dateTime || e.end.date)) || "", where: e.location || "" }));
}
async function calendarAdd(access, title, start, end) {
  const r = await gapi(access, "https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify({ summary: title, start: { dateTime: start }, end: { dateTime: end } }) });
  return r.ok;
}
// Google Drive (Docs, Slides, Sheets and more): recent files, and the text of one they pick.
async function driveList(access) {
  const r = await gapi(access, "https://www.googleapis.com/drive/v3/files?pageSize=15&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)&q=trashed%3Dfalse");
  const d = r.ok ? await r.json() : null;
  return (d && d.files) || [];
}
async function driveRead(access, id) {
  const meta = await gapi(access, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,mimeType`).then((r) => (r.ok ? r.json() : null));
  if (!meta) return null;
  const g = meta.mimeType.startsWith("application/vnd.google-apps.");
  const url = g ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${meta.mimeType.endsWith("spreadsheet") ? "text/csv" : "text/plain"}` : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
  if (!g && !/^text\/|json|csv|markdown/.test(meta.mimeType)) return { name: meta.name, text: "(Orbit can only read Google Docs, Slides, Sheets and text files.)" };
  const text = await gapi(access, url).then((r) => (r.ok ? r.text() : ""));
  return { name: meta.name, text: String(text).slice(0, 20000) };
}
const header = (msg, name) => ((msg.payload && msg.payload.headers) || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
async function gmailList(access, max = 10) {
  const g = (path) => fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { headers: { Authorization: "Bearer " + access.token } }).then((r) => (r.ok ? r.json() : null));
  const list = await g(`messages?maxResults=${max}&labelIds=INBOX`);
  const out = [];
  for (const m of (list && list.messages) || []) {
    const full = await g(`messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
    if (full) out.push({ id: m.id, from: header(full, "From"), subject: header(full, "Subject"), date: header(full, "Date"), snippet: String(full.snippet || "").slice(0, 300), unread: (full.labelIds || []).includes("UNREAD") });
  }
  return out;
}
async function gmailSend(access, to, subject, text) {
  const enc = (s) => btoa(unescape(encodeURIComponent(s)));
  const raw = [`To: ${to}`, `Subject: =?UTF-8?B?${enc(subject)}?=`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", enc(text)].join("\r\n");
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: "Bearer " + access.token, "Content-Type": "application/json" }, body: JSON.stringify({ raw: btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }) });
  return r.ok;
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

const ORBIT_RULES = `You are Nebulux Orbit, a friendly personal AI agent made by Nebulux AI. You help the person with their day: answering questions, remembering what they tell you (see "What you know about them"), planning goals step by step, and keeping track of tasks. You talk and plan. If they connected Gmail, their latest emails may be included below, and you can read and summarize them; you can write email drafts, but you never send one yourself: they review it and press Send. You cannot browse, buy or pay for anything, or reach their computer, and you never ask for passwords, card numbers or other private details. If they ask you to do one of those, say you can't and tell them how they can do it themselves. Keep answers clear and warm.`;
const memoryBlock = (memory) => {
  const m = String(memory || "").trim().slice(0, 4000);
  return m ? `What you know about them (they wrote or approved this):\n${m}\n\n` : "";
};

// Muse Spark (Meta's Model API, https://dev.meta.ai/docs): used when the MUSE_SPARK_API_KEY secret is set
// on this project. It's paid per token (Standard mode: $1.25 per 1M sent, $4.25 per 1M written), so
// replies are kept short. If Muse fails (no key, out of credit, busy) the caller uses the free models.
async function museGenerate(env, system, user) {
  const key = env.MUSE_SPARK_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.meta.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "muse-spark-1.3", messages: [{ role: "developer", content: system }, { role: "user", content: user }], max_completion_tokens: 1500, reasoning_effort: "low" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return text ? String(text) : null;
  } catch {
    return null;
  }
}

export const onRequestOptions =({ request }) => new Response(null, { status: 204, headers: corsFor(request) });

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
    const ageRow = await db.prepare("SELECT birth FROM orbit_ages WHERE user_id = ?").bind(me.user_id).first();
    const ageOf = (birth) => { const b = new Date(birth + "T00:00:00Z"), n = new Date(); let a = n.getUTCFullYear() - b.getUTCFullYear(); if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a; };
    const under13 = ageRow ? ageOf(ageRow.birth) < 13 : false;
    if (action === "setbirth") {
      if (ageRow) return out(request, { error: "Your birthday is already set.", under13 }, 400);
      const birth = String(body.birth || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(new Date(birth)) || ageOf(birth) > 120 || ageOf(birth) < 0) return out(request, { error: "Enter your real birthday." }, 400);
      await db.prepare("INSERT INTO orbit_ages (user_id, birth, at) VALUES (?, ?, ?)").bind(me.user_id, birth, Date.now()).run();
      return out(request, { ok: true, under13: ageOf(birth) < 13 });
    }
    if (action === "me") return out(request, { name: me.name || "there", credits: await wallet(db, me.user_id), weekly: ORBIT_WEEKLY, needBirth: !ageRow, under13 });
    if (action !== "signout" && (!ageRow || under13)) return out(request, { error: under13 ? "Nebulux Orbit is for ages 13 and up." : "Enter your birthday first.", needBirth: !ageRow, under13 }, 403);
    // Tasks, goals, chat and memory kept with the account, so every device shows the same Orbit.
    if (action === "load") {
      const row = await db.prepare("SELECT data, at FROM orbit_data WHERE user_id = ?").bind(me.user_id).first();
      return out(request, { data: row ? JSON.parse(row.data) : null, at: row ? row.at : 0 });
    }
    if (action === "save") {
      if (!(await allow(`orbit-save:${me.user_id}`, 30, 60))) return out(request, { error: "Saving too often." }, 429);
      const text = JSON.stringify(body.data || {});
      if (text.length > 400000) return out(request, { error: "That's too much to save (400 KB at most)." }, 413);
      const at = Date.now();
      await db.prepare("INSERT INTO orbit_data (user_id, data, at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, at = excluded.at").bind(me.user_id, text, at).run();
      return out(request, { ok: true, at });
    }

    // ---- connections ----
    if (action === "connections") {
      const rows = (await db.prepare("SELECT provider, email, at FROM orbit_connections WHERE user_id = ?").bind(me.user_id).all()).results || [];
      return out(request, { connections: rows, gmailReady: !!env.GOOGLE_CLIENT_ID, googleReady: !!env.GOOGLE_CLIENT_ID, githubReady: !!env.GITHUB_CLIENT_ID });
    }
    if (action === "disconnect") {
      const c = await db.prepare("SELECT refresh FROM orbit_connections WHERE user_id = ? AND provider = ?").bind(me.user_id, String(body.provider || "")).first();
      if (c && body.provider !== "github") await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(c.refresh), { method: "POST" }).catch(() => {});
      await db.prepare("DELETE FROM orbit_connections WHERE user_id = ? AND provider = ?").bind(me.user_id, String(body.provider || "")).run();
      return out(request, { ok: true });
    }
    if (action === "gmail_list") {
      if (!(await allow(`orbit-gmail:${me.user_id}`, 20, 60))) return out(request, { error: "Slow down a little." }, 429);
      const a = await gmailAccess(env, db, me.user_id);
      if (!a) return out(request, { error: "Connect Gmail first (Connections)." }, 400);
      return out(request, { email: a.email, messages: await gmailList(a, Math.min(20, Math.max(1, +body.max || 10))) });
    }
    if (action === "github_list") {
      if (!(await allow(`orbit-gh:${me.user_id}`, 20, 60))) return out(request, { error: "Slow down a little." }, 429);
      const c = await db.prepare("SELECT refresh, email FROM orbit_connections WHERE user_id = ? AND provider = 'github'").bind(me.user_id).first();
      if (!c) return out(request, { error: "Connect GitHub first (Connections)." }, 400);
      const gh = (path) => fetch("https://api.github.com/" + path, { headers: { Authorization: "Bearer " + c.refresh, "User-Agent": "Nebulux-Orbit", Accept: "application/vnd.github+json" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const [repos, work] = await Promise.all([gh("user/repos?sort=updated&per_page=10"), gh(`search/issues?q=${encodeURIComponent("is:open involves:" + c.email)}&sort=updated&per_page=10`)]);
      return out(request, { login: c.email, repos: (repos || []).map((r) => ({ name: r.full_name, url: r.html_url, private: r.private, updated: r.updated_at, about: r.description || "" })), open: ((work && work.items) || []).map((i) => ({ title: i.title, url: i.html_url, repo: String(i.repository_url || "").split("/repos/")[1] || "", pr: !!i.pull_request })) });
    }
    if (action === "calendar_list" || action === "calendar_add" || action === "drive_list" || action === "drive_read") {
      if (!(await allow(`orbit-g:${me.user_id}`, 30, 60))) return out(request, { error: "Slow down a little." }, 429);
      const provider = action.startsWith("calendar") ? "calendar" : "drive";
      const a = await googleAccess(env, db, me.user_id, provider);
      if (!a) return out(request, { error: `Connect ${provider === "calendar" ? "Google Calendar" : "Google Drive"} first (Connections).` }, 400);
      if (action === "calendar_list") return out(request, { events: await calendarList(a) });
      if (action === "drive_list") return out(request, { files: await driveList(a) });
      if (action === "drive_read") { const f = await driveRead(a, String(body.id || "")); return f ? out(request, f) : out(request, { error: "That file couldn't be opened." }, 404); }
      if (body.confirmed !== true) return out(request, { error: "Press Add to confirm." }, 400);
      const title = String(body.title || "").slice(0, 200), start = new Date(body.start), end = new Date(body.end || +new Date(body.start) + 3600e3);
      if (!title || isNaN(start) || isNaN(end)) return out(request, { error: "Add a title and a time." }, 400);
      return (await calendarAdd(a, title, start.toISOString(), end.toISOString())) ? out(request, { ok: true }) : out(request, { error: "Google Calendar didn't add it." }, 502);
    }
    if (action === "gmail_send") {
      // Only sent when the person pressed Send on the email themselves (the site asks first).
      if (body.confirmed !== true) return out(request, { error: "Press Send to confirm." }, 400);
      if (!(await allow(`orbit-send:${me.user_id}`, 20, 86400))) return out(request, { error: "That's the most emails Orbit can send for you today." }, 429);
      const to = String(body.to || "").trim(), subject = String(body.subject || "").slice(0, 200), text = String(body.text || "").slice(0, 20000);
      if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(to)) return out(request, { error: "That email address doesn't look right." }, 400);
      const a = await gmailAccess(env, db, me.user_id);
      if (!a) return out(request, { error: "Connect Gmail first (Connections)." }, 400);
      return (await gmailSend(a, to, subject, text)) ? out(request, { ok: true }) : out(request, { error: "Gmail didn't send it. Try again." }, 502);
    }

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
      // Muse Spark first (when its key is set), the free Google models otherwise or if Muse fails.
      const task = prompt.slice(ORBIT_RULES.length + 2);
      const text = String((await museGenerate(env, ORBIT_RULES, task)) || (await orbitGenerate(env, prompt, 8000))).trim();
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
