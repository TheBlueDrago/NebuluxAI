import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Gamepad2, Flag, Sparkles, Trash2, Save, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { askConfirm } from "@/lib/dialogs";
import { useAuth } from "@/lib/AuthContext";
import { loadGame } from "@/lib/loadGame";
import { findBuiltInGame } from "@/lib/builtInGames";
import PreviewFrame from "@/components/PreviewFrame";
import GameMenu from "@/components/GameMenu";
import ShareLink from "@/components/designer/ShareLink";
import GameBoards from "@/components/GameBoards";
import { GAME_THUMBS } from "@/lib/gameThumbs";

// Public page for a shared game: anyone can play without an account, then make their own.
export default function Play() {
  const { name = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [game, setGame] = useState(null); // { html, title, genre } | { missing: "why" }
  const [resetKey, setResetKey] = useState(0);
  const navigate = useNavigate();
  // Built-in games and Nebulux's own 3D games can be copied into the Games Designer and changed.
  const canRemix = isAuthenticated && game && !game.missing && (findBuiltInGame(name) || GAME_THUMBS.has(name));
  const remix = () => navigate("/chat/game-designer", { state: findBuiltInGame(name) ? { fresh: true, remix: name } : { fresh: true, remixGame: { name, title: game.title || name, genre: game.genre, html: game.html } } });

  // Progress is kept with the account (components/PreviewFrame.jsx); only this deletes it.
  const deleteProgress = async () => {
    if (!(await askConfirm(`Delete your saved progress in ${game?.title || name}? This can't be undone.`, { confirmLabel: "Delete", danger: true }))) return;
    await base44.functions.invoke("game-save", { action: "delete", name }).catch(() => {});
    setResetKey((k) => k + 1);
  };

  useEffect(() => {
    const builtIn = findBuiltInGame(name);
    if (builtIn) {
      setGame({ html: builtIn.html, title: builtIn.title || name, genre: builtIn.genre });
      return;
    }
    let alive = true;
    loadGame(name)
      .then((d) => alive && setGame(!d ? { missing: "Game not found." } : d.removed ? { missing: d.removed } : d))
      .catch(() => alive && setGame({ missing: "Game not found." }));
    return () => {
      alive = false;
    };
  }, [name]);

  useEffect(() => {
    if (game?.title) document.title = `${game.title} · Nebulux AI`;
    return () => {
      document.title = "Nebulux AI";
    };
  }, [game?.title]);

  // New people land in an empty game chat with ideas to tap; signed-in people see the games page (their draft is kept).
  const makeYourOwn = isAuthenticated ? "/chat/games" : "/register?returnTo=" + encodeURIComponent("/chat/game-designer");

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-950 text-slate-100">
      <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-white/10">
        <GameMenu name={name} leaveTo="/" onRespawn={() => setResetKey((k) => k + 1)} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold truncate">{game?.title || name}</span>
          {game?.genre && <span className="hidden sm:inline text-xs text-slate-400 capitalize shrink-0">· {game.genre}</span>}
        </div>
        {canRemix && (
          <button onClick={remix} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs" title="Copy this game and change it by chatting with the AI">
            <Wand2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Remix</span>
          </button>
        )}
        {game && !game.missing && <GameBoards name={name} />}
        {game && !game.missing && (
          <ShareLink url={window.location.href} title={game.title || name} className="bg-white/10 hover:bg-white/20 text-slate-200 py-1.5" />
        )}
        {!findBuiltInGame(name) && game && !game.missing && (
          <a
            href={`/report?${new URLSearchParams({ kind: "game", name })}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-300 transition-colors"
            title="Report this game"
          >
            <Flag className="w-4 h-4" />
          </a>
        )}
        {game && !game.missing && (isAuthenticated ? (
          <button
            onClick={deleteProgress}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-300 transition-colors"
            title="Delete my saved progress in this game"
            aria-label="Delete my saved progress"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <Link
            to={"/login?returnTo=" + encodeURIComponent(`/play/${name}`)}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs"
            title="Your progress saves to your account when you're signed in"
          >
            <Save className="w-3.5 h-3.5" /> Sign in to save
          </Link>
        ))}
        <Link
          to={makeYourOwn}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-semibold hover:opacity-90"
        >
          <Sparkles className="w-3.5 h-3.5" /> Make your own
        </Link>
      </header>
      <div className="flex-1 relative bg-black">
        {!game ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : game.missing ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-6 text-center">
            <Gamepad2 className="w-10 h-10 mb-2" />
            <p>{game.missing}</p>
            <Link to="/" className="mt-4 text-sm text-indigo-300 hover:text-indigo-200">Make your own game with Nebulux AI</Link>
          </div>
        ) : (
          <PreviewFrame key={resetKey} html={game.html} title={game.title || name} saveName={name} />
        )}
      </div>
    </div>
  );
}
