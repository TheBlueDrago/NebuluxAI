// Custom domains for published websites (Pro and up, not the free trial week): someone points
// their own domain (say www.mybakery.com) at Nebulux and their site shows there, with HTTPS.
// It uses Cloudflare for SaaS "custom hostnames" on the nebuluxai.com zone (the first 100 are
// free); the site router Worker (workers/nebulux-site-router) serves them.
//
// { action: "get", site }               -> { domain | null, ... status }
// { action: "add", site, hostname }     -> reserves it: the TXT record to add to prove it's theirs
// { action: "verify", site }            -> checks that TXT record; if it's there, registers it
// { action: "remove", site }            -> { ok }
//
// Needs two Pages secrets: CF_ZONE_ID (nebuluxai.com's zone id) and CF_API_TOKEN (a token
// with "SSL and Certificates: Edit" on that zone). KV (PUBLISHED_HTML):
//   domain:<hostname>   -> { site, owner, id }   (read by the router)
//   sitedomain:<site>   -> { hostname, id }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser, entitlement } from "../../../../../cloudflare-lib/credits.js";
import { pageFor } from "../../../../../cloudflare-lib/pagesource.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";

export const CNAME_TARGET = "customers.nebuluxai.com";
const PAID = ["pro", "team", "secret", "enterprise", "admin"];

// A real public hostname that isn't ours: letters, digits and dashes, at least one dot.
export function cleanHostname(raw) {
  let h = String(raw || "").trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  if (h.length > 253 || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) return "";
  if (/(^|\.)(nebuluxai\.com|blackhole-ai-tech\.com|pages\.dev|workers\.dev|base44\.app)$/.test(h)) return "";
  return h;
}

async function cf(env, method, path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames${path}`, {
    method,
    headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) {
    const msg = (j.errors && j.errors[0] && j.errors[0].message) || `Cloudflare answered ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return j.result;
}

// What the person needs to do, in plain words, from Cloudflare's status.
function describe(hostname, result) {
  const ssl = (result && result.ssl && result.ssl.status) || "";
  const live = result && result.status === "active" && ssl === "active";
  return {
    domain: hostname,
    live,
    status: live ? "live" : result && result.status === "active" ? "securing" : "waiting",
    target: CNAME_TARGET,
    apex: hostname.split(".").length === 2,
    // Cloudflare may ask for a TXT record to prove the domain is theirs.
    txt: result && result.ownership_verification && result.status !== "active" ? { name: result.ownership_verification.name, value: result.ownership_verification.value } : null,
  };
}

// Ownership check: a TXT record at _nebulux-verify.<domain> with a secret value we hand out.
export const txtName = (hostname) => `_nebulux-verify.${hostname}`;
export const txtValue = (token) => `nebulux-verify=${token}`;
const newToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

// Looks the TXT record up in public DNS (Cloudflare's DNS-over-HTTPS resolver).
export async function hasTxt(name, value) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" } });
    const j = await r.json();
    return (j.Answer || []).some((a) => a.type === 16 && String(a.data || "").replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim() === value);
  } catch {
    return false;
  }
}

// Before ownership is proven: the TXT record to add (and the CNAME, which can go in at the same time).
function pending(rec) {
  return { domain: rec.hostname, live: false, status: "verify", target: CNAME_TARGET, apex: rec.hostname.split(".").length === 2, verify: { name: txtName(rec.hostname), value: txtValue(rec.token) } };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.PUBLISHED_HTML;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    if (!env.CF_ZONE_ID || !env.CF_API_TOKEN) return json({ error: "Custom domains aren't switched on yet. Check back soon!" }, 503);
    const body = await request.json().catch(() => ({}));
    const site = String(body.site || "").toLowerCase();
    if (!/^[a-z0-9-]{1,63}$/.test(site)) return json({ error: "Publish your website first." }, 400);

    // Only the site's owner, on Pro or higher (not the free trial week).
    const ent = await entitlement(kv, request, user);
    if (!PAID.includes(ent.plan) || ent.planSource === "trial") return json({ error: "Custom domains come with Pro and higher plans.", upgrade: true }, 403);
    const page = await pageFor(request, kv, "site", site);
    if (!page || !page.rec || page.rec.created_by_id !== user.id) return json({ error: "You can only connect a domain to a website you published." }, 403);

    const current = await kv.get(`sitedomain:${site}`, "json");
    if (body.action === "get" || !body.action) {
      if (!current) return json({ domain: null, target: CNAME_TARGET });
      if (!current.id) return json(pending(current));
      const result = await cf(env, "GET", `/${current.id}`).catch(() => null);
      return json(describe(current.hostname, result));
    }

    // Step 2: prove the domain is theirs (a TXT record only its owner can add, like Base44's
    // domain check). Only then is it registered with Cloudflare and served.
    if (body.action === "verify") {
      if (!current) return json({ error: "Connect a domain first." }, 400);
      if (current.id) {
        const result = await cf(env, "GET", `/${current.id}`).catch(() => null);
        return json(describe(current.hostname, result));
      }
      if (!(await allow(`domainverify:${user.id}`, 30, 3600))) return json({ error: "Too many checks. Wait a few minutes and try again." }, 429);
      if (!(await hasTxt(txtName(current.hostname), txtValue(current.token)))) {
        return json({ ...pending(current), error: "We couldn't find the TXT record yet. Check it's added exactly as shown; new records can take a few minutes (sometimes up to an hour) to show up." });
      }
      let result;
      try {
        result = await cf(env, "POST", "", { hostname: current.hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } });
      } catch (e) {
        return json({ ...pending(current), error: /already exists/i.test(e.message) ? "That domain is already connected somewhere else." : `Couldn't connect that domain: ${e.message}` });
      }
      await kv.put(`domain:${current.hostname}`, JSON.stringify({ site, owner: user.id, id: result.id }));
      await kv.put(`sitedomain:${site}`, JSON.stringify({ ...current, id: result.id, verifiedAt: new Date().toISOString() }));
      return json(describe(current.hostname, result));
    }

    // Only real changes count toward the limit (refused tries don't), and admins have none.
    const tooMany = async () => user.role !== "admin" && !(await allow(`domainchange:${user.id}`, 10, 3600));

    if (body.action === "remove") {
      if (current) {
        if (await tooMany()) return json({ error: "Too many changes. Try again in an hour." }, 429);
        if (current.id) await cf(env, "DELETE", `/${current.id}`).catch(() => null);
        await kv.delete(`domain:${current.hostname}`);
        await kv.delete(`sitedomain:${site}`);
        const list = ((await kv.get("customdomains", "json")) || []).filter((h) => h !== current.hostname);
        await kv.put("customdomains", JSON.stringify(list));
      }
      return json({ ok: true, domain: null, target: CNAME_TARGET });
    }

    if (body.action === "add") {
      if (current) return json({ error: "This website already has a domain. Remove it first to use a different one." }, 400);
      const hostname = cleanHostname(body.hostname);
      if (!hostname) {
        const ours = /(^|\.)(nebuluxai\.com|blackhole-ai-tech\.com)\.?$/i.test(String(body.hostname || "").trim().replace(/^https?:\/\//, "").replace(/[/?#].*$/, ""));
        return json({ error: ours ? "That's a Nebulux address, so it can't be connected. Use a domain you bought yourself, like www.mybakery.com." : "Type a domain like www.mybakery.com (without https://)." }, 400);
      }
      if (await kv.get(`domain:${hostname}`)) return json({ error: "That domain is already connected to a website." }, 400);
      if (await tooMany()) return json({ error: "Too many changes. Try again in an hour." }, 429);
      // No limit: Cloudflare includes 100 domains, then about $0.10 each a month (the owner chose
      // no cap on 2026-09-27; every domain belongs to someone on Pro or higher).
      const list = (await kv.get("customdomains", "json")) || [];
      // Step 1: reserve it and hand out the TXT record that proves ownership. Nothing is
      // registered with Cloudflare or served until "verify" finds that record.
      const rec = { hostname, token: newToken(), at: new Date().toISOString() };
      await kv.put(`domain:${hostname}`, JSON.stringify({ site, owner: user.id, pending: true }));
      await kv.put(`sitedomain:${site}`, JSON.stringify(rec));
      await kv.put("customdomains", JSON.stringify([...list, hostname]));
      return json(pending(rec));
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
