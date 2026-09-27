// Link previews for the public pages. They're all the same app page (index.html), so chat
// apps and search engines would show the home page's title and text for every link; these
// small functions (functions/<page>.js) serve it with the page's own title, description and
// address instead. Game pages do the same with the game's name (playmeta.js).
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ORIGIN = "https://nebuluxai.com";

// Replacements are functions, never strings: in a replacement string "$1" or "$&" means a
// matched part, so a description with "$1" in it came out garbled.
export function withMeta(html, { title, description, path }) {
  const full = `${title} · Nebulux AI`;
  const setMeta = (out, attr, key, value) =>
    out.replace(new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, "i"), (_, a, b) => a + esc(value) + b);
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${esc(full)}</title>`);
  out = setMeta(out, "property", "og:title", full);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "name", "description", description);
  if (path) {
    out = setMeta(out, "property", "og:url", ORIGIN + path);
    // Tells search engines this page's one true address (not the home page, not ?query copies).
    const canonical = `<link rel="canonical" href="${esc(ORIGIN + path)}" />\n</head>`;
    out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/i, "").replace(/<\/head>/i, () => canonical);
  }
  return out;
}

// Extra tags for <head> (structured data) and text shown inside #root until the app starts,
// so search engines that don't run scripts still read the page. React replaces it on start.
export function withContent(html, { head = "", body = "" }) {
  let out = head ? html.replace(/<\/head>/i, () => `${head}\n</head>`) : html;
  if (body) out = out.replace(/<div id="root"><\/div>/i, () => `<div id="root">${body}</div>`);
  return out;
}

// The app's security headers (keep in step with public/_headers). Pages built by a function
// from the app page set them themselves, so they're protected the same way as the static app.
export const APP_HEADERS = {
  "x-frame-options": "SAMEORIGIN",
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(self), usb=(), payment=()",
};
export function withAppHeaders(from) {
  const headers = new Headers(from);
  headers.delete("content-length");
  for (const [k, v] of Object.entries(APP_HEADERS)) headers.set(k, v);
  return headers;
}

// A Pages Function handler that serves the app page with this page's preview details.
export const servePage = (meta) =>
  async function onRequestGet({ request, env }) {
    const page = await env.ASSETS.fetch(new URL("/", request.url));
    if (!page.ok) return page;
    return new Response(withMeta(await page.text(), meta), { status: 200, headers: withAppHeaders(page.headers) });
  };

export const PAGES = {
  arcade: { title: "Free games made with AI", description: "Play free games in your browser on any phone or computer. No download, no account. Every one was made by describing it to Nebulux AI.", path: "/arcade" },
  templates: { title: "Free website templates", description: "Pick a free template and change anything by telling the AI what you want. Publish it free at yourname.nebuluxai.com.", path: "/templates" },
  pricing: { title: "Pricing", description: "Free to start. Pro is $15 a month, Team is $20 a month for up to 3 people, credit packs start at $0.99, and Enterprise is priced per seat.", path: "/pricing" },
  business: { title: "Websites for your business", description: "Describe your business and get a website in minutes. Sell from your site, work as a team and keep your code.", path: "/business" },
  enterprise: { title: "Enterprise", description: "Nebulux AI for your whole organization: a seat for everyone and one shared pool of credits. For registered businesses.", path: "/enterprise" },
  about: { title: "About us", description: "We help people make websites and games just by describing them, on any phone or computer.", path: "/about" },
  contact: { title: "Contact us", description: "Questions, ideas, business or partnerships: email us, call us or send a message.", path: "/contact" },
  safety: { title: "Trust & safety", description: "How Nebulux AI keeps your account, your payments and the sites you publish safe, in plain words.", path: "/safety" },
  ideas: { title: "Things to ask AI", description: "38 ideas for what to ask an AI: homework help, writing, coding, everyday life, fun and business. Tap one to try it free.", path: "/ideas" },
  "whats-new": { title: "What's new", description: "New features and fixes in Nebulux AI, the AI helper that answers questions, helps you write and code, and builds websites and games.", path: "/whats-new" },
  guides: { title: "Guides", description: "Short, step-by-step guides to getting the most out of AI: homework help, writing, learning to code, websites and games.", path: "/guides" },
  terms: { title: "Terms of Service", description: "The rules for using Nebulux AI: accounts, what you can make and publish, plans and payments, and safety.", path: "/terms" },
  privacy: { title: "Privacy Policy", description: "What Nebulux AI collects, why, who helps us run it, and how to download or delete your data.", path: "/privacy" },
  report: { title: "Report a page", description: "Tell us about a website or game made with Nebulux AI that looks unsafe, a scam, or breaks the rules. We review every report.", path: "/report" },
  showcase: { title: "Gallery", description: "Real websites people made with Nebulux AI by describing them in a sentence.", path: "/showcase" },
};
