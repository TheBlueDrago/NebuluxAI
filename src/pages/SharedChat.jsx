import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Code2, Loader2, Lock, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Markdown from "@/components/chat/Markdown";
import BlackholeIcon from "@/components/BlackholeIcon";
import usePageTitle from "@/hooks/usePageTitle";

// A chat someone shared (nebuluxai.com/share/<id>, cloudflare-lib/shares.js). You need an account
// to open one. A Nebulux Code chat needs Pro or higher: anyone else gets the upgrade popup and
// the chat itself is never sent to them. After they upgrade it opens by itself (here, or from
// anywhere in the app: components/AppShellContext.jsx reads PENDING_SHARE).
export const PENDING_SHARE = "nx-pending-share";

export default function SharedChat() {
  const { id } = useParams();
  const { isAuthenticated, authChecked } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });
  usePageTitle(state.share?.title || state.title || "Shared chat");

  const load = useCallback(async () => {
    try {
      const r = await base44.functions.invoke("chat-share", { action: "view", id });
      try { localStorage.removeItem(PENDING_SHARE); } catch { /* fine */ }
      setState({ share: r.data.share, own: r.data.own });
    } catch (e) {
      const d = e?.response?.data || {};
      if (e?.response?.status === 402 && d.locked) {
        try { localStorage.setItem(PENDING_SHARE, id); } catch { /* fine */ }
        setState({ locked: true, ...d });
      } else setState({ error: d.error || "Couldn't open this chat. Check your connection and try again." });
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  // While locked, look again every few seconds and whenever they come back to this tab, so the
  // chat pops up as soon as their upgrade goes through.
  useEffect(() => {
    if (!state.locked) return undefined;
    const t = setInterval(load, 5000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [state.locked, load]);

  if (authChecked && !isAuthenticated) return <Navigate to={`/register?returnTo=${encodeURIComponent(`/share/${id}`)}`} replace />;

  const s = state.share;
  return (
    <div className="min-h-screen bg-[var(--cl-bg)] text-[var(--cl-text)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--cl-border)] bg-[var(--cl-bg)]/95 px-4 py-3 backdrop-blur">
        <Link to="/chat" className="flex items-center gap-2 font-semibold"><BlackholeIcon className="w-6 h-6" /> Nebulux AI</Link>
        {s && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-[var(--cl-muted)]">
            {s.kind === "code" ? <Code2 className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            {s.own ? "Your shared chat" : `Shared by ${s.owner_name}`}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {(state.loading || !authChecked) && <div className="py-24 text-center"><Loader2 className="inline w-6 h-6 animate-spin text-[var(--cl-muted)]" /></div>}
        {state.error && (
          <div className="py-24 text-center">
            <p className="text-[var(--cl-muted)]">{state.error}</p>
            <Link to="/chat" className="mt-4 inline-block rounded-lg bg-[var(--cl-text)] px-4 py-2 text-[14px] font-medium text-[var(--cl-bg)]">Go to Nebulux AI</Link>
          </div>
        )}
        {s && (
          <>
            <h1 className="font-serif text-2xl mb-6">{s.title}</h1>
            <div className="space-y-5">
              {s.messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[var(--cl-card)] px-4 py-2.5 text-[15px]">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="text-[15px] leading-relaxed"><Markdown text={m.content} /></div>
                )
              )}
            </div>
            <div className="mt-10 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-4 text-center text-[14px] text-[var(--cl-muted)]">
              This is a copy of a chat. <Link to={s.kind === "code" ? "/chat/code" : "/chat"} className="text-[var(--cl-text)] underline">Start your own</Link>
            </div>
          </>
        )}
      </main>

      {/* The upgrade popup for a Code chat: it can't be closed to see the chat. */}
      {state.locked && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="share-upgrade-title" className="w-full max-w-md rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-6 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cl-hover)]"><Lock className="h-5 w-5" /></span>
            <h2 id="share-upgrade-title" className="mt-4 font-serif text-2xl">Upgrade to open this chat</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--cl-muted)]">
              {state.owner_name} shared a <b className="text-[var(--cl-text)]">Nebulux Code</b> chat with you{state.title ? `: "${state.title}"` : ""}. Code chats are for Pro and higher plans. Upgrade and it opens right away.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => navigate("/chat")} className="rounded-lg border border-[var(--cl-border)] px-4 py-2 text-[14px] text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">Not now</button>
              <button onClick={() => navigate("/chat/shop")} className="rounded-lg bg-[var(--cl-text)] px-4 py-2 text-[14px] font-medium text-[var(--cl-bg)] hover:opacity-90">Upgrade</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
