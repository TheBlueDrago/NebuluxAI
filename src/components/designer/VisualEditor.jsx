import React, { useEffect, useMemo, useRef, useState } from "react";
import { askConfirm } from "@/lib/dialogs";
import { Undo2, Redo2, Monitor, Tablet, Smartphone, Trash2, Copy, ArrowUp, ArrowDown, CornerLeftUp, X, Check, Type, AlignLeft, AlignCenter, AlignRight, Bold, Image as ImageIcon, Square, Columns3, LayoutGrid, MousePointerClick, Heading, Minus, MoveVertical, Mail, Quote, PanelBottom, Star } from "lucide-react";

// The Wix-style visual editor for the Website Designer (Pro and up): drag blocks from the left
// onto the page, click anything to select it, double-click text to type, drag things to move
// them, and style the selection on the right. The page's own scripts are parked as comments
// while editing (so nothing runs or fights the editor) and put back when it's saved.

const IMG = (a, b) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='1200' height='700' fill='url(#g)'/><circle cx='900' cy='220' r='90' fill='rgba(255,255,255,.35)'/><path d='M0 560 L330 300 L560 520 L760 380 L1200 640 L1200 700 L0 700Z' fill='rgba(255,255,255,.25)'/></svg>`);

const BLOCKS = [
  ["Heading", Heading, `<h2 style="font-size:40px;font-weight:800;margin:32px auto 12px;text-align:center;max-width:900px">Your big headline</h2>`],
  ["Text", Type, `<p style="font-size:18px;line-height:1.7;max-width:720px;margin:12px auto;text-align:center;opacity:.85">Double-click to write. Tell visitors what makes you special.</p>`],
  ["Button", MousePointerClick, `<div style="text-align:center;margin:20px 0"><a href="#" style="display:inline-block;padding:14px 28px;border-radius:12px;background:#4f46e5;color:#fff;font-weight:700;text-decoration:none">Get started</a></div>`],
  ["Image", ImageIcon, `<img src="${IMG("#818cf8", "#ec4899")}" alt="" style="display:block;width:100%;max-width:960px;margin:24px auto;border-radius:16px">`],
  ["Section", Square, `<section style="padding:72px 24px;background:#f5f3ff;text-align:center"><h2 style="font-size:36px;font-weight:800;margin:0 0 12px">A new section</h2><p style="font-size:18px;max-width:640px;margin:0 auto;opacity:.8">Add what you like here, then drag blocks into it.</p></section>`],
  ["Columns", Columns3, `<section style="padding:48px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;max-width:1080px;margin:0 auto">${["Fast", "Simple", "Friendly"].map((t) => `<div style="padding:28px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0"><h3 style="font-size:22px;font-weight:700;margin:0 0 8px">${t}</h3><p style="margin:0;opacity:.75;line-height:1.6">A short line about this.</p></div>`).join("")}</div></section>`],
  ["Gallery", LayoutGrid, `<section style="padding:48px 24px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;max-width:1080px;margin:0 auto">${[["#f97316", "#ec4899"], ["#06b6d4", "#6366f1"], ["#22c55e", "#0ea5e9"]].map(([a, b]) => `<img src="${IMG(a, b)}" alt="" style="width:100%;border-radius:14px;display:block">`).join("")}</div></section>`],
  ["Reviews", Star, `<section style="padding:56px 24px;background:#fafafa"><h2 style="text-align:center;font-size:32px;font-weight:800;margin:0 0 28px">What people say</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;max-width:1000px;margin:0 auto">${["Loved it, would come back!", "Super friendly and quick.", "Best in town, honestly."].map((q, i) => `<div style="padding:24px;border-radius:16px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.06)"><div style="color:#f59e0b;font-size:18px">★★★★★</div><p style="margin:10px 0 12px;line-height:1.6">“${q}”</p><strong>${["Sam", "Priya", "Leo"][i]}</strong></div>`).join("")}</div></section>`],
  ["Quote", Quote, `<blockquote style="max-width:760px;margin:40px auto;padding:8px 0 8px 24px;border-left:4px solid #4f46e5;font-size:24px;font-style:italic;line-height:1.5">“A great quote that sums up what you do.”</blockquote>`],
  ["Contact form", Mail, `<section style="padding:56px 24px"><form style="max-width:520px;margin:0 auto;display:grid;gap:12px"><h2 style="font-size:30px;font-weight:800;margin:0 0 6px;text-align:center">Get in touch</h2><input name="name" placeholder="Your name" style="padding:12px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:16px"><input name="email" type="email" placeholder="Email" style="padding:12px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:16px"><textarea name="message" rows="4" placeholder="Message" style="padding:12px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:16px"></textarea><button type="submit" style="padding:13px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-weight:700;font-size:16px">Send</button></form></section>`],
  ["Divider", Minus, `<hr style="border:0;border-top:1px solid #e2e8f0;max-width:1080px;margin:32px auto">`],
  ["Spacer", MoveVertical, `<div style="height:56px"></div>`],
  ["Footer", PanelBottom, `<footer style="padding:36px 24px;background:#0f172a;color:#cbd5e1;text-align:center;font-size:14px">© ${new Date().getFullYear()} Your name · Made with Nebulux AI</footer>`],
];

// Runs inside the page being edited (stringified into it). Talks to the editor by postMessage.
function editorRuntime() {
  var sel = null, dragEl = null, mark = null, hoverEl = null;
  var st = document.createElement("style");
  st.setAttribute("data-nx-editor", "");
  st.textContent =
    "[data-nx-hover]{outline:2px dashed rgba(99,102,241,.7)!important;outline-offset:2px;cursor:pointer}" +
    "[data-nx-sel]{outline:2px solid #6366f1!important;outline-offset:2px}" +
    "[contenteditable=true]{outline:2px solid #f59e0b!important;cursor:text}" +
    "#nx-drop{position:absolute;height:4px;background:#6366f1;border-radius:4px;box-shadow:0 0 0 3px rgba(99,102,241,.25);pointer-events:none;z-index:2147483647;display:none}" +
    "a{cursor:pointer}";
  document.head.appendChild(st);
  mark = document.createElement("div");
  mark.id = "nx-drop";
  mark.setAttribute("data-nx-editor", "");
  document.body.appendChild(mark);

  var post = function (m) { parent.postMessage(Object.assign({ nxEditor: 1 }, m), "*"); };
  var editable = function (el) { return el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && !el.hasAttribute("data-nx-editor") && !/^(SCRIPT|STYLE|HEAD|META|LINK|TITLE)$/.test(el.tagName); };
  var clean = function () {
    var d = document.documentElement.cloneNode(true);
    d.querySelectorAll("[data-nx-editor]").forEach(function (n) { n.remove(); });
    d.querySelectorAll("[data-nx-sel],[data-nx-hover],[contenteditable],[draggable]").forEach(function (n) { n.removeAttribute("data-nx-sel"); n.removeAttribute("data-nx-hover"); n.removeAttribute("contenteditable"); n.removeAttribute("draggable"); });
    return "<!DOCTYPE html>\n" + d.outerHTML;
  };
  var changed = function () { post({ type: "changed", html: clean() }); if (sel) info(); };
  var info = function () {
    if (!sel) return post({ type: "sel", info: null });
    var cs = getComputedStyle(sel);
    var leaf = sel.children.length === 0 || /^(H1|H2|H3|H4|H5|H6|P|A|BUTTON|SPAN|LI|STRONG|EM|BLOCKQUOTE|LABEL)$/.test(sel.tagName);
    post({ type: "sel", info: { tag: sel.tagName.toLowerCase(), text: leaf ? sel.innerText : null, color: cs.color, bg: cs.backgroundColor, fontSize: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight, 10) >= 600, align: cs.textAlign, padding: parseFloat(cs.paddingTop), radius: parseFloat(cs.borderTopLeftRadius), href: sel.tagName === "A" ? sel.getAttribute("href") : null, src: sel.tagName === "IMG" ? sel.getAttribute("src") : null, width: sel.style.width || "" } });
  };
  var select = function (el) {
    if (sel) { sel.removeAttribute("data-nx-sel"); sel.removeAttribute("draggable"); }
    sel = editable(el) ? el : null;
    if (sel) { sel.setAttribute("data-nx-sel", ""); sel.setAttribute("draggable", "true"); }
    info();
  };
  var stopEditing = function () {
    var ed = document.querySelector("[contenteditable=true]");
    if (ed) { ed.removeAttribute("contenteditable"); changed(); }
  };

  document.addEventListener("mouseover", function (e) { if (hoverEl) hoverEl.removeAttribute("data-nx-hover"); hoverEl = editable(e.target) ? e.target : null; if (hoverEl && hoverEl !== sel) hoverEl.setAttribute("data-nx-hover", ""); }, true);
  document.addEventListener("click", function (e) {
    if (e.target.isContentEditable) return;
    e.preventDefault(); e.stopPropagation();
    stopEditing(); select(e.target);
  }, true);
  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
  document.addEventListener("dblclick", function (e) {
    var el = e.target; if (!editable(el)) return;
    e.preventDefault(); select(el);
    el.setAttribute("contenteditable", "true"); el.focus();
  }, true);
  document.addEventListener("focusout", function (e) { if (e.target.getAttribute && e.target.getAttribute("contenteditable") === "true") stopEditing(); }, true);
  document.addEventListener("keydown", function (e) {
    if (e.target.isContentEditable) { if (e.key === "Escape") { e.target.blur(); } return; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); var n = sel; select(null); n.remove(); changed(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "y")) { e.preventDefault(); post({ type: e.key === "z" && !e.shiftKey ? "undo" : "redo" }); }
  }, true);

  // where a drop would land: before or after the element under the pointer
  var spot = function (e) {
    var t = e.target; while (t && !editable(t)) t = t.parentElement;
    if (!t || t === dragEl || (dragEl && dragEl.contains(t))) return null;
    var r = t.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    return { el: t, after: after, top: (after ? r.bottom : r.top) + scrollY, left: r.left + scrollX, width: r.width };
  };
  document.addEventListener("dragstart", function (e) { if (e.target === sel) { dragEl = sel; e.dataTransfer.setData("text/plain", "NXMOVE"); e.dataTransfer.effectAllowed = "move"; } }, true);
  document.addEventListener("dragover", function (e) {
    e.preventDefault();
    var s = spot(e); if (!s) { mark.style.display = "none"; return; }
    mark.style.display = "block"; mark.style.top = s.top - 2 + "px"; mark.style.left = s.left + "px"; mark.style.width = s.width + "px";
  }, true);
  document.addEventListener("dragleave", function (e) { if (!e.relatedTarget) mark.style.display = "none"; }, true);
  document.addEventListener("drop", function (e) {
    e.preventDefault(); mark.style.display = "none";
    var data = e.dataTransfer.getData("text/plain") || "", s = spot(e), node = null;
    if (data.indexOf("NXBLOCK:") === 0) { var w = document.createElement("div"); w.innerHTML = data.slice(8); node = w.firstElementChild; }
    else if (dragEl) node = dragEl;
    if (!node) return;
    if (s) s.el.parentNode.insertBefore(node, s.after ? s.el.nextSibling : s.el);
    else document.body.insertBefore(node, mark);
    dragEl = null; select(node); changed();
  }, true);
  document.addEventListener("dragend", function () { dragEl = null; mark.style.display = "none"; }, true);

  window.addEventListener("message", function (e) {
    var m = e.data || {}; if (!m.nxCmd) return;
    var c = m.nxCmd;
    if (c === "get") return post({ type: "html", html: clean() });
    if (c === "insert") {
      var w = document.createElement("div"); w.innerHTML = m.html; var node = w.firstElementChild;
      if (sel && sel.parentNode) sel.parentNode.insertBefore(node, sel.nextSibling); else document.body.insertBefore(node, mark);
      select(node); node.scrollIntoView({ behavior: "smooth", block: "center" }); return changed();
    }
    if (!sel) return;
    if (c === "style") sel.style[m.prop] = m.value;
    else if (c === "attr") sel.setAttribute(m.name, m.value);
    else if (c === "text") sel.innerText = m.value;
    else if (c === "delete") { var n = sel; select(null); n.remove(); }
    else if (c === "dup") { var cp = sel.cloneNode(true); cp.removeAttribute("data-nx-sel"); sel.parentNode.insertBefore(cp, sel.nextSibling); select(cp); }
    else if (c === "up" && sel.previousElementSibling) sel.parentNode.insertBefore(sel, sel.previousElementSibling);
    else if (c === "down" && sel.nextElementSibling) sel.parentNode.insertBefore(sel.nextElementSibling, sel);
    else if (c === "parent") { if (editable(sel.parentElement)) select(sel.parentElement); return; }
    else if (c === "deselect") { select(null); return; }
    changed();
  });
  post({ type: "ready" });
}

// Scripts sleep as comments while editing.
const parkScripts = (html) => {
  const scripts = [];
  const out = html.replace(/<script\b[\s\S]*?<\/script>/gi, (m) => `<!--nx-script-${scripts.push(m) - 1}-->`);
  return { out, scripts };
};
const wakeScripts = (html, scripts) => html.replace(/<!--nx-script-(\d+)-->/g, (_, i) => scripts[+i] || "");
const withRuntime = (html) => {
  const rt = `<script data-nx-editor>(${editorRuntime.toString()})()<\/script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, rt + "</body>") : html + rt;
};

const toHex = (c) => {
  const m = String(c || "").match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return "#000000";
  if (m.length === 4 && +m[3] === 0) return "";
  return "#" + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, "0")).join("");
};
// Each device is drawn at its real width (so the page's own phone/tablet layout kicks in), then
// scaled down to fit the space, inside a frame shaped like the device.
const DEVICES = { desktop: { w: 1280, h: 800, pad: 0, r: 10 }, tablet: { w: 820, h: 1180, pad: 14, r: 28 }, phone: { w: 390, h: 844, pad: 12, r: 44 } };

export default function VisualEditor({ html, onSave, onCancel }) {
  const parked = useMemo(() => parkScripts(html || ""), [html]);
  const [doc, setDoc] = useState(parked.out); // what the frame shows (changes on undo/redo)
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const current = useRef(parked.out);
  const [info, setInfo] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [ver, setVer] = useState(0); // reloads the frame only for undo/redo
  const [dirty, setDirty] = useState(false);
  const frame = useRef(null);
  const stage = useRef(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dv = DEVICES[device];
  // desktop fills the height it's given; tablet and phone keep their real shape
  const devH = device === "desktop" ? Math.max(500, Math.round((box.h - 16) * (dv.w / Math.max(1, box.w - 16)))) : dv.h;
  const scale = Math.min(1, (box.w - 16) / (dv.w + dv.pad * 2), (box.h - 16) / (devH + dv.pad * 2));
  const pending = useRef(null);

  const send = (m) => frame.current?.contentWindow?.postMessage({ nxCmd: m.cmd, ...m }, "*");
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [current.current, ...f]);
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    current.current = prev; setDoc(prev); setVer((v) => v + 1); setInfo(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, current.current]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    current.current = next; setDoc(next); setVer((v) => v + 1); setInfo(null);
  };

  useEffect(() => {
    const on = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data || {};
      if (!m.nxEditor) return;
      if (m.type === "sel") setInfo(m.info);
      else if (m.type === "changed") {
        const clean = m.html.replace(/<script data-nx-editor>[\s\S]*?<\/script>/g, "");
        if (clean !== current.current) { setPast((p) => [...p.slice(-60), current.current]); setFuture([]); current.current = clean; setDirty(true); }
      } else if (m.type === "undo") undo();
      else if (m.type === "redo") redo();
      else if (m.type === "html" && pending.current) { pending.current(m.html.replace(/<script data-nx-editor>[\s\S]*?<\/script>/g, "")); pending.current = null; }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });

  const save = () => {
    pending.current = (h) => onSave(wakeScripts(h, parked.scripts));
    send({ cmd: "get" });
  };
  const leave = async () => {
    if (dirty && !(await askConfirm("Leave without saving your changes?"))) return;
    onCancel();
  };
  const pickImage = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => send({ cmd: "attr", name: "src", value: r.result });
    r.readAsDataURL(file);
  };

  const btn = "p-1.5 rounded-md text-slate-300 hover:bg-slate-700/70 hover:text-white disabled:opacity-30";
  const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5";
  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200">
      {/* top bar */}
      <div className="flex items-center gap-1 px-2 h-11 border-b border-slate-700/60 bg-slate-900">
        <button className={btn} onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
        <button className={btn} onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-slate-700 mx-1" />
        {[["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]].map(([k, Icon]) => (
          <button key={k} onClick={() => setDevice(k)} className={`${btn} ${device === k ? "bg-slate-700 text-white" : ""}`} title={k[0].toUpperCase() + k.slice(1)} aria-label={`${k} view`}><Icon className="w-4 h-4" /></button>
        ))}
        <span className="flex-1 text-center text-[12px] text-slate-500 hidden md:block">Drag blocks onto the page · click to select · double-click text to type · drag to move</span>
        <button onClick={leave} className="px-3 py-1.5 rounded-lg text-[13px] text-slate-300 hover:bg-slate-800 flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
        <button onClick={save} className="px-3 py-1.5 rounded-lg text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Save</button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* blocks */}
        <aside className="w-40 sm:w-48 shrink-0 border-r border-slate-700/60 bg-slate-900/80 overflow-y-auto p-2">
          <p className={label + " px-1 pt-1"}>Add</p>
          <div className="grid gap-1.5">
            {BLOCKS.map(([name, Icon, code]) => (
              <button
                key={name}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", "NXBLOCK:" + code); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => send({ cmd: "insert", html: code })}
                title={`Drag onto the page, or click to add ${name.toLowerCase()} after the selection`}
                className="flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-800/70 hover:border-indigo-500/60 hover:bg-slate-800 px-2.5 py-2 text-[13px] text-left cursor-grab active:cursor-grabbing"
              >
                <Icon className="w-4 h-4 text-indigo-300 shrink-0" />
                {name}
              </button>
            ))}
          </div>
        </aside>

        {/* page */}
        <div ref={stage} className="flex-1 min-w-0 bg-slate-800/60 overflow-hidden flex items-center justify-center relative">
          <div
            className="shrink-0 transition-all duration-300"
            style={{ width: (dv.w + dv.pad * 2) * scale, height: (devH + dv.pad * 2) * scale }}
          >
            <div
              className="bg-slate-950 shadow-2xl origin-top-left transition-all duration-300"
              style={{ width: dv.w + dv.pad * 2, height: devH + dv.pad * 2, padding: dv.pad, borderRadius: dv.r, transform: `scale(${scale})`, boxShadow: device === "desktop" ? undefined : "0 0 0 2px #334155, 0 25px 60px rgba(0,0,0,.5)" }}
            >
              <iframe
                ref={frame}
                key={ver}
                srcDoc={withRuntime(doc)}
                title="Visual editor"
                sandbox="allow-scripts"
                className="bg-white block"
                style={{ width: dv.w, height: devH, borderRadius: Math.max(6, dv.r - dv.pad) }}
              />
            </div>
          </div>
          <span className="absolute bottom-2 right-3 text-[11px] text-slate-400">{dv.w}px · {Math.round(scale * 100)}%</span>
        </div>

        {/* style */}
        <aside className="w-56 sm:w-64 shrink-0 border-l border-slate-700/60 bg-slate-900/80 overflow-y-auto p-3 space-y-4">
          {!info ? (
            <p className="text-[13px] text-slate-400 leading-relaxed">Click anything on the page to style it. Double-click text to type right on the page.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white">&lt;{info.tag}&gt;</span>
                <div className="flex gap-0.5">
                  <button className={btn} onClick={() => send({ cmd: "parent" })} title="Select the box around it" aria-label="Select parent"><CornerLeftUp className="w-4 h-4" /></button>
                  <button className={btn} onClick={() => send({ cmd: "up" })} title="Move up" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                  <button className={btn} onClick={() => send({ cmd: "down" })} title="Move down" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                  <button className={btn} onClick={() => send({ cmd: "dup" })} title="Duplicate" aria-label="Duplicate"><Copy className="w-4 h-4" /></button>
                  <button className={`${btn} hover:text-red-400`} onClick={() => send({ cmd: "delete" })} title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {info.text != null && (
                <div>
                  <label className={label}>Text</label>
                  <textarea key={info.text} defaultValue={info.text} rows={3} onBlur={(e) => e.target.value !== info.text && send({ cmd: "text", value: e.target.value })} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-[13px] outline-none focus:border-indigo-500 resize-none" />
                </div>
              )}
              {info.href != null && (
                <div>
                  <label className={label}>Link goes to</label>
                  <input key={info.href} defaultValue={info.href} onBlur={(e) => send({ cmd: "attr", name: "href", value: e.target.value })} placeholder="https://… or #section" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-[13px] outline-none focus:border-indigo-500" />
                </div>
              )}
              {info.src != null && (
                <div>
                  <label className={label}>Image</label>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 py-2 text-[13px] cursor-pointer hover:border-indigo-500">
                    <ImageIcon className="w-4 h-4" /> Upload a picture
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                  </label>
                  <label className={label + " mt-3"}>Width</label>
                  <input type="range" min="10" max="100" defaultValue={parseInt(info.width, 10) || 100} onChange={(e) => send({ cmd: "style", prop: "width", value: e.target.value + "%" })} className="w-full accent-indigo-500" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Text color</label>
                  <input type="color" defaultValue={toHex(info.color) || "#000000"} key={"c" + info.color} onChange={(e) => send({ cmd: "style", prop: "color", value: e.target.value })} className="w-full h-8 rounded-md bg-transparent cursor-pointer" />
                </div>
                <div>
                  <label className={label}>Background</label>
                  <input type="color" defaultValue={toHex(info.bg) || "#ffffff"} key={"b" + info.bg} onChange={(e) => send({ cmd: "style", prop: "background", value: e.target.value })} className="w-full h-8 rounded-md bg-transparent cursor-pointer" />
                </div>
              </div>
              <div>
                <label className={label}>Text size · {Math.round(info.fontSize)}px</label>
                <input type="range" min="10" max="96" defaultValue={info.fontSize} key={"f" + info.fontSize} onChange={(e) => send({ cmd: "style", prop: "fontSize", value: e.target.value + "px" })} className="w-full accent-indigo-500" />
              </div>
              <div className="flex gap-1">
                <button className={`${btn} ${info.bold ? "bg-slate-700 text-white" : ""}`} onClick={() => send({ cmd: "style", prop: "fontWeight", value: info.bold ? "400" : "700" })} aria-label="Bold"><Bold className="w-4 h-4" /></button>
                {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]].map(([a, Icon]) => (
                  <button key={a} className={`${btn} ${info.align === a ? "bg-slate-700 text-white" : ""}`} onClick={() => send({ cmd: "style", prop: "textAlign", value: a })} aria-label={`Align ${a}`}><Icon className="w-4 h-4" /></button>
                ))}
              </div>
              <div>
                <label className={label}>Space inside · {Math.round(info.padding)}px</label>
                <input type="range" min="0" max="120" defaultValue={info.padding} key={"p" + info.padding} onChange={(e) => send({ cmd: "style", prop: "padding", value: e.target.value + "px" })} className="w-full accent-indigo-500" />
              </div>
              <div>
                <label className={label}>Rounded corners · {Math.round(info.radius)}px</label>
                <input type="range" min="0" max="60" defaultValue={info.radius} key={"r" + info.radius} onChange={(e) => send({ cmd: "style", prop: "borderRadius", value: e.target.value + "px" })} className="w-full accent-indigo-500" />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
