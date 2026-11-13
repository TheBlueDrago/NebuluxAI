import React, { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { START_FREE } from "@/components/PublicLayout";

// A game you can play right on the homepage, with no account. The game itself (one of the two that ship
// inside the app, so it needs no server) only loads after Play is pressed, so it never slows the page down.
// The box keeps the same height before and after, so nothing on the page jumps.
const Game = lazy(() =>
  Promise.all([import("@/components/PreviewFrame"), import("@/lib/builtInGames")]).then(([frame, games]) => {
    const g = games.findBuiltInGame("pulse") || games.BUILT_IN_GAMES[0];
    const Frame = frame.default;
    return { default: () => <Frame html={g.html} title={g.title} /> };
  })
);

export default function TryGame() {
  const [on, setOn] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <section className="mt-28 sm:mt-36" id="try">
      <div className="text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Try it right here</h2>
        <p className="mt-2 text-slate-400 max-w-xl mx-auto">Pulse Jump was made by describing it to Nebulux AI. Play it now: no account, no download.</p>
      </div>
      <div className="mt-6 mx-auto max-w-3xl rounded-2xl border border-slate-700/50 bg-slate-900/60 p-2 sm:p-3">
        <div className="relative w-full overflow-hidden rounded-xl bg-black h-[min(70vh,26rem)]" data-try-game>
          {on ? (
            <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
              <Game key={round} />
            </Suspense>
          ) : (
            <button
              type="button"
              onClick={() => setOn(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-indigo-600/40 via-slate-950 to-fuchsia-600/40 text-white"
            >
              <span className="w-16 h-16 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg"><Play className="w-7 h-7 ml-0.5" /></span>
              <span className="text-lg font-semibold">Play Pulse Jump</span>
              <span className="text-sm text-slate-300">Tap, click or press Space to jump</span>
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1 pt-3 pb-1">
          {on && (
            <button type="button" onClick={() => setRound((n) => n + 1)} className="tap-area inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-sm">
              <RotateCcw className="w-4 h-4" /> Restart
            </button>
          )}
          <Link to="/arcade" className="tap-area inline-flex items-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-sm">More games</Link>
          <span className="flex-1" />
          <Link to={START_FREE} className="tap-area inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-sm font-semibold hover:opacity-90">
            <Sparkles className="w-4 h-4" /> Sign up to make your own
          </Link>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">You only need an account to save your progress or make something.</p>
    </section>
  );
}
