import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, Search, Plus, Settings, Gamepad2, Flame, Sparkles, Ghost, Crosshair,
  Puzzle, Car, Trophy, Sword, Compass, Brain, Zap, Play, Home as HomeIcon, Loader2,
} from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { base44 } from "@/api/base44Client";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { onGamesChanged } from "@/lib/gameEvents";
import { builtInGameEntities } from "@/lib/builtInGames";

const GENRES = [
  { id: "io", label: ".io", icon: Zap },
  { id: "shooting", label: "Shooting", icon: Crosshair },
  { id: "horror", label: "Horror", icon: Ghost },
  { id: "action", label: "Action", icon: Sword },
  { id: "arcade", label: "Arcade", icon: Gamepad2 },
  { id: "puzzle", label: "Puzzle", icon: Puzzle },
  { id: "racing", label: "Racing", icon: Car },
  { id: "sports", label: "Sports", icon: Trophy },
  { id: "adventure", label: "Adventure", icon: Compass },
  { id: "strategy", label: "Strategy", icon: Brain },
];
const GENRE_LABEL = Object.fromEntries(GENRES.map((g) => [g.id, g.label]));
const RAILS = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "new", label: "New", icon: Sparkles },
  { id: "top", label: "Top", icon: Flame },
  ...GENRES,
];

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
const thumb = (g) => THUMB[g.genre] || "from-indigo-500 to-fuchsia-500";
const genreIcon = (g) => (GENRES.find((x) => x.id === g.genre) || {}).icon || Gamepad2;

// Every genre shares one gradient, so a genre row of same-genre games looked
// like the same tile repeated. Hashing the name into a hue shift gives each
// game its own tint of that genre's palette without needing real cover art.
function nameHue(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}
const thumbStyle = (g) => ({ filter: `hue-rotate(${nameHue(g.name) - 180}deg)` });

const isNew = (g) => g.created_date && Date.now() - new Date(g.created_date).getTime() < 7 * 24 * 60 * 60 * 1000;

function NewBadge() {
  return (
    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold uppercase tracking-wider text-white shadow">
      New
    </span>
  );
}

function GameCard({ g, onPlay }) {
  const Icon = genreIcon(g);
  return (
    <button onClick={() => onPlay(g.name)} className="group text-left">
      <div
        className={`relative aspect-square rounded-xl bg-gradient-to-br ${thumb(g)} overflow-hidden ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.04] group-hover:ring-white/25`}
        style={thumbStyle(g)}
      >
        {isNew(g) && <NewBadge />}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-8 h-8 text-white/70" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-slate-900" />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs font-medium text-slate-200 truncate">{g.title || g.name}</p>
      <p className="text-[10px] text-slate-400">{GENRE_LABEL[g.genre] || "Game"} · {g.plays || 0} plays</p>
    </button>
  );
}

function FeaturedCard({ g, onPlay }) {
  const Icon = genreIcon(g);
  return (
    <button onClick={() => onPlay(g.name)} className="group text-left w-full">
      <div
        className={`relative aspect-video rounded-2xl bg-gradient-to-br ${thumb(g)} overflow-hidden ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-[1.02]`}
        style={thumbStyle(g)}
      >
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/40 px-2 py-1 rounded text-white/90">#1 Featured</span>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-16 h-16 text-white/70" />
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-8 h-8 text-slate-900" />
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-2xl font-extrabold text-white drop-shadow truncate">{g.title || g.name}</p>
          <p className="text-xs text-white/80">{GENRE_LABEL[g.genre] || "Game"} · {g.plays || 0} plays</p>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center mb-4">
        <Gamepad2 className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-white">No games yet</h2>
      <p className="text-slate-500 text-sm mt-1">Be the first to create a game with AI.</p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Plus className="w-4 h-4" /> Create a game
      </button>
    </div>
  );
}

export default function GamesFront() {
  const shell = useAppShell();
  const { sidebarOpen, setSidebarOpen, openProfile, avatarInitial, lightMode, toggleLight, navigate, goGameDesigner, conv, credits, isAdmin } = shell;
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("home");
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = async () => {
    const builtIns = builtInGameEntities();
    try {
      const [list, counts] = await Promise.all([
        base44.entities.PublishedGame.list("-plays", 500),
        // Plays to show and rank by: `totals` (functions/game-plays.js) counts on the server and
        // ignores the plays field owners can edit on their own game's record.
        base44.functions.invoke("game-plays").then((r) => r.data || {}).catch(() => ({})),
      ]);
      const real = (list || []).filter((g) => !g.hidden && !(counts.takenDown || []).includes(g.name)).map((g) => ({ ...g, plays: counts.totals ? counts.totals[g.name] || 0 : (g.plays || 0) + ((counts.plays || {})[g.name] || 0) }));
      const realNames = new Set(real.map((g) => g.name));
      setGames([...builtIns.filter((g) => !realNames.has(g.name)), ...real]);
    } catch {
      setGames(builtIns);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    return onGamesChanged(load);
  }, []);

  // Games this account has saved progress in (functions/.../game-save.js), for "Continue playing".
  const [progressIn, setProgressIn] = useState([]);
  useEffect(() => {
    base44.functions
      .invoke("game-save", { action: "list" })
      .then((r) => setProgressIn(Object.entries(r.data?.saves || {}).filter(([, d]) => d && Object.keys(d).length).map(([n]) => n)))
      .catch(() => {});
  }, []);
  const continuing = useMemo(() => progressIn.map((n) => games.find((g) => g.name === n)).filter(Boolean).slice(0, 6), [progressIn, games]);

  const filtered = useMemo(() => {
    let g = games;
    if (q.trim()) {
      const s = q.toLowerCase();
      g = g.filter((x) => (x.title || x.name).toLowerCase().includes(s));
    }
    if (cat === "new") return [...g].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    if (cat === "top") return [...g].sort((a, b) => (b.plays || 0) - (a.plays || 0));
    if (GENRES.some((x) => x.id === cat)) return g.filter((x) => x.genre === cat);
    return g;
  }, [games, cat, q]);

  const ranked = useMemo(() => [...games].sort((a, b) => (b.plays || 0) - (a.plays || 0)), [games]);
  // The top game by plays. (A record's own "featured" field isn't used: owners can set it on
  // their own games.)
  const featured = useMemo(() => ranked[0] || null, [ranked]);
  const mediumTop = useMemo(() => ranked.filter((g) => g.id !== (featured && featured.id)).slice(0, 5), [ranked, featured]);
  const showTop = cat === "home";
  const play = (name) => navigate(`/chat/game/${name}`);
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      {sidebarOpen && <Sidebar />}

      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-white/10 bg-slate-950/90 backdrop-blur z-30">
        <button onClick={() => setSidebarOpen((o) => !o)} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Menu" aria-label="Menu: chats and tools">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight hidden sm:inline">Nebulux <span className="text-fuchsia-400">Games</span></span>
        </div>
        <div className="flex-1 min-w-0 max-w-md mx-auto">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 focus-within:border-white/40 rounded-lg px-3 h-9 transition-colors">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search games"
              className="bg-transparent outline-none text-sm flex-1 min-w-0 h-full text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>
        <ThemeToggle light={lightMode} onToggle={toggleLight} />
        <button
          onClick={goGameDesigner}
          title="Create a game"
          className="shrink-0 inline-flex items-center gap-1.5 pl-2.5 pr-2.5 sm:pr-3 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create</span>
        </button>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="keep-color w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white"
            title="Account" aria-label="Your profile and settings"
          >
            {avatarInitial}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50"
              >
                <button
                  onClick={() => { setMenuOpen(false); openProfile("main"); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left rail */}
        <nav className="w-16 sm:w-52 shrink-0 border-r border-white/10 bg-slate-950 overflow-y-auto sidebar-scroll py-2">
          {RAILS.map((r) => {
            const Icon = r.icon;
            const active = cat === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setCat(r.id)}
                title={r.label}
                aria-label={r.label}
                aria-pressed={active}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden sm:inline">{r.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-y-auto sidebar-scroll p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <EmptyState onCreate={goGameDesigner} />
          ) : (
            <>
              {showTop && !q.trim() && continuing.length > 0 && (
                <section className="mb-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <Play className="w-4 h-4 text-emerald-400" /> Continue playing
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {continuing.map((g) => (
                      <GameCard key={g.id || g.name} g={g} onPlay={play} />
                    ))}
                  </div>
                </section>
              )}
              {showTop && games.length > 0 && (
                <section className="mb-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <Flame className="w-4 h-4 text-orange-400" /> Top Games
                  </h2>
                  <div className="flex flex-col lg:flex-row gap-4">
                    {featured && (
                      <div className="lg:w-[42%]">
                        <FeaturedCard g={featured} onPlay={play} />
                      </div>
                    )}
                    <div className="lg:flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediumTop.map((g) => (
                        <GameCard key={g.id} g={g} onPlay={play} />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {cat === "home" ? (
                GENRES.map((genre) => {
                  const list = games.filter((g) => g.genre === genre.id);
                  if (!list.length) return null;
                  const Icon = genre.icon;
                  return (
                    <section key={genre.id} className="mb-6">
                      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                        <Icon className="w-4 h-4" /> {genre.label}
                      </h2>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {list.map((g) => (
                          <GameCard key={g.id} g={g} onPlay={play} />
                        ))}
                      </div>
                    </section>
                  );
                })
              ) : (
                <section>
                  <h2 className="text-sm font-semibold text-slate-300 mb-3">{RAILS.find((r) => r.id === cat)?.label} Games</h2>
                  {filtered.length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {filtered.map((g) => (
                        <GameCard key={g.id} g={g} onPlay={play} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm">No games here yet.</p>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}