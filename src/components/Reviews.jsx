import React, { useCallback, useEffect, useState } from "react";
import { Star, MessageSquare, X, Loader2, Flag, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { askConfirm } from "@/lib/dialogs";

// Star ratings (games) and comments (games and gallery creations): functions/reviews.js.
// <Reviews kind="game" item="neon-drift" title="Neon Drift" /> is a small button that opens the panel.
// Anyone can read; rating, commenting and reporting need an account.
const call = (body) => base44.functions.invoke("reviews", body).then((r) => r.data);
const when = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function Stars({ value, onPick, size = "w-6 h-6" }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="inline-flex" role={onPick ? "radiogroup" : "img"} aria-label={onPick ? "Your rating" : `${value} out of 5 stars`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        const star = <Star className={`${size} ${on ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />;
        return onPick ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => onPick(n)} className="p-1.5">
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}

export default function Reviews({ kind, item, title, className = "", label }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => call({ action: "get", kind, item }).then(setData).catch(() => setData((d) => d || { count: 0, avg: 0, mine: 0, comments: [] })), [kind, item]);
  useEffect(() => { setData(null); if (item) load(); }, [item, load]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const act = async (body, done) => {
    setBusy(true); setMsg("");
    try { const d = await call(body); if (d && d.comments) setData(d); if (done) done(d); }
    catch (e) { setMsg(e?.response?.data?.error || "That didn't work. Please try again."); }
    finally { setBusy(false); }
  };
  const signIn = `/register?returnTo=${encodeURIComponent(window.location.pathname)}`;
  const games = kind === "game";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={games ? "Ratings and comments" : "Comments"} aria-label={games ? "Ratings and comments" : "Comments"} className={`tap-area inline-flex items-center gap-1 rounded-lg text-slate-300 hover:text-white ${className}`}>
        {games ? <Star className={`w-4 h-4 ${data && data.count ? "fill-amber-400 text-amber-400" : ""}`} /> : <MessageSquare className="w-3.5 h-3.5" />}
        {label || (games ? (data && data.count ? <span className="text-xs font-semibold">{data.avg.toFixed(1)}</span> : null) : <span>{data && data.comments.length ? `Comments (${data.comments.length})` : "Comments"}</span>)}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={games ? "Ratings and comments" : "Comments"} onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 text-left">
            <div className="flex items-center justify-between gap-2 px-4 pt-4">
              <h2 className="text-base font-semibold text-white truncate">{title || (games ? "Ratings and comments" : "Comments")}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 -mr-2 rounded-lg text-slate-400 hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-4 pb-4 overflow-y-auto">
              {!data ? (
                <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : (
                <>
                  {games && (
                    <div className="mt-2 rounded-xl bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <Stars value={Math.round(data.avg)} size="w-4 h-4" />
                        <span className="text-sm text-slate-300">{data.count ? `${data.avg.toFixed(1)} from ${data.count} rating${data.count === 1 ? "" : "s"}` : "No ratings yet"}</span>
                      </div>
                      {isAuthenticated ? (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400">{data.mine ? "Your rating:" : "Rate this game:"}</span>
                          <Stars value={data.mine} onPick={(n) => !busy && act({ action: "rate", kind, item, stars: n })} />
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400"><a href={signIn} className="text-indigo-300 underline">Sign up free</a> to rate this game.</p>
                      )}
                    </div>
                  )}
                  {isAuthenticated ? (
                    <form className="mt-3" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !busy) act({ action: "comment", kind, item, text }, () => setText("")); }}>
                      <label htmlFor="rv-text" className="sr-only">Your comment</label>
                      <textarea id="rv-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2} placeholder="Say something nice or helpful" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">No links, numbers or personal details. {300 - text.length} left.</span>
                        <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white">Post</button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400"><a href={signIn} className="text-indigo-300 underline">Sign up free</a> to leave a comment.</p>
                  )}
                  {msg && <p role="status" className="mt-2 text-xs text-amber-300">{msg}</p>}
                  <div className="mt-3 space-y-3">
                    {data.comments.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No comments yet.</p>}
                    {data.comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-400"><b className="text-slate-200">{c.name}</b> · {when(c.at)}</p>
                          <p className="text-sm text-slate-100 break-words">{c.text}</p>
                        </div>
                        {c.mine ? (
                          <button onClick={async () => (await askConfirm("Delete your comment?")) && act({ action: "delete", id: c.id }, load)} aria-label="Delete your comment" title="Delete" className="p-2 rounded-lg text-slate-500 hover:text-red-300 hover:bg-white/5"><Trash2 className="w-4 h-4" /></button>
                        ) : isAuthenticated ? (
                          <button onClick={async () => (await askConfirm("Report this comment? It will be checked, and hidden if others report it too.")) && act({ action: "report", id: c.id }, () => setMsg("Thanks. We'll take a look."))} aria-label={`Report ${c.name}'s comment`} title="Report" className="p-2 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-white/5"><Flag className="w-4 h-4" /></button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
