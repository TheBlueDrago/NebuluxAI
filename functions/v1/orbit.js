// Nebulux Orbit (https://github.com/TheBlueDrago/nebulux-orbit): a personal AI agent website that signs
// people in with their Nebulux AI account and has its own, separate credits ("Orbit credits").
//   { action: "link" }                     (from nebuluxai.com, with the person's Nebulux sign-in)
//                                          -> { code }   a one-time code, good for 5 minutes
//   { action: "exchange", code }           -> { token, name }   the Orbit sign-in (kept by the Orbit site)
//   { action: "me" }                       -> { name, credits, daily }
//   { action: "chat", messages, memory }   -> { reply, credits }
//   { action: "plan", goal, memory }       -> { steps: [string], usage }
//   { action: "load" } / { action: "save", data } -> the person's tasks, goals, chat and memory
//   { action: "signout" }                  -> { ok }
// Orbit calls send "Authorization: Orbit <token>". Usage works like Muse's: every request is charged
// the tokens the model really used (input + output, from the API's usage data), so the whole chat
// history that's resent each turn counts and longer chats cost more. That comes out of a weekly
// allowance first (shown only as a percentage; it resets 7 days after it started, at the same time),
// then out of a bonus pool (referrals or purchases; shown as an exact number). Separate from Nebulux AI.
// Orbit only talks and plans: it can't buy anything, send messages, or see cards or passwords.
import { currentUser } from "../../cloudflare-lib/credits.js";
import { allow } from "../../cloudflare-lib/ratelimit.js";
import { orbitGenerate } from "../api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js";
import { publicUrl, parseResults, pageText, viewHtml } from "../api/apps/6a8b5eb7787b8a4d6a18f662/functions/web-browse.js";

const ORIGINS = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev$/, /^https:\/\/([a-z0-9-]+\.)?nebulux-orbit\.pages\.dev$/, /^https:\/\/orbit\.nebuluxai\.com$/, /^https:\/\/nebuluxai\.com$/, /^http:\/\/localhost(:\d+)?$/];
// The weekly allowance in tokens: the ORBIT_WEEKLY_TOKENS setting on Cloudflare, or this.
const weeklyOf = (env) => Math.max(1000, Number(env.ORBIT_WEEKLY_TOKENS) || 1000000);
const WEEK = 7 * 86400e3;
const corsFor = (request) => {
  const o = request.headers.get("Origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://nebuluxorbit.thebluedragonstriker.workers.dev", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", Vary: "Origin" };
};
const out = (request, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...corsFor(request) } });
export const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const rand = randHex;
// Addresses the Orbit site can come back to after connecting something (orbit-google/start.js).
export const ORBIT_RETURN = [/^https:\/\/nebuluxorbit\.thebluedragonstriker\.workers\.dev(\/|$)/, /^https:\/\/orbit\.nebuluxai\.com(\/|$)/, /^http:\/\/localhost(:\d+)?(\/|$)/];
// Only for a reply from a model that doesn't report its usage: about 4 letters a token.
const tokensOf = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t || "").length, 0) / 4);

let ready = null;
const ensure = (db) =>
  (ready ||= db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, exp INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, at INTEGER NOT NULL)"),
    // used: tokens used of this week's allowance. reset_at: when it goes back to 0 (every 7 days,
    // at the time of day they first used Orbit). bonus: extra tokens, spent only after the allowance.
    db.prepare("CREATE TABLE IF NOT EXISTS orbit_usage (user_id TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL, bonus INTEGER NOT NULL DEFAULT 0)"),
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
// Someone's usage, with the weekly allowance reset once its 7 days are up.
async function usageRow(db, uid) {
  const now = Date.now();
  let u = await db.prepare("SELECT used, reset_at, bonus FROM orbit_usage WHERE user_id = ?").bind(uid).first();
  if (!u) {
    u = { used: 0, reset_at: now + WEEK, bonus: 0 };
    await db.prepare("INSERT OR IGNORE INTO orbit_usage (user_id, used, reset_at, bonus) VALUES (?, 0, ?, 0)").bind(uid, u.reset_at).run();
  } else if (now >= u.reset_at) {
    // Same time of day as before, in 7-day steps (missed weeks are skipped).
    u = { used: 0, reset_at: u.reset_at + Math.ceil((now - u.reset_at + 1) / WEEK) * WEEK, bonus: u.bonus };
    await db.prepare("UPDATE orbit_usage SET used = 0, reset_at = ? WHERE user_id = ?").bind(u.reset_at, uid).run();
  }
  return u;
}
// What the site shows: a percentage of the weekly allowance (never the raw count), the reset time,
// and the bonus tokens as an exact number.
const usageView = (env, u) => {
  const limit = weeklyOf(env), pct = Math.min(100, (u.used / limit) * 100);
  return { pct: Math.round(pct * 10) / 10, resetAt: u.reset_at, bonus: Math.max(0, u.bonus), out: u.used >= limit && u.bonus <= 0 };
};
// Charges what a request used: from the weekly allowance first, then the bonus pool.
async function charge(env, db, uid, tokens) {
  const u = await usageRow(db, uid), limit = weeklyOf(env);
  const fromWeek = Math.min(tokens, Math.max(0, limit - u.used)), fromBonus = Math.min(Math.max(0, u.bonus), tokens - fromWeek);
  await db.prepare("UPDATE orbit_usage SET used = used + ?, bonus = MAX(0, bonus - ?) WHERE user_id = ?").bind(fromWeek, fromBonus, uid).run();
  return { ...u, used: u.used + fromWeek, bonus: u.bonus - fromBonus };
}

const ORBIT_RULES = `You are Orbit, a personal AI agent by Nebulux. You're sharp, warm and direct, like a capable friend who gets things done: lead with the answer, skip filler and disclaimers, keep it short unless they want depth, and use a little formatting (bold, short lists) when it helps. Never say you're a language model, never mention Google or Gemini, and never say you "don't have access" to something listed here: you do.

What you can see and do inside Orbit:
- Their account: "Their Orbit account" below has their usage (the share of the free weekly limit used, when it resets, bonus tokens). When they ask about credits, tokens, usage or limits, answer from it exactly.
- Memory: "What you know about them" below.
- Their tasks and goals: listed below when they have any.
- Connected apps: Gmail, Google Calendar, Drive, Tasks, YouTube and GitHub, once they connect them on the Connections page. If something they ask needs an app they haven't connected, tell them to connect it there.
- A web browser with tabs they can see. For fresh information or a web page, put ONE of these alone on the last line and stop: [[search: what to look up]] or [[open: https://full-address]]. The page comes back to you as "Browser:", then you answer from it. A few times in a row at most.
- Actions you can take for them, each on its own line, anywhere in your answer (they run when you finish): [[task: what to do | optional due like 2026-10-25 17:00]] adds a task, [[remember: a fact about them]] saves to their memory (only things they said and want remembered), [[goal: a goal]] makes a step-by-step plan in their Goals, [[theme: dark]] or [[theme: light]], and [[go: chat|goals|tasks|memory|connections|settings|usage|browser]] opens that page. Use them when they ask you to do something, and say in a few words what you did.

Limits: you never buy or pay for anything, log in to websites, fill in forms, or send emails or messages yourself (they review drafts and press Send), and you never ask for passwords, card numbers or other private details.`;
// What Orbit knows about their account, so it can answer "how many credits have I used?".
const accountBlock = (env, u) => {
  const when = new Date(u.resetAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  return `Their Orbit account: Free plan. ${u.pct < 1 && u.pct > 0 ? "1%" : Math.floor(u.pct) + "%"} of the free weekly limit used. The weekly limit resets ${when} (every 7 days). Bonus tokens left: ${u.bonus.toLocaleString("en-US")} (used only after the weekly limit runs out). Paid plans (Starter, Expert) are coming soon. Show percentages for the weekly limit, never a raw token count.\n\n`;
};
// Their open tasks and goals, sent by the site.
const listBlock = (body) => {
  const t = (Array.isArray(body.tasks) ? body.tasks : []).slice(0, 20).map((x) => "- " + String(x).slice(0, 160)).join("\n");
  const g = (Array.isArray(body.goals) ? body.goals : []).slice(0, 10).map((x) => "- " + String(x).slice(0, 160)).join("\n");
  return (t ? `Their open tasks:\n${t}\n\n` : "") + (g ? `Their goals:\n${g}\n\n` : "");
};
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
      signal: AbortSignal.timeout(12000), // a slow answer falls back to the other model instead of keeping people waiting
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    const u = d && d.usage;
    return text ? { text: String(text), tokens: u ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } : null } : null;
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
    if (action === "me") return out(request, { name: me.name || "there", usage: usageView(env, await usageRow(db, me.user_id)), needBirth: !ageRow, under13 });
    if (action === "usage") return out(request, { usage: usageView(env, await usageRow(db, me.user_id)) });
    if (action !== "signout" && (!ageRow || under13)) return out(request, { error: under13 ? "Your account isn't available yet." : "Enter your birthday first.", needBirth: !ageRow, under13 }, 403);
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
    if (action === "youtube_list" || action === "gtasks_list") {
      if (!(await allow(`orbit-g:${me.user_id}`, 30, 60))) return out(request, { error: "Slow down a little." }, 429);
      const provider = action === "youtube_list" ? "youtube" : "tasks";
      const a = await googleAccess(env, db, me.user_id, provider);
      if (!a) return out(request, { error: `Connect ${provider === "youtube" ? "YouTube" : "Google Tasks"} first (Connections).` }, 400);
      const g = (u) => fetch(u, { headers: { Authorization: "Bearer " + a } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (provider === "youtube") {
        const [subs, lists] = await Promise.all([g("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=15&order=relevance"), g("https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=10")]);
        return out(request, { channels: ((subs && subs.items) || []).map((i) => ({ name: i.snippet.title, about: String(i.snippet.description || "").slice(0, 140) })), playlists: ((lists && lists.items) || []).map((i) => ({ name: i.snippet.title, count: i.contentDetails?.itemCount || 0 })) });
      }
      const lists = await g("https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=10");
      const all = await Promise.all(((lists && lists.items) || []).slice(0, 5).map(async (l) => { const t = await g(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(l.id)}/tasks?showCompleted=false&maxResults=25`); return ((t && t.items) || []).map((x) => ({ list: l.title, title: x.title, due: x.due || "" })); }));
      return out(request, { tasks: all.flat().filter((t) => t.title) });
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

    // The browser: search results, or a page (its text for Orbit, and a safe copy to show in a tab).
    if (action === "web_search" || action === "web_open") {
      if (!(await allow(`orbit-web:${me.user_id}`, 30, 60))) return out(request, { error: "Too many pages at once. Wait a minute." }, 429);
      const headers = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 NebuluxOrbit/1.0", accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" };
      try {
        if (action === "web_search") {
          const q = String(body.q || "").trim().slice(0, 300);
          if (!q) return out(request, { results: [] });
          const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers });
          if (!res.ok) return out(request, { error: "Search isn't working right now." }, 502);
          return out(request, { results: parseResults(await res.text()) });
        }
        const u = publicUrl(body.url);
        if (!u) return out(request, { error: "That address can't be opened." }, 400);
        const res = await fetch(u.href, { headers, redirect: "follow", signal: AbortSignal.timeout(15000) });
        const final = publicUrl(res.url) ? res.url : u.href, type = res.headers.get("content-type") || "";
        if (!/text\/html|text\/plain|xhtml/.test(type)) return out(request, { url: final, title: "", text: `(This is a ${type.split(";")[0] || "file"}, not a web page.)` });
        const raw = (await res.text()).slice(0, 1500000);
        const { title, text } = /html/.test(type) ? pageText(raw) : { title: "", text: raw.slice(0, 20000) };
        return out(request, { url: final, title, text, ...(body.view && /html/.test(type) ? { html: viewHtml(raw, final) } : {}) });
      } catch {
        return out(request, { error: "The page couldn't be opened." }, 502);
      }
    }
    if (action === "chat" || action === "plan") {
      if (!(await allow(`orbit-ai:${me.user_id}`, 12, 60))) return out(request, { error: "Slow down a little: up to 12 a minute." }, 429);
      const now = usageView(env, await usageRow(db, me.user_id));
      if (now.out) return out(request, { error: "You've reached your weekly limit.", limitReached: true, usage: now }, 402);
      let prompt;
      if (action === "chat") {
        const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-16).map((m) => `${m.role === "assistant" ? "Orbit" : "Them"}: ${String(m.content || "").slice(0, 6000)}`).join("\n\n");
        if (!msgs) return out(request, { error: "Say something first." }, 400);
        prompt = `${ORBIT_RULES}\n\n${accountBlock(env, now)}${memoryBlock(body.memory)}${listBlock(body)}The conversation so far:\n${msgs}\n\nReply as Orbit to their last message.`;
      } else {
        const goal = String(body.goal || "").trim().slice(0, 600);
        if (!goal) return out(request, { error: "Type a goal first." }, 400);
        prompt = `${ORBIT_RULES}\n\n${memoryBlock(body.memory)}Make a short, practical step-by-step plan for this goal: "${goal}". Answer ONLY with the steps, one per line, 3 to 8 steps, each starting with "- ", no other text.`;
      }
      // Streamed chat: the words arrive as they're written (newline-separated JSON: {d} pieces, then
      // {done, usage}). Stop on the site cancels the request, which ends the answer here too, and
      // only what was used up to then is charged.
      if (action === "chat" && body.stream) {
        const enc = new TextEncoder();
        let gone = false;
        const stream = new ReadableStream({
          async start(ctl) {
            const send = (o) => { if (!gone) try { ctl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { gone = true; } };
            let text = "";
            try {
              const muse = env.MUSE_SPARK_API_KEY ? await museGenerate(env, ORBIT_RULES, prompt.slice(ORBIT_RULES.length + 2)) : null;
              if (muse) { text = muse.text; send({ d: text }); }
              const r = muse || (await orbitGenerate(env, prompt, 8000, { onDelta: (t) => { text += t; send({ d: t }); }, shouldStop: () => gone || request.signal?.aborted }));
              const used = r.tokens && !r.stopped ? r.tokens.input + r.tokens.output : tokensOf(prompt, r.text || text);
              send({ done: true, stopped: !!r.stopped, usage: usageView(env, await charge(env, db, me.user_id, used)) });
            } catch (e) {
              if (text) await charge(env, db, me.user_id, tokensOf(prompt, text)).catch(() => {});
              send({ error: "Orbit couldn't answer just now. Try again." });
            }
            try { ctl.close(); } catch {}
          },
          cancel() { gone = true; },
        });
        return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", ...corsFor(request) } });
      }
      // Muse Spark first (when its key is set), the free Google models otherwise or if Muse fails.
      const task = prompt.slice(ORBIT_RULES.length + 2);
      const r = (await museGenerate(env, ORBIT_RULES, task)) || (await orbitGenerate(env, prompt, 8000));
      const text = String(r.text || "").trim();
      if (!text) return out(request, { error: "Orbit couldn't answer just now. Try again." }, 503);
      const used = r.tokens ? r.tokens.input + r.tokens.output : tokensOf(prompt, text);
      const usage = usageView(env, await charge(env, db, me.user_id, used));
      if (action === "chat") return out(request, { reply: text, usage });
      const steps = text.split("\n").map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim()).filter(Boolean).slice(0, 8);
      return out(request, { steps, usage });
    }
    return out(request, { error: "Unknown action." }, 400);
  } catch (err) {
    return out(request, { error: (err && err.message) || "Something went wrong." }, 500);
  }
}
