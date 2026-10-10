import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Play, Search, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { builtInGameEntities } from "@/lib/builtInGames";
import PublicLayout from "@/components/PublicLayout";

const GENRES = ["io", "shooting", "horror", "action", "arcade", "puzzle", "racing", "sports", "adventure", "strategy"];
const GENRE_LABEL = { io: ".io" };
const label = (g) => GENRE_LABEL[g] || g.charAt(0).toUpperCase() + g.slice(1);
// A picture for each kind of game on its card.
const ICON = { io: "🟣", shooting: "🎯", horror: "👻", action: "⚔️", arcade: "🕹️", puzzle: "🧩", racing: "🏎️", sports: "⚽", adventure: "🗺️", strategy: "♟️" };
const THUMB = {
  io: "from-fuchsia-500 to-indigo-500",
  shooting: "from-red-500 to-orange-500",
  horror: "from-purple-700 to-slate-900",
  action: "from-amber-500 to-rose-500",
  arcade: "from-cyan-500 to-blue-500",
  puzzle: "from-emerald-500 to-teal-500",
  racing: "from-yellow-500 to-orange-500",
  sports: "from-green-500 to-emerald-600",
  adventure: "from-teal-500 to-cyan-600",
  strategy: "from-slate-500 to-slate-700",
};

// Public arcade: every game made with Nebulux AI, playable without an account
// (each opens /play/<name>). Shared game links and search engines bring players here.
export default function Arcade() {
  const { isAuthenticated } = useAuth();
  const [games, setGames] = useState(null);
  const [genre, setGenre] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const builtIns = builtInGameEntities();
    Promise.all([
      base44.entities.PublishedGame.list("-plays", 500).catch(() => []),
      base44.functions.invoke("game-plays").then((r) => r.data || {}).catch(() => ({})),
    ]).then(([list, counts]) => {
      const real = (list || []).filter((g) => !g.hidden && !(counts.takenDown || []).includes(g.name)).map((g) => ({ ...g, plays: counts.totals ? counts.totals[g.name] || 0 : (g.plays || 0) + ((counts.plays || {})[g.name] || 0) }));
      const names = new Set(real.map((g) => g.name));
      setGames([...builtIns.filter((g) => !names.has(g.name)), ...real].sort((a, b) => (b.plays || 0) - (a.plays || 0)));
    });
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (games || []).filter(
      (g) => (genre === "all" || g.genre === genre) && (!s || `${g.title || ""} ${g.name}`.toLowerCase().includes(s))
    );
  }, [games, genre, q]);
  const genresInUse = useMemo(() => GENRES.filter((id) => (games || []).some((g) => g.genre === id)), [games]);

  const make = isAuthenticated ? "/chat/games" : "/register?returnTo=" + encodeURIComponent("/chat/game-designer");

  return (
    <PublicLayout title="Free games made with AI">
      <section className="text-center pt-8 pb-8">
        <h1 className="text-3xl sm:text-5xl font-bold text-white">Free games, made with AI</h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">
          Play in your browser on a phone or computer. No download, no account. Every game here was made by describing it to Nebulux AI.
        </p>
      </section>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-700/60 focus-within:border-indigo-400/70 transition-colors">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games"
            className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...genresInUse].map((id) => (
            <button
              key={id}
              onClick={() => setGenre(id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                genre === id ? "bg-white text-slate-900 border-white" : "bg-slate-900/60 text-slate-300 border-slate-700/60 hover:text-white"
              }`}
            >
              {id === "all" ? "All" : label(id)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Link
          to={make}
          className="rounded-2xl border border-dashed border-fuchsia-400/50 bg-fuchsia-500/10 p-3 flex flex-col items-center justify-center text-center min-h-[11rem] hover:bg-fuchsia-500/20 transition-colors"
        >
          <Sparkles className="w-7 h-7 text-fuchsia-300" />
          <span className="mt-2 font-semibold text-white">Make your own</span>
          <span className="text-xs text-slate-400 mt-1">Describe a game and play it in minutes</span>
        </Link>
        {games &&
          shown.map((g) => (
            <Link
              key={g.id || g.name}
              to={`/play/${g.name}`}
              className="group rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3 hover:border-fuchsia-500/50 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(217,70,239,.6)] transition-all"
            >
              <div className={`relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br ${THUMB[g.genre] || "from-indigo-500 to-fuchsia-500"} flex items-center justify-center`}>
                {ICON[g.genre] ? <span className="text-5xl drop-shadow-lg transition-transform group-hover:scale-110" aria-hidden="true">{ICON[g.genre]}</span> : <Gamepad2 className="w-9 h-9 text-white/90" />}
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-xl">
                  <Play className="w-8 h-8 text-white" />
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-white truncate">{g.title || g.name}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {g.genre ? label(g.genre) : "Game"} · {g.plays || 0} plays
              </p>
            </Link>
          ))}
      </div>
      {!games && (
        <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      )}
      {games && shown.length === 0 && <p className="text-center text-slate-500 text-sm py-10">No games match that yet.</p>}
    </PublicLayout>
  );
}
