import React, { useEffect, useRef, useState } from "react";
import { Trophy, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// The leaderboards a game keeps (functions/.../game-board.js), shown from the game page's header
// so people can see them without playing. Only games listed here have boards.
const BOARDS = {
  "sky-obby": [["stage", "Highest stage", (v) => `Stage ${v}`], ["time", "Fastest finish", (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`]],
  "fruit-seas": [["level", "Top levels", (v) => `Lv. ${v}`]],
  "bed-brawl": [["wins", "Most wins", String]],
  "brawl-blitz": [["wins", "Most wins", String]],
  "storm-royale": [["wins", "Most wins", String]],
  "villain-battlegrounds": [["kills", "Most K.O.s", String]],
};

export default function GameBoards({ name }) {
  const boards = BOARDS[name];
  const { user } = useAuth();
  const me = String(user?.full_name || "").trim();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [lists, setLists] = useState({});
  const box = useRef(null);

  useEffect(() => {
    if (!open || !boards) return;
    const [board] = boards[tab];
    let alive = true;
    base44.functions
      .invoke("game-board", { action: "top", name, board })
      .then((r) => alive && setLists((l) => ({ ...l, [board]: r?.data?.top || [] })))
      .catch(() => alive && setLists((l) => ({ ...l, [board]: [] })));
    return () => {
      alive = false;
    };
  }, [open, tab, name, boards]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.key === "Escape" || (e.type === "pointerdown" && box.current && !box.current.contains(e.target))) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  if (!boards) return null;
  const [board, , show] = boards[tab];
  const list = lists[board];
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-2 rounded-lg transition-colors ${open ? "bg-amber-400/20 text-amber-300" : "text-slate-400 hover:bg-white/10 hover:text-amber-300"}`}
        title="Leaderboard"
        aria-label="Leaderboard"
        aria-expanded={open}
      >
        <Trophy className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-slate-900/95 backdrop-blur border border-amber-400/30 shadow-2xl shadow-black/50 p-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-300" />
            <span className="flex-1 font-semibold text-white">Leaderboard</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          {boards.length > 1 && (
            <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-1">
              {boards.map(([b, label], i) => (
                <button key={b} onClick={() => setTab(i)} className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${i === tab ? "bg-amber-400/20 text-amber-200" : "text-slate-400 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 min-h-[120px]">
            {!list ? (
              <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !list.length ? (
              <p className="py-8 text-center text-sm text-slate-400">No scores yet. Be the first!</p>
            ) : (
              <ol className="space-y-1">
                {list.map((r, i) => (
                  <li key={i} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${me && r.name === me ? "bg-amber-400/15" : ""}`}>
                    <span className={`w-5 text-center font-bold ${["text-amber-300", "text-slate-200", "text-orange-400"][i] || "text-slate-500"}`}>{i + 1}</span>
                    <span className="flex-1 truncate text-white">{r.name}</span>
                    <span className="font-semibold text-emerald-300">{show(r.score)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500 text-center">{user ? "Play to get on the board." : "Sign in to get on the board."}</p>
        </div>
      )}
    </div>
  );
}
