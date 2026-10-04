// Shared by the functions that hand out published pages (functions/published/[kind]/
// [name].js and the get-site-html function): the scripts added to every page, the
// "removed" page, and the response headers. No imports besides injected.js.
import { stripInjected } from "./injected.js";

const APP_ORIGIN = "https://nebuluxai.com";

// Buy buttons call parent.postMessage({ type: 'nebulux-checkout', ... }). Inside the
// Blackhole Browser the app answers that (useSiteCheckout), but on the site's own
// subdomain there is no parent, so the message comes back to the page itself. This
// bridge catches it there (top-level only) and sends the buyer to the app's /buy page,
// which starts the Base44 Payments checkout.
export function withCheckoutBridge(html, name) {
  const site = JSON.stringify(name).replace(/</g, "\\u003c");
  return beforeBodyEnd(html,
    `<script data-bh>(function(){if(window.top!==window)return;window.addEventListener("message",function(e){var d=e.data;` +
    `if(e.source!==window||!d||(d.type!=="nebulux-checkout"&&d.type!=="blackhole-checkout"))return;` +
    `location.href="${APP_ORIGIN}/buy?"+new URLSearchParams({site:${site},product:String(d.productId||""),qty:String(d.quantity||1)});});})();</script>`);
}

// A small white "Made with Nebulux AI" badge in the corner (like Base44's), and for games a
// "Report" link so visitors can flag abuse (it opens the app's /report page). Websites have no
// Report link and show the badge only when the owner turns it on in the dashboard (showBadge
// on the PublishedSite record). Only when the page is shown on its own. Put in a closed
// shadow root on its own tag, so the page's CSS can't restyle or hide it.
export function withReportLink(html, kind, name, { badge = true, report = true } = {}) {
  if (!badge && !report) return html;
  const href = JSON.stringify(`${APP_ORIGIN}/report?${new URLSearchParams({ kind, name })}`).replace(/</g, "\\u003c");
  const badgeHref = JSON.stringify(`${APP_ORIGIN}/?${new URLSearchParams({ from: `${kind}:${name}` })}`).replace(/</g, "\\u003c");
  const links =
    (badge ? `<a data-k="b" target="_blank" rel="noopener"><img alt="" src="${APP_ORIGIN}/logo-small.jpg">Made with Nebulux AI</a>` : "") +
    (report ? `<a data-k="r" target="_blank" rel="noopener">⚑ Report</a>` : "");
  return beforeBodyEnd(html,
    `<script data-bh>(function(){if(window.top!==window)return;function add(){var h=document.createElement("bh-report");` +
    `h.style.cssText="all:initial;position:fixed;right:12px;bottom:12px;z-index:2147483647";var r=h.attachShadow({mode:"closed"});` +
    `r.innerHTML=${JSON.stringify(links).replace(/</g, "\\u003c")};` +
    `var st="display:inline-flex;align-items:center;gap:7px;font:600 13px system-ui,-apple-system,sans-serif;color:#111827;background:#fff;` +
    `padding:6px 12px 6px 6px;border-radius:10px;text-decoration:none;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 10px rgba(0,0,0,.15);margin-left:8px";` +
    `r.querySelectorAll("a").forEach(function(a){a.style.cssText=st});var im=r.querySelector("img");` +
    `if(im)im.style.cssText="width:20px;height:20px;border-radius:5px;object-fit:cover";` +
    `var b=r.querySelector('[data-k="b"]'),rp=r.querySelector('[data-k="r"]');` +
    // Says whose page this is, so nobody mistakes a user's page for an official one.
    `if(b){b.href=${badgeHref};b.title="Made by someone using Nebulux AI, not by Nebulux AI itself"}` +
    `if(rp){rp.href=${href};rp.style.padding="6px 12px";rp.title="Report this page to Nebulux AI"}` +
    `document.documentElement.appendChild(h);}` +
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add);else add();})();</script>`);
}

// Forms on the page send what visitors type to the site owner's Messages (cloudflare-lib/
// inbox.js), alongside whatever the page itself does on submit. Password, card-looking,
// hidden and file fields are never sent (and the server drops them too).
export function withFormInbox(html, name) {
  const site = JSON.stringify(name).replace(/</g, "\\u003c");
  const url = JSON.stringify(`${APP_ORIGIN}/api/apps/6a8b5eb7787b8a4d6a18f662/functions/site-form`);
  return beforeBodyEnd(html,
    `<script data-bh>(function(){var S=/pass|pwd|card|cvv|cvc|ssn|security.?code|seed|recovery|private.?key|\\bpin\\b/i;` +
    `document.addEventListener("submit",function(e){var f=e.target;if(!f||f.tagName!=="FORM")return;try{var out=[],hp="",els=f.querySelectorAll("input,select,textarea");` +
    `for(var i=0;i<els.length;i++){var el=els[i],t=(el.type||"").toLowerCase();if(el.name==="_hp"){hp=el.value;continue}` +
    `if(/^(password|file|submit|button|reset|hidden|image)$/.test(t))continue;if((t==="checkbox"||t==="radio")&&!el.checked)continue;` +
    `var lb=el.id&&f.querySelector('label[for="'+el.id.replace(/"/g,"")+'"]');var label=(lb&&lb.textContent)||el.getAttribute("aria-label")||el.name||el.placeholder||el.id||("Field "+(i+1));` +
    `if(S.test(label)||S.test(el.name||"")||/^cc-/.test(el.autocomplete||""))continue;var v=String(el.value||"").trim();if(v)out.push([String(label).trim(),v]);}` +
    `if(out.length)fetch(${url},{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:JSON.stringify({action:"send",site:${site},fields:out,hp:hp})}).catch(function(){});` +
    `}catch(_){}},true);})();</script>`);
}

function beforeBodyEnd(html, snippet) {
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + snippet + html.slice(i) : html + snippet;
}

export function removedPage(kind, why = "It was taken down for breaking the Nebulux AI rules.") {
  const what = kind === "game" ? "game" : "site";
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Removed</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;` +
    `flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;text-align:center}a{color:#818cf8}</style>` +
    `</head><body><h1>This ${what} has been removed</h1><p>${why}</p>` +
    `<p><a href="${APP_ORIGIN}">Go to Nebulux AI</a></p></body></html>`
  );
}

// This path is on the app's own origin (nebuluxai.com / nebuluxai.pages.dev),
// where the signed-in user's token lives in localStorage. A published page opened
// here directly must not run as that origin, or its scripts could read the token.
// The CSP sandbox gives it an opaque origin instead (scripts, forms and popups still
// work). Real visitors see sites on their own subdomain, which the router Worker
// serves with its own headers, so this doesn't affect them.
export const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock",
  "x-content-type-options": "nosniff",
};

// Title/text come from the page's HTML, so entities like &amp; are already escaped.
const esc = (t) => String(t).replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Link previews (chat apps, social sites) for pages that don't set their own: the
// page's <title> and first paragraph-ish text, credited to Nebulux AI.
export function withShareTags(html) {
  if (/<meta[^>]+property\s*=\s*["']?og:title/i.test(html)) return html;
  const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  if (!title) return html;
  const text = ((html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
  const tags =
    `<meta data-bh property="og:type" content="website"><meta data-bh property="og:title" content="${esc(title)}">` +
    (text ? `<meta data-bh property="og:description" content="${esc(text)}">` : "") +
    `<meta data-bh property="og:site_name" content="Made with Nebulux AI"><meta data-bh name="twitter:card" content="summary">`;
  const i = html.search(/<\/head>/i);
  return i >= 0 ? html.slice(0, i) + tags + html.slice(i) : html;
}

// The app's old name in pages made before the rename: "Blackhole AI" (any capitals, with or
// without the space) becomes "Nebulux AI", and the old address becomes nebuluxai.com. Only the
// brand: "black hole" the space object, and code names like blackhole-checkout, stay as they are.
export function rebrand(html) {
  return String(html || "")
    .replace(/(^|[^\w-])([\w-]+\.)?blackhole-ai-tech\.com/gi, (m, pre, sub) => pre + (sub || "") + "nebuluxai.com")
    .replace(/\bBLACKHOLE ?AI\b/g, "NEBULUX AI")
    .replace(/\bblack ?hole ?ai\b/gi, "Nebulux AI");
}

// The page as visitors get it: old copies of the added scripts removed, fresh ones added.
// opts.badge: show the "Made with Nebulux AI" badge on a website (off unless the owner turned it on).
export function preparePage(html, kind, name, opts = {}) {
  let out = withShareTags(stripInjected(rebrand(html)));
  if (kind === "site") out = withFormInbox(withCheckoutBridge(out, name), name);
  if (kind === "site") return withReportLink(out, kind, name, { badge: opts.badge === true, report: false });
  return withReportLink(out, kind, name);
}
