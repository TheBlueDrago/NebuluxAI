import React, { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { AvatarFigure } from "@/components/games/SocialPanel";

// The top of the Games home page (like other game platforms): your friends' avatars, who's online
// and what they're playing. Tap a friend in a game to join them; the + opens Friends to add more.
export default function FriendsRow({ onAdd, onPlay }) {
  const [friends, setFriends] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      base44.functions
        .invoke("social", { action: "friends" })
        .then((r) => alive && setFriends(r?.data?.friends || []))
        .catch(() => alive && setFriends([]));
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (!friends) return null;
  const sorted = [...friends].sort((a, b) => (b.playing ? 2 : b.online ? 1 : 0) - (a.playing ? 2 : a.online ? 1 : 0));
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-3">Friends ({friends.length})</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <button onClick={onAdd} className="shrink-0 w-20 flex flex-col items-center gap-1.5 group" title="Add friends">
          <span className="w-16 h-16 rounded-full border-2 border-dashed border-white/25 group-hover:border-white/60 flex items-center justify-center transition-colors">
            <UserPlus className="w-6 h-6 text-slate-300" />
          </span>
          <span className="text-xs text-slate-400">Add friends</span>
        </button>
        {sorted.map((f) => (
          <button key={f.id} onClick={() => f.playing && onPlay(f.playing)} className={`shrink-0 w-20 flex flex-col items-center gap-1.5 ${f.playing ? "cursor-pointer" : "cursor-default"}`} title={f.playing ? `Join ${f.name}` : f.name}>
            <span className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-b from-sky-400/40 to-emerald-400/30 border border-white/10">
              <span className="absolute left-1/2 top-1 -translate-x-1/2">
                <AvatarFigure a={f.avatar} size={0.5} />
              </span>
              <span className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-slate-950 ${f.playing ? "bg-emerald-400" : f.online ? "bg-sky-400" : "bg-slate-600"}`} />
            </span>
            <span className="text-xs text-white truncate w-full text-center">{f.name}</span>
            {f.playing && <span className="-mt-1 text-[10px] text-emerald-300 truncate w-full text-center">In a game</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
