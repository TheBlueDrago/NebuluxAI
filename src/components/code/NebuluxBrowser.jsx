import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home, Plus, X, Search, Loader2, Lock, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BlackholeIcon from "@/components/BlackholeIcon";

// Nebulux Browser: Nebulux Code's own browser. Tabs, back/forward, reload, an address bar that
// searches or opens an address, and a start page. Pages come through the server
// (functions/.../web-browse.js) with their own look but none of their scripts, and are shown in a
// locked-down frame; a small script here catches link clicks and GET forms and sends them back to
// the browser, so browsing stays inside it. The AI is told what's on screen (current()).
const LINK_SCRIPT = `<script>(function(){
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var raw=a.getAttribute("href")||"";if(raw.charAt(0)==="#")return;e.preventDefault();parent.postMessage({nxb:"go",url:a.href},"*")},true);
document.addEventListener("submit",function(e){var f=e.target;e.preventDefault();if((f.getAttribute("method")||"get").toLowerCase()!=="get")return;try{var u=new URL(f.getAttribute("action")||document.baseURI,document.baseURI);new FormData(f).forEach(function(v,k){if(typeof v==="string")u.searchParams.set(k,v)});parent.postMessage({nxb:"go",url:u.href},"*")}catch(_){}},true);
})();<\/script>`;

let nextId = 1;
const newTab = () => ({ id: nextId++, history: [{ type: "home" }], idx: 0 });
const looksLikeUrl = (v) => /^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v);
const titleOf = (e) => (e.type === "home" ? "New tab" : e.type === "search" ? e.q : e.title || e.url);
const addressOf = (e) => (e.type === "home" ? "" : e.type === "search" ? e.q : e.url);

const NebuluxBrowser = forwardRef(function NebuluxBrowser(_, ref) {
  const [tabs, setTabs] = useState(() => [newTab()]);
  const [active, setActive] = useState(() => tabs[0]?.id);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const frameRef = useRef(null);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  const entry = tab.history[tab.idx];

  useEffect(() => setAddress(addressOf(entry)), [active, tab.idx, entry]);

  const updateTab = (fn) => setTabs((ts) => ts.map((t) => (t.id === tab.id ? fn(t) : t)));
  const push = (e) => updateTab((t) => ({ ...t, history: [...t.history.slice(0, t.idx + 1), e], idx: t.idx + 1 }));

  const load = async (kind, value) => {
    setBusy(true);
    setErr("");
    try {
      if (kind === "search") {
        const r = await base44.functions.invoke("web-browse", { action: "search", q: value });
        const e = { type: "search", q: value, results: r.data?.results || [] };
        return e;
      }
      const r = await base44.functions.invoke("web-browse", { action: "open", url: value, view: true });
      return { type: "page", url: r.data?.url || value, title: r.data?.title || "", text: r.data?.text || "", html: r.data?.html || "" };
    } catch (ex) {
      setErr(ex?.response?.data?.error || "That page couldn't be opened.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const go = async (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    const e = looksLikeUrl(v) ? await load("open", /^https?:/i.test(v) ? v : `https://${v}`) : await load("search", v);
    if (e) push(e);
    return e;
  };
  const reload = async () => {
    if (entry.type === "home") return;
    const e = entry.type === "search" ? await load("search", entry.q) : await load("open", entry.url);
    if (e) updateTab((t) => ({ ...t, history: t.history.map((h, i) => (i === t.idx ? e : h)) }));
  };

  // links and forms inside the page
  useEffect(() => {
    const on = (ev) => {
      if (!frameRef.current || ev.source !== frameRef.current.contentWindow || ev.data?.nxb !== "go") return;
      go(String(ev.data.url || ""));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  });

  // The AI uses this: look something up (shown in the current tab), and what's on screen now.
  useImperativeHandle(ref, () => ({
    search: async (q) => {
      const e = await load("search", q);
      if (e) push(e);
      return e?.results || [];
    },
    current: () => entry,
  }));

  const secure = entry.type === "page" && /^https:/i.test(entry.url);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--cl-side)]">
      {/* tabs */}
      <div className="flex items-end gap-1 px-2 pt-2 overflow-x-auto">
        {tabs.map((t) => {
          const e = t.history[t.idx];
          return (
            <div
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`group flex items-center gap-1.5 min-w-0 max-w-[180px] rounded-t-lg px-2.5 py-1.5 text-[12.5px] cursor-pointer ${
                t.id === tab.id ? "bg-[var(--cl-card)] text-[var(--cl-text)]" : "text-[var(--cl-faint)] hover:bg-[var(--cl-hover)]"
              }`}
            >
              {e.type === "home" ? <BlackholeIcon className="w-3.5 h-3.5 shrink-0" /> : e.type === "search" ? <Search className="w-3.5 h-3.5 shrink-0" /> : <img alt="" src={`https://icons.duckduckgo.com/ip3/${(() => { try { return new URL(e.url).hostname; } catch { return "x"; } })()}.ico`} className="w-3.5 h-3.5 shrink-0 rounded-sm" onError={(ev) => (ev.currentTarget.style.visibility = "hidden")} />}
              <span className="truncate">{titleOf(e)}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setTabs((ts) => {
                      const rest = ts.filter((x) => x.id !== t.id);
                      if (t.id === tab.id) setActive(rest[0].id);
                      return rest;
                    });
                  }}
                  className="ml-auto p-0.5 rounded hover:bg-[var(--cl-hover)]"
                  aria-label="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => {
            const t = newTab();
            setTabs((ts) => [...ts, t]);
            setActive(t.id);
          }}
          className="p-1.5 mb-0.5 rounded-lg text-[var(--cl-faint)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]"
          aria-label="New tab"
          title="New tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--cl-card)] border-b border-[var(--cl-border)]">
        <button disabled={tab.idx === 0} onClick={() => updateTab((t) => ({ ...t, idx: t.idx - 1 }))} className="p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)] disabled:opacity-30" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button disabled={tab.idx >= tab.history.length - 1} onClick={() => updateTab((t) => ({ ...t, idx: t.idx + 1 }))} className="p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)] disabled:opacity-30" aria-label="Forward">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={reload} className="p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]" aria-label="Reload">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
        </button>
        <button onClick={() => push({ type: "home" })} className="p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]" aria-label="Home">
          <Home className="w-4 h-4" />
        </button>
        <form
          className="flex-1 min-w-0"
          onSubmit={(ev) => {
            ev.preventDefault();
            go(address);
          }}
        >
          <div className="relative">
            {secure ? <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--cl-faint)]" /> : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--cl-faint)]" />}
            <input
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
              onFocus={(ev) => ev.target.select()}
              placeholder="Search with Nebulux or type an address"
              className="w-full rounded-full bg-[var(--cl-bg)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] pl-8 pr-3 py-1.5 text-[13px] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-faint)]"
            />
          </div>
        </form>
        {entry.type === "page" && (
          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]" title="Open in a normal tab" aria-label="Open in a normal tab">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      {err && <p className="px-3 py-1.5 text-[12.5px] text-red-400 bg-[var(--cl-card)]">{err}</p>}

      {/* page */}
      <div className="flex-1 min-h-0 relative bg-[var(--cl-bg)]">
        {entry.type === "home" && (
          <div className="h-full overflow-y-auto flex flex-col items-center justify-center px-6 text-center">
            <BlackholeIcon className="keep-color w-14 h-14" />
            <h2 className="mt-3 font-serif text-[28px] text-[var(--cl-text)]">Nebulux Browser</h2>
            <form
              className="mt-5 w-full max-w-md"
              onSubmit={(ev) => {
                ev.preventDefault();
                go(new FormData(ev.currentTarget).get("q"));
              }}
            >
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cl-faint)]" />
                <input name="q" autoFocus placeholder="Search the web" className="w-full rounded-full bg-[var(--cl-card)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] pl-10 pr-4 py-2.5 text-[14px] text-[var(--cl-text)] outline-none placeholder:text-[var(--cl-faint)] shadow-lg" />
              </div>
            </form>
            <p className="mt-4 max-w-sm text-[12px] text-[var(--cl-faint)]">While the browser is open, the AI can see and use what's open here and looks up your questions on the web.</p>
          </div>
        )}
        {entry.type === "search" && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <p className="text-[12px] text-[var(--cl-faint)] mb-2">Results for "{entry.q}"</p>
            {entry.results.length === 0 && <p className="text-[13px] text-[var(--cl-muted)]">Nothing found. Try other words.</p>}
            {entry.results.map((r) => (
              <button key={r.url} onClick={() => go(r.url)} className="block w-full text-left rounded-lg px-2 py-2 hover:bg-[var(--cl-card)]">
                <span className="block text-[12px] text-[var(--cl-faint)] truncate">{r.url}</span>
                <span className="block text-[15px] text-[var(--cl-accent)]">{r.title}</span>
                {r.snippet && <span className="block text-[12.5px] text-[var(--cl-muted)] mt-0.5 line-clamp-2">{r.snippet}</span>}
              </button>
            ))}
          </div>
        )}
        {entry.type === "page" &&
          (entry.html ? (
            <iframe ref={frameRef} key={entry.url} title={entry.title || entry.url} srcDoc={entry.html + LINK_SCRIPT} sandbox="allow-scripts" referrerPolicy="no-referrer" className="w-full h-full bg-white border-0" />
          ) : (
            <div className="h-full overflow-y-auto px-4 py-3 whitespace-pre-wrap text-[13.5px] text-[var(--cl-muted)]">{entry.text}</div>
          ))}
        {busy && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--cl-accent)] to-[var(--cl-accent2)] animate-pulse" />}
      </div>
    </div>
  );
});

export default NebuluxBrowser;
