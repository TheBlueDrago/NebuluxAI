import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2, LogOut, RotateCcw, Save, Users, Trophy, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import BlackholeIcon from "@/components/BlackholeIcon";
import { BoardList } from "@/components/GameBoards";

// The in-game menu, like Roblox's: the Nebulux logo (in place of a back button) opens a menu with
// the people playing this game right now and Leave / Respawn / Save progress, and a Leaderboard
// tab. Next to it, a chat button opens the game's own chat (games that have one listen for it).
// Commands reach the game frame through a window event that PreviewFrame.jsx listens to.
export const gameCmd = (cmd) => window.dispatchEvent(new CustomEvent("nebulux-game-cmd", { detail: cmd }));

export default function GameMenu({ name, onRespawn, leaveTo = "/chat/games" }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("players");
  const [players, setPlayers] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || tab !== "players") return;
    let alive = true;
    setPlayers(null);
    base44.functions
      .invoke("social", { action: "players", game: name })
      .then((r) => alive && setPlayers(r?.data?.players || []))
      .catch(() => alive && setPlayers([]));
    return () => {
      alive = false;
    };
  }, [open, tab, name]);

  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const save = () => {
    gameCmd("save");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setOpen(true)} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Menu" aria-label="Game menu">
          <BlackholeIcon className="w-8 h-8" />
        </button>
        <button onClick={() => gameCmd("chat")} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors" title="Chat (/)" aria-label="Chat">
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-slate-900/95 border border-white/15 shadow-2xl shadow-black/60 p-4">
            <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
              {[["players", "Players", Users], ["board", "Leaderboard", Trophy]].map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${tab === id ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {tab === "players" ? (
              <>
                <div className="mt-3 min-h-[140px] max-h-[40vh] overflow-y-auto">
                  {!players ? (
                    <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : !players.length ? (
                    <p className="py-10 text-center text-sm text-slate-400">Nobody signed in is playing right now.</p>
                  ) : (
                    <ul className="space-y-1">
                      {players.map((n, i) => (
                        <li key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-white">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold">{String(n).charAt(0).toUpperCase()}</span>
                          <span className="truncate">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => { gameCmd("save"); navigate(leaveTo); }} className="inline-flex flex-col items-center gap-1 rounded-xl bg-red-500/90 hover:bg-red-500 px-2 py-3 text-sm font-bold text-white">
                    <LogOut className="w-5 h-5" /> Leave
                  </button>
                  <button onClick={() => { gameCmd("save"); setOpen(false); setTimeout(() => onRespawn?.(), 600); }} className="inline-flex flex-col items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2 py-3 text-sm font-bold text-white">
                    <RotateCcw className="w-5 h-5" /> Respawn
                  </button>
                  <button onClick={save} disabled={!isAuthenticated} className="inline-flex flex-col items-center gap-1 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-40 px-2 py-3 text-sm font-bold text-white" title={isAuthenticated ? "" : "Sign in to save"}>
                    <Save className="w-5 h-5" /> {saved ? "Saved!" : "Save progress"}
                  </button>
                </div>
              </>
            ) : (
              <BoardList name={name} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
