// Website Designer → Dashboard → Variables: values a published website can use without putting
// them in its code. Stored in KV "sitevars:<site>" as { vars: [{ name, type, value }] }.
//   text   — shown to visitors: {{NAME}} in the page becomes the value (and window.NebuluxVars.NAME).
//   secret — never sent to visitors' browsers. Only NebuluxFetch (functions/v1/site-fetch.js) puts
//            it into a request it makes for the site, e.g. an API key in a header.
export const VAR_NAME = /^[A-Z][A-Z0-9_]{0,39}$/;
export const MAX_VARS = 50;
export const varsKey = (site) => `sitevars:${site}`;

export async function readVars(kv, site) {
  const v = await kv.get(varsKey(site), "json").catch(() => null);
  return Array.isArray(v && v.vars) ? v.vars : [];
}

export const textVars = (vars) => Object.fromEntries(vars.filter((v) => v.type === "text").map((v) => [v.name, v.value]));
export const secretVars = (vars) => Object.fromEntries(vars.filter((v) => v.type === "secret").map((v) => [v.name, v.value]));

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The page as served: {{NAME}} filled in with text variables (HTML-escaped), plus a small script
// with them and the NebuluxFetch helper. Secrets are never added here.
export function withSiteVars(html, site, vars, appOrigin) {
  const text = textVars(vars);
  let out = String(html).replace(/\{\{\s*([A-Z][A-Z0-9_]{0,39})\s*\}\}/g, (m, n) => (n in text ? escHtml(text[n]) : m));
  const S = JSON.stringify(site).replace(/</g, "\\u003c");
  const T = JSON.stringify(text).replace(/</g, "\\u003c");
  const tag =
    `<script data-bh>(function(){window.NebuluxVars=${T};var S=${S},U=${JSON.stringify(appOrigin + "/v1/site-fetch")};` +
    `window.NebuluxFetch=function(url,opts){opts=opts||{};return fetch(U,{method:"POST",headers:{"Content-Type":"application/json"},` +
    `body:JSON.stringify({site:S,url:url,method:opts.method||"GET",headers:opts.headers||{},body:typeof opts.body==="string"?opts.body:opts.body==null?undefined:JSON.stringify(opts.body)})})` +
    `.then(function(r){return r.json().then(function(d){if(d.error)throw new Error(d.error);return{ok:d.status>=200&&d.status<300,status:d.status,text:function(){return Promise.resolve(d.body)},json:function(){return Promise.resolve(JSON.parse(d.body))}}})})}})();</script>`;
  const head = out.match(/<head[^>]*>/i);
  return head ? out.slice(0, head.index + head[0].length) + tag + out.slice(head.index + head[0].length) : tag + out;
}
