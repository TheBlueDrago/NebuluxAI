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
const SHIM = `<script>(function(){
  // Phones lay the frame out after the game's code first runs, so a game that measures the screen
  // once at start (canvas.width = innerWidth) got 0x0 and stayed black. Tell it the size changed
  // once the page has loaded, again a moment later, and whenever the frame's size changes.
  // Health check for the black-screen problem: tell the app if the page crashed while starting or
  // still shows nothing (no visible text, and every canvas empty or one flat color) a few seconds
  // after loading. The app (components/PreviewFrame.jsx) then reloads it or offers a Reload button.
  var crashed="";
  addEventListener("error",function(e){if(!crashed)crashed=String((e&&e.message)||"error").slice(0,200)});
  addEventListener("unhandledrejection",function(e){if(!crashed)crashed=String((e&&e.reason&&e.reason.message)||"error").slice(0,200)});
  function flat(c){try{if(!c.width||!c.height)return true;var x=c.getContext("2d");if(!x)return false;var first=null;for(var i=1;i<8;i++)for(var j=1;j<8;j++){var p=x.getImageData(Math.floor(c.width*i/8),Math.floor(c.height*j/8),1,1).data;var k=p[0]+","+p[1]+","+p[2]+","+p[3];if(first===null)first=k;else if(k!==first)return false}return true}catch(_){return false}}
  function blank(){try{var b=document.body;if(!b)return true;var w=document.createTreeWalker(b,4),n;while((n=w.nextNode())){var p=n.parentNode&&n.parentNode.nodeName;if(p!=="SCRIPT"&&p!=="STYLE"&&p!=="NOSCRIPT"&&p!=="TEMPLATE"&&n.nodeValue.trim())return false}if(b.querySelector("img,video,svg,iframe"))return false;var cs=b.querySelectorAll("canvas");if(!cs.length)return b.getBoundingClientRect().height<5;for(var i=0;i<cs.length;i++)if(!flat(cs[i]))return false;return true}catch(_){return false}}
  addEventListener("load",function(){setTimeout(function(){var bad=blank();try{parent.postMessage({type:"nebulux-health",blank:bad,crashed:bad?crashed:""},"*")}catch(_){}},3500)});
  function kick(){try{dispatchEvent(new Event("resize"))}catch(_){}}
  addEventListener("load",function(){kick();setTimeout(kick,250);setTimeout(kick,1000);setTimeout(kick,2500)});
  try{var lastW=innerWidth,lastH=innerHeight;setInterval(function(){if(innerWidth!==lastW||innerHeight!==lastH){lastW=innerWidth;lastH=innerHeight;kick()}},500)}catch(_){}
  function mem(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
  ["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
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
  // The designer's section picker: click the site's own link to that section if it has one
  // (so view-switching sites show it), otherwise scroll to it.
  window.addEventListener("message",function(e){
    var d=e.data;if(e.source!==window.parent||!d||d.type!=="blackhole-goto")return;
    var id=String(d.id||"");if(!/^[A-Za-z][\\w-]*$/.test(id)){window.scrollTo({top:0,behavior:"smooth"});return}
    var link=document.querySelector('a[href="#'+id+'"]')||document.querySelector("[onclick*=\\"'"+id+"'\\"]");
    if(link){link.click();return}
    var t=document.getElementById(id);if(t)t.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();<\/script>`;

export const PREVIEW_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox";

// Inserts the shim as early as possible (right after <head>, else after the
// doctype) without putting anything before <!DOCTYPE>, which would trigger quirks mode.
export function withPreviewShim(html) {
  if (!html) return html;
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.slice(0, head.index + head[0].length) + SHIM + html.slice(head.index + head[0].length);
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return doctype[0] + SHIM + html.slice(doctype[0].length);
  return SHIM + html;
}
