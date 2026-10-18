import React, { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { withPreviewShim, PREVIEW_SANDBOX } from "@/lib/previewShim";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { askConfirm } from "@/lib/dialogs";

// A game or website shown in a sandboxed frame, with a fix for the "black screen" problem: the
// preview shim (lib/previewShim.js) reports if the page crashed or still shows nothing a few
// seconds after loading. The first time, the frame quietly loads it again (most black screens
// are a one-off timing problem on start-up); if it happens again, a Reload button appears.
// onBroken(error) is called when it is still blank after that quiet reload (the Game Designer then
// asks the AI to fix the game).
//
// saveName: a published game's name. For someone signed in, the game's saved progress is loaded
// from their account before it starts and every change is saved back (functions/.../game-save.js).
export default function PreviewFrame({ html, title, className = "w-full h-full", onBroken, saveName, ...rest }) {
  const { isAuthenticated, user } = useAuth();
  // Games show the player's Nebulux AI username; signed out, "Anonymous".
  const player = saveName ? (isAuthenticated && String(user?.full_name || "").trim()) || "Anonymous" : undefined;
  const saving = !!(saveName && isAuthenticated);
  const [save, setSave] = useState(null); // the player's saved progress, once loaded
  const [avatar, setAvatar] = useState(undefined); // the player's avatar (functions/.../social.js)
  useEffect(() => {
    if (!saving) return;
    let alive = true;
    setSave(null);
    setAvatar(undefined);
    base44.functions
      .invoke("game-save", { action: "get", name: saveName })
      .then((r) => alive && setSave(r?.data?.data || {}))
      .catch(() => alive && setSave({}));
    base44.functions
      .invoke("social", { action: "avatar" })
      .then((r) => alive && setAvatar(r?.data?.avatar || null))
      .catch(() => alive && setAvatar(null));
    return () => {
      alive = false;
    };
  }, [saving, saveName]);
  // Friends see which game you're in ("playing"), refreshed every 2 minutes while it's open.
  useEffect(() => {
    if (!saving) return;
    const tell = (game) => base44.functions.invoke("social", { action: "playing", game }).catch(() => {});
    tell(saveName);
    const t = setInterval(() => tell(saveName), 120000);
    return () => {
      clearInterval(t);
      tell("");
    };
  }, [saving, saveName]);
  const ref = useRef(null);
  const [round, setRound] = useState(0);
  const [stuck, setStuck] = useState(false);
  const retried = useRef(false);
  const brokenRef = useRef(onBroken);
  brokenRef.current = onBroken;
  const saveRef = useRef(null);
  saveRef.current = saving ? saveName : null;
  const nameRef = useRef(null);
  nameRef.current = saveName || null;

  // Saves are stored in Cloudflare KV, whose free plan allows only 1,000 writes a day for the
  // whole site, and games save often (some every few seconds). So a save is sent at most once
  // every 15 seconds, only when it changed, and right away when the player leaves the page.
  const pending = useRef(null); // { name, data } waiting to be sent
  const lastSent = useRef("");
  const saveTimer = useRef(0);
  const flushSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const json = JSON.stringify(p.data);
    if (json === lastSent.current) return;
    lastSent.current = json;
    base44.functions.invoke("game-save", { action: "set", name: p.name, data: p.data }).catch(() => {});
  };
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;
  const queueSave = (name, data) => {
    pending.current = { name, data };
    if (!saveTimer.current) saveTimer.current = setTimeout(() => flushRef.current(), 15000);
  };
  useEffect(() => {
    const away = () => document.visibilityState === "hidden" && flushRef.current();
    document.addEventListener("visibilitychange", away);
    window.addEventListener("pagehide", away);
    return () => {
      document.removeEventListener("visibilitychange", away);
      window.removeEventListener("pagehide", away);
      flushRef.current();
    };
  }, []);
  // The in-game menu (components/GameMenu.jsx): save now, or open the game's own chat.
  useEffect(() => {
    const onCmd = (e) => {
      if (e.detail === "save") flushRef.current();
      if (e.detail === "chat") ref.current?.contentWindow?.postMessage({ type: "nebulux-chat" }, "*");
    };
    window.addEventListener("nebulux-game-cmd", onCmd);
    return () => window.removeEventListener("nebulux-game-cmd", onCmd);
  }, []);
  // The save loaded from the account counts as already sent.
  useEffect(() => {
    if (save) lastSent.current = JSON.stringify(save);
  }, [save]);

  useEffect(() => {
    retried.current = false;
    setStuck(false);
  }, [html]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || !ref.current || e.source !== ref.current.contentWindow) return;
      if (d.type === "nebulux-save") {
        if (saveRef.current) queueSave(saveRef.current, d.data);
        return;
      }
      // Leaderboards (functions/.../game-board.js): the answer goes back to the game by id.
      if ((d.type === "nebulux-score" || d.type === "nebulux-top-get") && nameRef.current) {
        const win = ref.current.contentWindow;
        const reply = (top) => win.postMessage({ type: "nebulux-top", id: d.id, top: Array.isArray(top) ? top : [] }, "*");
        const send = d.type === "nebulux-score" && saveRef.current ? { action: "score", score: d.score } : { action: "top" };
        base44.functions
          .invoke("game-board", { ...send, name: nameRef.current, board: d.board })
          .then((r) => reply(r?.data?.top))
          .catch((e) => reply(e?.response?.data?.top));
        return;
      }
      // Stardust (functions/.../social.js): a game can show your balance, and spend some only
      // after you say yes here in the app (the game can't skip this).
      if ((d.type === "nebulux-stardust" || d.type === "nebulux-spend") && nameRef.current) {
        const win = ref.current.contentWindow;
        const reply = (data) => win.postMessage({ type: "nebulux-reply", id: d.id, data }, "*");
        if (!saveRef.current) return reply({ error: "Sign in to use Stardust." });
        if (d.type === "nebulux-stardust") {
          base44.functions.invoke("social", { action: "shop" }).then((r) => reply({ stardust: r?.data?.nebux ?? 0 })).catch(() => reply({}));
          return;
        }
        const price = Math.floor(Number(d.price));
        askConfirm(`Use ${price} Stardust for "${String(d.what || "this").slice(0, 60)}" in ${title || "this game"}?`, { confirmLabel: `Use ${price} ✨` }).then((yes) => {
          if (!yes) return reply({ error: "Cancelled." });
          base44.functions
            .invoke("social", { action: "spend", game: nameRef.current, price })
            .then((r) => reply(r?.data || {}))
            .catch((e) => reply(e?.response?.data || { error: "Couldn't use Stardust right now." }));
        });
        return;
      }
      if (d.type !== "nebulux-health") return;
      if (!d.blank) {
        setStuck(false);
        return;
      }
      if (!retried.current) {
        retried.current = true;
        setRound((r) => r + 1);
      } else {
        setStuck(true);
        brokenRef.current?.(d.crashed || "");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const reload = () => {
    setStuck(false);
    setRound((r) => r + 1);
  };

  // Both are needed before the game starts (a change later would reload it).
  if (saving && (!save || avatar === undefined)) return <div className="w-full h-full bg-black" />;

  return (
    <div className="relative w-full h-full">
      <iframe key={round} ref={ref} srcDoc={withPreviewShim(html, saving || player !== undefined ? { ...(saving ? { save } : {}), player, avatar: avatar || null, admin: user?.role === "admin" } : undefined)} title={title} sandbox={PREVIEW_SANDBOX} className={className} {...rest} />
      {stuck && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900/95 border border-white/10 px-4 py-2.5 shadow-2xl text-sm text-slate-200">
            <span>Still a black screen? It may be waiting for a tap, or it didn't start.</span>
            <button onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-[#fff]">
              <RotateCcw className="w-3.5 h-3.5" /> Reload
            </button>
            <button onClick={() => setStuck(false)} className="text-xs text-slate-400 hover:text-white">
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
