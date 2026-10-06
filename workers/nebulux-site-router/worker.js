// nebulux-site-router — the Cloudflare Worker that serves every published site on
// its own subdomain (nova.nebuluxai.com). Bound to the route
// *.nebuluxai.com/* (wildcard DNS). This is a copy of the code deployed in the
// Cloudflare dashboard (Workers & Pages → blackhole-site-router), kept here so it's
// versioned and can be restored. Deploy changes with `npx wrangler deploy` from this
// folder (see wrangler.toml), or paste into the dashboard editor.
//
// It asks the app's get-site-html function for the page. That path on
// nebuluxai.pages.dev is the Cloudflare Pages function
// functions/api/apps/<appId>/functions/get-site-html.js (not Base44's), which applies
// admin take-downs and the phishing-form check to every site and adds the Buy Now
// checkout bridge, the Report link and link-preview tags. So this Worker doesn't need
// changing when those rules change. It adds PAGE_HEADERS below to every page it sends.

const APP_ID = "6a8b5eb7787b8a4d6a18f662";
// Sites and games answer at name.nebuluxai.com. (The old blackhole-ai-tech.com is no longer
// served: it was freed on 2026-10-01 for the owner to reuse.)
const ROOTS = ["nebuluxai.com"];
const ROOT = ROOTS[0];
// The pages.dev address of the same app: no bot checks in the way of this server-to-server call.
const API_BASE = "https://nebuluxai.pages.dev/api/apps/" + APP_ID + "/functions/";

// Sent with every page this Worker serves. Sites here are made by users (often young ones):
// they may not use the camera, microphone, USB devices or the browser's payment sheet (buying
// goes through the platform's checkout), browsers must not guess file types, and other
// websites aren't told which page someone came from.
const PAGE_HEADERS = {
  "Content-Type": "text/html;charset=UTF-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), microphone=(), usb=(), payment=()",
  // No plugins (old Flash-style embeds), and no <base> tag sending every link somewhere else.
  "Content-Security-Policy": "object-src 'none'; base-uri 'self'",
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// Published games at their own address get the same start-up help as games inside the app
// (src/lib/previewShim.js): a "the screen size changed" nudge once loaded (phones lay the page
// out late, so a game that measured the screen at start stayed 0x0 and black), and if the page
// still shows nothing a few seconds later, one automatic reload.
// Same rules as the preview: only nudge when a canvas has no size (games that clear the canvas on
// resize lost their start screen), and never ask the game's canvas for a drawing context (that
// locked 3D games out of theirs).
var GAME_KICK = "<script>(function(){var crashed=false;addEventListener('error',function(){crashed=true});function k(){try{dispatchEvent(new Event('resize'))}catch(_){}}" +
  "function tiny(c){return !c.width||!c.height||c.getBoundingClientRect().height<5}" +
  "function kn(){try{var cs=document.querySelectorAll('canvas');for(var i=0;i<cs.length;i++)if(tiny(cs[i])){k();return}}catch(_){}}" +
  "function flat(c){try{var t=document.createElement('canvas');t.width=8;t.height=8;var x=t.getContext('2d');x.drawImage(c,0,0,8,8);var d=x.getImageData(0,0,8,8).data,f=null;for(var i=0;i<d.length;i+=4){var s=d[i]+','+d[i+1]+','+d[i+2]+','+d[i+3];if(f===null)f=s;else if(s!==f)return false}return true}catch(_){return false}}" +
  "function blank(){try{var b=document.body;if(!b)return true;var w=document.createTreeWalker(b,4),n;while((n=w.nextNode())){var p=n.parentNode&&n.parentNode.nodeName;if(p!=='SCRIPT'&&p!=='STYLE'&&p!=='NOSCRIPT'&&p!=='TEMPLATE'&&n.nodeValue.trim())return false}if(b.querySelector('img,video,svg,iframe'))return false;var cs=b.querySelectorAll('canvas');if(!cs.length)return b.getBoundingClientRect().height<5;for(var i=0;i<cs.length;i++){if(tiny(cs[i]))continue;if(!crashed||!flat(cs[i]))return false}return true}catch(_){return false}}" +
  "addEventListener('load',function(){kn();setTimeout(kn,250);setTimeout(kn,1000);setTimeout(function(){try{if(blank()&&!sessionStorage.getItem('nx-reloaded')){sessionStorage.setItem('nx-reloaded','1');location.reload()}}catch(_){}},4000)})})();</script>";

function withGameKick(html) {
  var head = html.match(/<head[^>]*>/i);
  if (head) return html.slice(0, head.index + head[0].length) + GAME_KICK + html.slice(head.index + head[0].length);
  return GAME_KICK + html;
}

// Asks the app for a site or game, once more after a moment if it had a hiccup (5xx or no
// answer), so a brief problem doesn't show "Site not found" for a site that exists.
async function lookup(kind, name) {
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var res = await fetch(API_BASE + kind, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name }),
      });
      if (res.status < 500) return res;
    } catch (err) {
      // Try again below.
    }
    await new Promise(function (r) { setTimeout(r, 400); });
  }
  return null;
}

// Someone's own domain (Pro and up, set up in the Website Designer: functions/.../custom-domain.js)
// pointing at us through Cloudflare for SaaS: serve the website it's connected to.
var DOMAINS = null; // the site's KV (set on each request)
async function customDomain(host) {
  if (!DOMAINS) return new Response("Not found", { status: 404 });
  var link = null;
  try {
    link = await DOMAINS.get("domain:" + host, "json");
  } catch (err) {
    link = null;
  }
  // Not served until its owner proved it's theirs (the TXT check in custom-domain.js).
  if (!link || !link.site || link.pending) return new Response("Not found", { status: 404 });
  var res = await lookup("get-site-html", link.site);
  if (!res || !res.ok) return new Response(notFoundPage(link.site), { status: res ? 404 : 502, headers: PAGE_HEADERS });
  var data = await res.json().catch(function () { return null; });
  if (!data || !data.html) return new Response(notFoundPage(link.site), { status: 404, headers: PAGE_HEADERS });
  return new Response(data.html, { status: 200, headers: PAGE_HEADERS });
}

function notFoundPage(rawName) {
  var name = escapeHtml(rawName);
  return (
    "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Site not found</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0}a{color:#818cf8}</style></head><body><h1>Site not found</h1><p>No published site named \"" +
    name +
    "\".</p><p><a href='https://" +
    ROOT +
    "'>Back to Nebulux AI</a></p></body></html>"
  );
}

// Maintenance: the whole site (app, installed app, old address, published sites, custom domains)
// shows "temporarily down" to everyone except the owner. The owner opens /__owner/<OWNER_KEY>
// once (OWNER_KEY is a secret on this Worker); that sets a cookie for their browser. Set
// MAINTENANCE to "off" in wrangler.toml and redeploy to open the site again.
// On while env.MAINTENANCE is "on" (wrangler.toml [vars]).
var DOWN_PAGE =
  "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex'><title>Nebulux AI</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:22px;font-weight:600;max-width:420px;line-height:1.4}</style></head><body><h1>Sorry, this website is temporarily down. Come back later.</h1></body></html>";

function cookieOf(request, name) {
  var m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : "";
}

// Every value of a cookie: a browser can hold two with the same name (one for nebuluxai.com and
// every site address, one for just this address).
function cookiesOf(request, name) {
  var out = [];
  var re = new RegExp("(?:^|;\\s*)" + name + "=([^;]*)", "g");
  var h = request.headers.get("cookie") || "";
  var m;
  while ((m = re.exec(h))) if (m[1]) out.push(m[1]);
  return out;
}
async function hasPass(request, key) {
  var all = cookiesOf(request, "nx_owner");
  for (var i = 0; i < all.length; i++) if (key && (await sameText(all[i], key))) return true;
  return false;
}

async function sameText(a, b) {
  var enc = new TextEncoder();
  var ha = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(a))));
  var hb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(b))));
  var diff = 0;
  for (var i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

// Old owner links (OLD_OWNER_KEYS, comma-separated secret) were shared by mistake: anyone with a
// pass from one, or who opens one, is shut out of the whole site for 90 days, by browser (a
// cookie) and by internet address (KV "ownerblock:<ip>", expires by itself). The real owner's
// current pass always gets in.
var BLOCK_SECONDS = 90 * 24 * 3600;
var BLOCKED_PAGE =
  "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex'><title>Nebulux AI</title><style>body{background:#05060f;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{font-size:22px;font-weight:600;max-width:420px;line-height:1.4}</style></head><body><h1>Access to this website has been removed.</h1></body></html>";

async function ownerBlock(request, env, url) {
  var key = (env && env.OWNER_KEY) || "";
  if (await hasPass(request, key)) return null;
  var passes = cookiesOf(request, "nx_owner");
  if (key && url.pathname.indexOf("/__owner/") === 0 && (await sameText(url.pathname.slice(9), key))) return null;
  var old = String((env && env.OLD_OWNER_KEYS) || "").split(",").map(function (s) {
    return s.trim();
  }).filter(Boolean);
  var usedOld = false;
  for (var i = 0; i < old.length; i++) {
    var hit = false;
    for (var j = 0; j < passes.length; j++) if (await sameText(passes[j], old[i])) hit = true;
    if (hit || (url.pathname.indexOf("/__owner/") === 0 && (await sameText(url.pathname.slice(9), old[i])))) usedOld = true;
  }
  var ip = request.headers.get("cf-connecting-ip") || "";
  var kv = env && env.KV;
  var blocked = usedOld || cookieOf(request, "nx_blocked") === "1";
  if (!blocked && kv && ip) {
    try {
      blocked = !!(await kv.get("ownerblock:" + ip));
    } catch (e) {
      blocked = false;
    }
  }
  if (!blocked) return null;
  if (usedOld && kv && ip) {
    try {
      await kv.put("ownerblock:" + ip, new Date().toISOString(), { expirationTtl: BLOCK_SECONDS });
    } catch (e) {}
  }
  var dom = url.hostname === "nebuluxai.com" || url.hostname.endsWith(".nebuluxai.com") ? "; Domain=nebuluxai.com" : "";
  var h = new Headers({ "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "x-robots-tag": "noindex" });
  h.append("set-cookie", "nx_blocked=1; Path=/; Max-Age=" + BLOCK_SECONDS + "; Secure; HttpOnly; SameSite=Lax" + dom);
  h.append("set-cookie", "nx_owner=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax" + dom);
  return new Response(BLOCKED_PAGE, { status: 403, headers: h });
}

// The owner link only works from the owner's home network (OWNER_NETS secret, comma-separated:
// an exact address, or a prefix ending in ":" or "." such as the home IPv6 "2600:1700:150:960:").
// Anywhere else it shows the ordinary "temporarily down" page. Not set = works anywhere.
function ownerNet(request, env) {
  var nets = String((env && env.OWNER_NETS) || "").split(",").map(function (s) {
    return s.trim().toLowerCase();
  }).filter(Boolean);
  if (!nets.length) return true;
  var ip = String(request.headers.get("cf-connecting-ip") || "").toLowerCase();
  return nets.some(function (n) {
    return /[:.]$/.test(n) ? ip.indexOf(n) === 0 : ip === n;
  });
}

// -> a Response to send instead (down page, or the owner's unlock), or null to carry on.
async function maintenance(request, env, url) {
  if (!env || env.MAINTENANCE !== "on") return null;
  var key = (env && env.OWNER_KEY) || "";
  var path = url.pathname;
  if (key && path.indexOf("/__owner/") === 0) {
    // Extra owner links (OWNER_LINKS secret, comma-separated) work exactly like the main one.
    var links = [key].concat(String(env.OWNER_LINKS || "").split(",").map(function (s) {
      return s.trim();
    }).filter(Boolean));
    var isOwnerLink = false;
    for (var n = 0; n < links.length; n++) if (await sameText(path.slice(9), links[n])) isOwnerLink = true;
    if (isOwnerLink && ownerNet(request, env)) {
      // The real owner: lift any block on this browser and this internet address.
      var ip = request.headers.get("cf-connecting-ip") || "";
      if (ip && env.KV) {
        try {
          await env.KV.delete("ownerblock:" + ip);
        } catch (e) {}
      }
      var unblock = "nx_blocked=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax" + (url.hostname === "nebuluxai.com" || url.hostname.endsWith(".nebuluxai.com") ? "; Domain=nebuluxai.com" : "");
      var res = new Response(null, {
        status: 302,
        headers: {
          // The home page that explains Nebulux AI (owner, 2026-10-06); signing in there opens the AI.
          location: "/",
          // On nebuluxai.com the pass covers every site address too (nova.nebuluxai.com...).
          // A custom domain (like www.blackhole-ai-tech.com) gets its own pass from this same link there.
          "set-cookie": "nx_owner=" + key + "; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax" +
            (url.hostname === "nebuluxai.com" || url.hostname.endsWith(".nebuluxai.com") ? "; Domain=nebuluxai.com" : ""),
          "cache-control": "no-store",
        },
      });
      res.headers.append("set-cookie", unblock);
      // An old pass kept for just this address would otherwise sit next to the new one.
      if (url.hostname.endsWith("nebuluxai.com")) res.headers.append("set-cookie", "nx_owner=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
      return res;
    }
  }
  if (await hasPass(request, key)) return null;
  // Devices with the old installed app fetch this to remove it (public/sw.js).
  if (path === "/sw.js") return null;
  // The logo, for domain companies showing "Nebulux AI wants to connect your domain"
  // (domainconnect/nebuluxai.com.website.json logoUrl). Only on the main address.
  if (path === "/logo-small.jpg" && (url.hostname === "nebuluxai.com" || url.hostname === "www.nebuluxai.com")) return null;
  return new Response(DOWN_PAGE, { status: 503, headers: { "content-type": "text/html;charset=UTF-8", "cache-control": "no-store", "retry-after": "86400", "x-robots-tag": "noindex" } });
}

export default {
  async fetch(request, env) {
    DOMAINS = (env && env.KV) || null;
    var url = new URL(request.url);
    var host = url.hostname.toLowerCase();
    var root = ROOTS.find(function (r) {
      return host === r || host.endsWith("." + r);
    });
    // People's own domains stay up even while nebuluxai.com is down for maintenance; only
    // nebuluxai.com and name.nebuluxai.com go down (owner's request, 2026-10-04).
    if (!root) return customDomain(host);
    var shut = await ownerBlock(request, env, url);
    if (shut) return shut;
    var down = await maintenance(request, env, url);
    if (down) return down;
    if (host === root || host === "www." + root) {
      var res = await fetch(request);
      // A code file from an older version (gone after an update) comes back from Pages as the app
      // page, with a 4-hour browser cache: the browser then kept a web page as "code" and the app
      // was stuck on "just updated". Say "not found, don't keep this" instead, so a reload works.
      if (url.pathname.indexOf("/assets/") === 0 && /text\/html/i.test(res.headers.get("content-type") || "")) {
        return new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
      }
      // App pages must always be checked with the server, so they never point at gone code.
      if (/text\/html/i.test(res.headers.get("content-type") || "")) {
        var fresh = new Response(res.body, res);
        fresh.headers.set("cache-control", "no-cache");
        return fresh;
      }
      return res;
    }
    var name = host.slice(0, host.length - root.length - 1);
    if (name.indexOf(".") >= 0) return new Response("Not found", { status: 404 });
    var isGame = false;
    var apiRes = await lookup("get-site-html", name);
    if (!apiRes || !apiRes.ok) {
      // No website by that name: it may be a game (games share the same addresses).
      var gameRes = await lookup("get-game-html", name);
      if (gameRes && gameRes.ok) {
        apiRes = gameRes;
        isGame = true;
      } else if (!apiRes || !gameRes) {
        // One of the lookups couldn't reach the app: say so, rather than "not found".
        return new Response(notFoundPage(name), { status: 502, headers: PAGE_HEADERS });
      }
    }
    if (!apiRes.ok) {
      return new Response(notFoundPage(name), { status: 404, headers: PAGE_HEADERS });
    }
    var data = await apiRes.json().catch(function () { return null; });
    if (!data || !data.html) {
      return new Response(notFoundPage(name), { status: 404, headers: PAGE_HEADERS });
    }
    return new Response(isGame ? withGameKick(data.html) : data.html, { status: 200, headers: PAGE_HEADERS });
  },
};
