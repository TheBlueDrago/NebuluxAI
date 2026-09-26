import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Gamepad2, Flag, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { loadGame } from "@/lib/loadGame";
import { findBuiltInGame } from "@/lib/builtInGames";
import PreviewFrame from "@/components/PreviewFrame";
import BlackholeIcon from "@/components/BlackholeIcon";
import ShareLink from "@/components/designer/ShareLink";

// Public page for a shared game: anyone can play without an account, then make their own.
export default function Play() {
  const { name = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [game, setGame] = useState(null); // { html, title, genre } | { missing: "why" }

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
        <Link to="/" className="shrink-0 w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" title="Nebulux AI">
          <BlackholeIcon className="w-full h-full" />
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold truncate">{game?.title || name}</span>
          {game?.genre && <span className="hidden sm:inline text-xs text-slate-400 capitalize shrink-0">· {game.genre}</span>}
        </div>
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
          <PreviewFrame html={game.html} title={game.title || name} />
        )}
      </div>
    </div>
  );
}
