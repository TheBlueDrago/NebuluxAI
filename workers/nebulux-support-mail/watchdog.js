// Site watchdog: every 15 minutes (the cron trigger in wrangler.toml) it checks that the main
// parts of Nebulux AI answer, and emails the owner when something breaks and again when it's
// fixed. A check has to fail twice in a row before an email goes out, so a one-off blip doesn't.
// State is kept in KV (the site's PUBLISHED_HTML namespace) and only written when it changes.
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

const FROM = "watchdog@nebuluxai.com";
const KEY = "watchdog:state";

const get = (url, init = {}) => fetch(url, { ...init, headers: { "user-agent": "NebuluxWatchdog/1.0", ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });

// Each check returns "" when fine, or what's wrong in plain words.
export const CHECKS = {
  "Website (nebuluxai.com)": async () => {
    const r = await get("https://nebuluxai.com/");
    if (!r.ok) return `the home page answered ${r.status}`;
    const html = await r.text();
    if (!html.includes('id="root"')) return "the home page came back without the app";
    // The app's main code file must load too (a broken update leaves the page blank).
    const js = (html.match(/\/assets\/index-[\w-]+\.js/) || [])[0];
    if (!js) return "the home page doesn't point at the app's code";
    const c = await get(`https://nebuluxai.com${js}`);
    if (!c.ok || /text\/html/.test(c.headers.get("content-type") || "")) return "the app's code file is missing (people would see a blank page)";
    return "";
  },
  "Sign-in page": async () => {
    const r = await get("https://nebuluxai.com/login");
    return r.ok ? "" : `the sign-in page answered ${r.status}`;
  },
  "Published games and sites": async () => {
    const r = await get("https://cosmic-catch.nebuluxai.com/");
    if (!r.ok) return `cosmic-catch.nebuluxai.com answered ${r.status}`;
    return /cosmic/i.test(await r.text()) ? "" : "cosmic-catch.nebuluxai.com came back empty";
  },
  "AI server": async () => {
    // Without a sign-in or question the AI must still answer (a 4xx "can't do that"), not crash (5xx).
    const r = await get("https://nebuluxai.pages.dev/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return r.status < 500 ? "" : `it answered ${r.status} (a server error)`;
  },
};

export async function runChecks() {
  const out = {};
  for (const [name, check] of Object.entries(CHECKS)) {
    try {
      out[name] = await check();
    } catch (e) {
      out[name] = e && e.name === "TimeoutError" ? "it didn't answer within 15 seconds" : "it couldn't be reached";
    }
  }
  return out;
}

async function email(env, subject, text) {
  if (!env.WATCHDOG_MAIL) return;
  const msg = createMimeMessage();
  msg.setSender({ name: "Nebulux AI Watchdog", addr: FROM });
  msg.setRecipient(env.WATCHDOG_TO);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/plain", data: text });
  await env.WATCHDOG_MAIL.send(new EmailMessage(FROM, env.WATCHDOG_TO, msg.asRaw()));
}

export async function watchdog(env) {
  const results = await runChecks();
  const prev = (await env.KV.get(KEY, "json").catch(() => null)) || { fails: {}, down: {} };
  const next = { fails: {}, down: { ...prev.down } };
  const broke = [];
  const fixed = [];
  for (const [name, problem] of Object.entries(results)) {
    if (problem) {
      next.fails[name] = (prev.fails[name] || 0) + 1;
      if (next.fails[name] >= 2 && !prev.down[name]) {
        next.down[name] = problem;
        broke.push(`- ${name}: ${problem}`);
      }
    } else if (prev.down[name]) {
      delete next.down[name];
      fixed.push(`- ${name}`);
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(prev)) await env.KV.put(KEY, JSON.stringify(next));
  const when = new Date().toUTCString();
  if (broke.length) await email(env, "⚠ Nebulux AI: something is down", `The watchdog found a problem (${when}):\n\n${broke.join("\n")}\n\nIt checks again every 15 minutes and will email you when it's working again.`);
  if (fixed.length) await email(env, "✅ Nebulux AI: working again", `These are working again (${when}):\n\n${fixed.join("\n")}`);
  return results;
}
