// The designer previews render AI-generated HTML in a srcDoc iframe sandboxed
// WITHOUT allow-same-origin (granting it would let the page read the app's auth
// token). That opaque origin breaks ordinary page code in ways that make the
// preview look dead:
// - localStorage / sessionStorage / document.cookie throw a SecurityError, which
//   usually aborts the page's script before any button handlers are attached.
// - A srcDoc document's base URL is the app's URL, so href="#about" (or any
//   relative link) navigates the frame to the app itself instead of scrolling.
// This script runs before the page's own scripts and papers over both, so
// buttons, section links, tabs, forms and saved state work like the real site.
const BASE_SHIM = `<script>(function(){
  // Phones lay the frame out after the game's code first runs, so a game that measures the screen
  // once at start (canvas.width = innerWidth) got 0x0 and stayed black. Tell it the size changed
  // once the page has loaded, again a moment later, and whenever the frame's size changes.
  // Health check for the black-screen problem: tell the app if the page crashed while starting or
  // still shows nothing (no visible text, and every canvas empty or one flat color) a few seconds
  // after loading. The app (components/PreviewFrame.jsx) then reloads it or offers a Reload button.
  var crashed="";
  addEventListener("error",function(e){if(!crashed)crashed=String((e&&e.message)||"error").slice(0,200)});
  addEventListener("unhandledrejection",function(e){if(!crashed)crashed=String((e&&e.reason&&e.reason.message)||"error").slice(0,200)});
  // The canvas is read by copying it into a separate small canvas: asking the game's own canvas for
  // a drawing context would lock a 3D (WebGL) game out of its own, so it never started (black).
  function flat(c){try{if(!c.width||!c.height)return true;var t=document.createElement("canvas");t.width=8;t.height=8;var x=t.getContext("2d");x.drawImage(c,0,0,8,8);var d=x.getImageData(0,0,8,8).data,first=null;for(var i=0;i<d.length;i+=4){var k=d[i]+","+d[i+1]+","+d[i+2]+","+d[i+3];if(first===null)first=k;else if(k!==first)return false}return true}catch(_){return false}}
  function tiny(c){return !c.width||!c.height||c.getBoundingClientRect().height<5}
  // Blank = nothing on screen at all: no text or pictures, and either no canvas with a size, or the
  // game crashed and its canvas is one flat color. A dark start screen waiting for a tap is left alone.
  function blank(){try{var b=document.body;if(!b)return true;var w=document.createTreeWalker(b,4),n;while((n=w.nextNode())){var p=n.parentNode&&n.parentNode.nodeName;if(p!=="SCRIPT"&&p!=="STYLE"&&p!=="NOSCRIPT"&&p!=="TEMPLATE"&&n.nodeValue.trim())return false}if(b.querySelector("img,video,svg,iframe"))return false;var cs=b.querySelectorAll("canvas");if(!cs.length)return b.getBoundingClientRect().height<5;for(var i=0;i<cs.length;i++){if(tiny(cs[i]))continue;if(!crashed||!flat(cs[i]))return false}return true}catch(_){return false}}
  addEventListener("load",function(){setTimeout(function(){var bad=blank();try{parent.postMessage({type:"nebulux-health",blank:bad,crashed:bad?crashed:""},"*")}catch(_){}},3500)});
  function kick(){try{dispatchEvent(new Event("resize"))}catch(_){}}
  // Only when a canvas really came out with no size: many games clear the canvas when told the
  // screen resized, which wiped a start screen that is drawn once (black until a tap).
  function kickIfNeeded(){try{var cs=document.querySelectorAll("canvas");for(var i=0;i<cs.length;i++)if(tiny(cs[i])){kick();return}}catch(_){}}
  addEventListener("load",function(){try{window.focus()}catch(_){}kickIfNeeded();setTimeout(kickIfNeeded,250);setTimeout(kickIfNeeded,1000);setTimeout(kickIfNeeded,2500)});
  try{var lastW=innerWidth,lastH=innerHeight;setInterval(function(){if(innerWidth!==lastW||innerHeight!==lastH){lastW=innerWidth;lastH=innerHeight;kick()}},500)}catch(_){}
  function mem(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
  ["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
  // Account saves (published games, see withPreviewShim's save option): the game's localStorage
  // starts with the player's saved progress, and every change is sent to the app to keep.
  if(window.__nxSave){try{var st=mem(),sv=window.__nxSave,tm=0;for(var sk in sv)st.setItem(sk,sv[sk]);
    var send=function(){clearTimeout(tm);tm=setTimeout(function(){var o={};for(var i=0;i<st.length;i++){var kk=st.key(i);o[kk]=st.getItem(kk)}try{parent.postMessage({type:"nebulux-save",data:o},"*")}catch(_){}},800)};
    var s0=st.setItem,r0=st.removeItem,c0=st.clear;st.setItem=function(a,b){s0(a,b);send()};st.removeItem=function(a){r0(a);send()};st.clear=function(){c0();send()};
    Object.defineProperty(window,"localStorage",{value:st,configurable:true})}catch(_){}}
  try{document.cookie}catch(e){var jar={};try{Object.defineProperty(document,"cookie",{configurable:true,get:function(){return Object.keys(jar).map(function(k){return k+"="+jar[k]}).join("; ")},set:function(v){var p=String(v).split(";")[0],i=p.indexOf("=");if(i>0)jar[p.slice(0,i).trim()]=p.slice(i+1).trim()}})}catch(_){}}
  function note(msg){try{var n=document.createElement("div");n.textContent=msg;n.style.cssText="position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;background:#0f172a;color:#fff;font:13px system-ui,sans-serif;padding:8px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.3)";document.body.appendChild(n);setTimeout(function(){n.remove()},2500)}catch(_){}}
  function scrollToHash(h){var id=decodeURIComponent(h.slice(1));if(!id){window.scrollTo({top:0,behavior:"smooth"});return}var t=document.getElementById(id)||document.getElementsByName(id)[0];if(t)t.scrollIntoView({behavior:"smooth",block:"start"})}
  // Registered on window (bubble phase) so the page's own click/submit handlers run first.
  window.addEventListener("click",function(e){
    if(e.defaultPrevented||e.button!==0)return;
    var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;
    var h=(a.getAttribute("href")||"").trim();
    if(/^javascript:/i.test(h))return;
    e.preventDefault();
    if(h.charAt(0)==="#"){scrollToHash(h);return}
    if(/^(https?:)?\\/\\//i.test(h)||/^(mailto|tel):/i.test(h)){window.open(h,"_blank","noopener");return}
    var i=h.indexOf("#");if(i>=0){scrollToHash(h.slice(i));return}
    if(h==="/"||h===""){window.scrollTo({top:0,behavior:"smooth"});return}
    note("Other pages open on your published site.");
  });
  window.addEventListener("submit",function(e){if(e.defaultPrevented)return;e.preventDefault();note("Form submitted (preview).")});
  // AI for visitors (NebuluxAI, added to published sites): a pretend reply here, nothing is charged.
  window.NebuluxAI={chat:function(input){var q=typeof input==="string"?input:((input&&input.length&&input[input.length-1].content)||"");return new Promise(function(res){setTimeout(function(){res("(Preview) This is where the AI answers \\""+String(q).slice(0,60)+"\\". On your published site, real answers come once you turn on AI for visitors in Dashboard → AI.")},600)})}};
  // "Sign in with Google" (NebuluxAuth, added to published sites): a pretend account here.
  (function(){var user=null,fns=[];function paint(){try{document.querySelectorAll("[data-nx-signed-in]").forEach(function(el){el.hidden=!user});document.querySelectorAll("[data-nx-signed-out]").forEach(function(el){el.hidden=!!user});document.querySelectorAll("[data-nx-user]").forEach(function(el){var f=el.getAttribute("data-nx-user");if(f==="picture"&&el.tagName==="IMG"){if(user)el.src=user.picture;else el.removeAttribute("src")}else el.textContent=user?(user[f]||""):""})}catch(_){}}
    function fire(){paint();fns.forEach(function(f){try{f(user)}catch(_){}});try{dispatchEvent(new CustomEvent("nebulux-auth",{detail:user}))}catch(_){}}
    window.NebuluxAuth={get user(){return user},token:null,signIn:function(){user={email:"you@example.com",name:"Preview Visitor",picture:"data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' rx='20' fill='#6366f1'/><text x='20' y='26' font-size='18' text-anchor='middle' fill='white' font-family='sans-serif'>P</text></svg>")};note("Preview: on your published site this opens Google sign-in.");fire()},signOut:function(){user=null;fire()},onChange:function(f){if(typeof f==="function"){fns.push(f);try{f(user)}catch(_){}}}};
    document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("[data-nx-signin],[data-nx-signout]");if(!t)return;e.preventDefault();if(t.hasAttribute("data-nx-signin"))NebuluxAuth.signIn();else NebuluxAuth.signOut()});
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",paint);else paint()})();
  // The designer's section picker: click the site's own link to that section if it has one
  // (so view-switching sites show it), otherwise scroll to it.
  window.addEventListener("message",function(e){
    var d=e.data;if(e.source!==window.parent||!d||(d.type!=="nebulux-goto"&&d.type!=="blackhole-goto"))return;
    var id=String(d.id||"");if(!/^[A-Za-z][\\w-]*$/.test(id)){window.scrollTo({top:0,behavior:"smooth"});return}
    var link=document.querySelector('a[href="#'+id+'"]')||document.querySelector("[onclick*=\\"'"+id+"'\\"]");
    if(link){link.click();return}
    var t=document.getElementById(id);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();<\/script>`;

export const PREVIEW_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock";

// Inserts the shim as early as possible (right after <head>, else after the
// doctype) without putting anything before <!DOCTYPE>, which would trigger quirks mode.
// With { save }: the page's localStorage starts as that object and changes are posted to the app
// as { type: "nebulux-save", data } (account saves for published games, see PreviewFrame).
export function withPreviewShim(html, opts) {
  if (!html) return html;
  // With { player }: games get the player's Nebulux AI username ("Anonymous" when signed out) as
  // window.nebulux.username, the same in every game.
  const who = opts && opts.player !== undefined ? `window.nebulux=Object.freeze({username:${JSON.stringify(String(opts.player || "Anonymous").slice(0, 24)).replace(/</g, "\\u003c")}});` : "";
  const saveJs = opts && opts.save ? `window.__nxSave=${JSON.stringify(opts.save).replace(/</g, "\\u003c")};` : "";
  const SHIM = who || saveJs ? `<script>${who}${saveJs}<\/script>` + BASE_SHIM : BASE_SHIM;
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.slice(0, head.index + head[0].length) + SHIM + html.slice(head.index + head[0].length);
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return doctype[0] + SHIM + html.slice(doctype[0].length);
  return SHIM + html;
}
