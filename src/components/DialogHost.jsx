import React, { useEffect, useRef, useState } from "react";
import { answer, onDialog } from "@/lib/dialogs";
import { Check, Copy, ExternalLink, Link2, Mail, MessageSquare, Code2, Share2, X } from "lucide-react";

// The share card: the chat it shares, its link with a big Copy button, and ways to send it.
function ShareCard({ d, onClose }) {
  const [copied, setCopied] = useState(!!d.copied);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.url);
      setCopied(true);
    } catch {
      /* clipboard blocked: the link can still be selected by hand */
    }
  };
  const title = (d.title || "Untitled chat").slice(0, 80);
  const text = encodeURIComponent(`Check out this chat on Nebulux AI: ${title}`);
  const link = encodeURIComponent(d.url);
  const Icon = d.kind === "code" ? Code2 : MessageSquare;
  const ways = [
    { name: "WhatsApp", href: `https://wa.me/?text=${text}%20${link}`, bg: "#25D366", label: "W" },
    { name: "X", href: `https://x.com/intent/post?text=${text}&url=${link}`, bg: "#000", label: "𝕏" },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${link}&title=${encodeURIComponent(title)}`, bg: "#FF4500", label: "r/" },
    { name: "Email", href: `mailto:?subject=${encodeURIComponent(title)}&body=${text}%0A%0A${link}`, bg: "#475569", icon: Mail },
  ];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bh-share-title" className="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-60 bg-gradient-to-b from-indigo-500/25 via-fuchsia-500/10 to-transparent" />
      <div className="relative px-6 pt-6 pb-5">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-indigo-900/40">
          <Share2 className="w-5 h-5 text-[#fff]" />
        </div>
        <h2 id="bh-share-title" className="mt-3 text-lg font-semibold text-slate-50">{copied ? "Link copied!" : "Share this chat"}</h2>
        <p className="text-sm text-slate-400">Anyone with the link can see a copy of this chat as it is now.</p>
      </div>
      <div className="relative px-6 pb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-800/70 border border-slate-700/70 p-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-700/80 grid place-items-center text-slate-200"><Icon className="w-4 h-4" /></div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-100 truncate">{title}</div>
            <div className="text-xs text-slate-400">{d.kind === "code" ? "Nebulux Code chat" : "Chat"}{d.count ? ` · ${d.count} message${d.count === 1 ? "" : "s"}` : ""}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-950 border border-slate-700 p-1.5 pl-3">
          <Link2 className="w-4 h-4 shrink-0 text-slate-500" />
          <input readOnly value={d.url} onFocus={(e) => e.target.select()} aria-label="Share link" className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none" />
          <button type="button" onClick={copy} className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-[#fff] transition-colors ${copied ? "bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-500"}`}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {ways.map((w) => (
            <a key={w.name} href={w.href} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-100">
              <span className="w-11 h-11 rounded-full grid place-items-center text-[#fff] font-bold text-sm transition-transform group-hover:scale-105" style={{ background: w.bg }}>
                {w.icon ? <w.icon className="w-4 h-4" /> : w.label}
              </span>
              {w.name}
            </a>
          ))}
          {typeof navigator !== "undefined" && navigator.share ? (
            <button type="button" onClick={() => navigator.share({ title, url: d.url }).catch(() => {})} className="group flex flex-col items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-100">
              <span className="w-11 h-11 rounded-full grid place-items-center bg-slate-700 text-[#fff] transition-transform group-hover:scale-105"><Share2 className="w-4 h-4" /></span>
              More
            </button>
          ) : (
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-100">
              <span className="w-11 h-11 rounded-full grid place-items-center bg-slate-700 text-[#fff] transition-transform group-hover:scale-105"><ExternalLink className="w-4 h-4" /></span>
              Open
            </a>
          )}
        </div>
        {d.note && <p className="mt-5 text-xs text-slate-500 leading-relaxed">{d.note}</p>}
      </div>
    </div>
  );
}

// Shows the dialogs asked for with askConfirm / askText / showNotice (lib/dialogs.js).
// Enter answers yes (or sends the text), Escape and tapping outside answer no.
export default function DialogHost() {
  const [d, setD] = useState(null);
  const [text, setText] = useState("");
  const okRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => onDialog(setD), []);

  useEffect(() => {
    if (!d) return undefined;
    setText(d.defaultValue || "");
    const focus = setTimeout(() => (d.type === "text" ? inputRef.current : okRef.current)?.focus(), 0);
    const cancel = d.type === "confirm" ? false : d.type === "text" ? null : undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        answer(cancel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [d]);

  if (!d) return null;
  const cancel = () => answer(d.type === "confirm" ? false : d.type === "text" ? null : undefined);
  const ok = () => answer(d.type === "confirm" ? true : d.type === "text" ? text : undefined);

  if (d.type === "share")
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
        <ShareCard key={d.url} d={d} onClose={cancel} />
      </div>
    );

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60"
      onMouseDown={(e) => e.target === e.currentTarget && cancel()}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bh-dialog-message"
        onSubmit={(e) => {
          e.preventDefault();
          ok();
        }}
        className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5"
      >
        <p id="bh-dialog-message" className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {d.message}
        </p>
        {d.type === "text" && (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={d.placeholder}
            maxLength={d.maxLength}
            className="mt-3 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500"
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          {d.type !== "notice" && (
            <button type="button" onClick={cancel} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-800">
              {d.cancelLabel}
            </button>
          )}
          <button
            ref={okRef}
            type="submit"
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-[#fff] ${d.danger ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"}`}
          >
            {d.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
