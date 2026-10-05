// The Nebulux Browser in Nebulux Code: web search and reading a page as text, for signed-in people.
//   { action: "search", q }  -> { results: [{ title, url, snippet }] }   (DuckDuckGo's plain HTML page)
//   { action: "open", url }  -> { url, title, text }                       (the page's readable text)
// Only public http(s) addresses are opened: never this server's own network, local addresses or
// raw IP numbers, so nobody can use it to reach things that aren't on the open web.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

const MAX_TEXT = 20000;
const PER_MINUTE = 20;
const hits = new Map(); // user id -> recent request times (per server copy; a light brake on abuse)

const decode = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function publicUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return null;
  if (u.port && !["80", "443"].includes(u.port)) return null;
  return u;
}

export function parseResults(html) {
  const out = [];
  const parts = String(html).split('class="result__a"').slice(1);
  for (const part of parts) {
    if (out.length >= 8) break;
    const href = (part.match(/href="([^"]+)"/) || [])[1];
    const title = (part.match(/>([\s\S]*?)<\/a>/) || [])[1];
    const snip = (part.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || [])[1];
    if (!href) continue;
    let url = href.replace(/&amp;/g, "&");
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    if (url.startsWith("//")) url = "https:" + url;
    if (!publicUrl(url) || /duckduckgo\.com\/y\.js/.test(url)) continue;
    out.push({ title: decode(title).slice(0, 200), url, snippet: decode(snip).slice(0, 400) });
  }
  return out;
}

export function pageText(html) {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body.replace(/\n/g, " ¶ ")).replace(/( ?¶ ?)+/g, "\n").trim();
  return { title, text: text.slice(0, MAX_TEXT) };
}

// The page as the Nebulux Browser shows it: the site's own look, with every script, event handler
// and embedded frame removed, so a page can't run code. The browser adds its own small link handler
// instead (src/components/code/NebuluxBrowser.jsx). Every address in the page (links, pictures,
// stylesheets, CSS url()s) is made absolute here: the app's security policy also covers the frame
// the page is shown in, and it ignores a <base> tag pointing at another site.
const abs = (v, base) => {
  const s = String(v || "").trim();
  if (!s || /^(#|data:|mailto:|tel:|about:|blob:)/i.test(s)) return s;
  try {
    return new URL(s.replace(/&amp;/g, "&"), base).href;
  } catch {
    return s;
  }
};
const absCss = (css, base) => String(css).replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, u) => `url("${abs(u, base)}")`).replace(/@import\s+(["'])([^"']+)\1/gi, (m, q, u) => `@import "${abs(u, base)}"`);
export function absolutize(h, base) {
  return h
    .replace(/\b(href|src|action|poster|formaction|data-src)\s*=\s*"([^"]*)"/gi, (m, a, v) => `${a}="${abs(v, base).replace(/"/g, "%22")}"`)
    .replace(/\b(href|src|action|poster|formaction|data-src)\s*=\s*'([^']*)'/gi, (m, a, v) => `${a}='${abs(v, base).replace(/'/g, "%27")}'`)
    .replace(/\b(href|src|action|poster)\s*=\s*([^\s"'>]+)/gi, (m, a, v) => `${a}="${abs(v, base).replace(/"/g, "%22")}"`)
    .replace(/\b(srcset|data-srcset)\s*=\s*"([^"]*)"/gi, (m, a, v) => `${a}="${v.split(",").map((p) => { const [u, ...rest] = p.trim().split(/\s+/); return [abs(u, base), ...rest].join(" "); }).join(", ")}"`)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, b) => a + absCss(css, base) + b)
    .replace(/\bstyle\s*=\s*"([^"]*)"/gi, (m, css) => `style="${absCss(css, base).replace(/"/g, "'")}"`);
}

export function viewHtml(raw, url) {
  const safeUrl = String(url).replace(/"/g, "%22");
  let h = String(raw || "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(iframe|frame|frameset|object|embed|applet|portal)\b[\s\S]*?(<\/\1\s*>|\/?>)/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?(refresh|content-security-policy|set-cookie)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
  h = absolutize(h, url);
  const base = `<base href="${safeUrl}">`;
  h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + base) : base + h;
  return h.slice(0, 1500000);
}

export async function onRequestPost(context) {
  const { request } = context;
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please sign in." }, 401);
    const now = Date.now();
    const list = (hits.get(user.id) || []).filter((t) => now - t < 60000);
    if (list.length >= PER_MINUTE) return json({ error: "Too many searches at once. Wait a minute." }, 429);
    list.push(now);
    hits.set(user.id, list);

    const body = await request.json().catch(() => ({}));
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 NebuluxBrowser/1.0",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    };
    if (body.action === "search") {
      const q = String(body.q || "").trim().slice(0, 300);
      if (!q) return json({ results: [] });
      const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers });
      if (!res.ok) return json({ error: "Search isn't working right now." }, 502);
      return json({ results: parseResults(await res.text()) });
    }
    if (body.action === "open") {
      const u = publicUrl(body.url);
      if (!u) return json({ error: "That address can't be opened." }, 400);
      const res = await fetch(u.href, { headers, redirect: "follow" });
      const final = publicUrl(res.url) ? res.url : u.href;
      const type = res.headers.get("content-type") || "";
      if (!/text\/html|text\/plain|xhtml/.test(type)) return json({ url: final, title: "", text: `(This is a ${type.split(";")[0] || "file"}, not a web page.)` });
      const raw = (await res.text()).slice(0, 1500000);
      const { title, text } = /html/.test(type) ? pageText(raw) : { title: "", text: raw.slice(0, MAX_TEXT) };
      return json({ url: final, title, text, ...(body.view && /html/.test(type) ? { html: viewHtml(raw, final) } : {}) });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: "The page couldn't be opened." }, 502);
  }
}
