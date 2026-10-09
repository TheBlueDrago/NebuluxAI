// NebuluxFetch(url, { method, headers, body }) on a published website (cloudflare-lib/sitevars.js):
// makes the request for the site, putting its secret variables in place of {{NAME}} in the
// address, headers or body, so a secret like an API key never reaches visitors' browsers.
// POST https://nebuluxai.com/v1/site-fetch  { site, url, method, headers, body } -> { status, body }
// Only https addresses on the public internet; small answers; limits per visitor and per site.
import { allow } from "../../cloudflare-lib/ratelimit.js";
import { readVars, secretVars, textVars } from "../../cloudflare-lib/sitevars.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const BAD_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost|(.*\.)?nebuluxai\.com|(.*\.)?pages\.dev|(.*\.)?workers\.dev|metadata\.google\.internal)$/i;
const IP = /^\[?[0-9a-f:.]+\]?$/i;
const MAX_OUT = 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const kv = env.PUBLISHED_HTML;
  const body = await request.json().catch(() => ({}));
  const site = String(body.site || "").toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/.test(site)) return out({ error: "Unknown website." }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await allow(`sitefetch:${site}:${ip}`, 30, 60))) return out({ error: "Too many requests. Wait a moment." }, 429);
  if (!(await allow(`sitefetch:${site}`, 2000, 3600))) return out({ error: "This website is very busy. Try again later." }, 429);
  const vars = await readVars(kv, site);
  if (!vars.length) return out({ error: "This website has no variables set up." }, 403);
  const all = { ...textVars(vars), ...secretVars(vars) };
  const fill = (s) => String(s).replace(/\{\{\s*([A-Z][A-Z0-9_]{0,39})\s*\}\}/g, (m, n) => (n in all ? all[n] : m));

  let url;
  try { url = new URL(fill(String(body.url || ""))); } catch { return out({ error: "That address isn't valid." }, 400); }
  if (url.protocol !== "https:" || IP.test(url.hostname) || BAD_HOST.test(url.hostname) || url.port) return out({ error: "Only https addresses on the public internet are allowed." }, 400);
  const method = METHODS.includes(String(body.method || "GET").toUpperCase()) ? String(body.method || "GET").toUpperCase() : "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(body.headers && typeof body.headers === "object" ? body.headers : {}).slice(0, 30)) {
    if (/^(host|cookie|content-length|cf-|x-forwarded)/i.test(k)) continue;
    try { headers.set(k, fill(v)); } catch {}
  }
  const payload = method === "GET" || body.body == null ? undefined : fill(String(body.body)).slice(0, 200000);
  let res;
  try { res = await fetch(url.toString(), { method, headers, body: payload, redirect: "manual", signal: AbortSignal.timeout(15000) }); }
  catch { return out({ error: "Couldn't reach that address." }, 502); }
  let text = await res.text().catch(() => "");
  if (text.length > MAX_OUT) text = text.slice(0, MAX_OUT);
  // Never echo a secret back to the browser, even if the other server repeats it.
  for (const v of Object.values(secretVars(vars))) if (v && v.length >= 4) text = text.split(v).join("[secret]");
  return out({ status: res.status, body: text });
}
