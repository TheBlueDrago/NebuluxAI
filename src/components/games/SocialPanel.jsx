import React, { useCallback, useEffect, useState } from "react";
import { X, Loader2, UserPlus, Check, Trash2, Copy, Gamepad2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Avatar editor and friends list for Nebulux Games (functions/.../social.js). Your avatar is worn
// in every game that supports it; friends see which game you're in and can jump into it.
const HATS = [
  ["none", "No hat"],
  ["straw", "Straw hat"],
  ["tricorn", "Pirate hat"],
  ["bandana", "Bandana"],
  ["helmet", "Helmet"],
  ["cap", "Cap"],
  ["crown", "Crown"],
];
const FACES = [
  ["smile", "🙂"],
  ["grin", "😁"],
  ["cool", "😎"],
  ["angry", "😠"],
  ["wink", "😉"],
];
const SWATCHES = {
  skin: ["#ffdbac", "#f5c99a", "#e0ac69", "#c68642", "#8d5524", "#5c3a21"],
  shirt: ["#d62828", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#fb8c00", "#212121", "#ffffff"],
  pants: ["#2a4a8a", "#263238", "#3e2723", "#1b5e20", "#4a148c", "#9e9e9e"],
  hatColor: ["#f2c94c", "#c0392b", "#2c3e50", "#16a085", "#f39c12", "#ffffff", "#7b1fa2"],
};
const gameName = (g) => String(g || "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

// A small blocky figure drawn with boxes, the same colours the games use.
export function AvatarFigure({ a, size = 1 }) {
  const s = (n) => n * size;
  const face = (FACES.find((f) => f[0] === a.face) || FACES[0])[1];
  return (
    <div className="relative mx-auto" style={{ width: s(72), height: s(132) }} aria-hidden="true">
      {a.hat !== "none" && (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-t-md"
          style={{ top: s(a.hat === "straw" || a.hat === "tricorn" ? 2 : 6), width: s(a.hat === "straw" ? 48 : a.hat === "tricorn" ? 44 : 32), height: s(a.hat === "crown" ? 10 : 9), background: a.hatColor, clipPath: a.hat === "crown" ? "polygon(0 100%,0 0,20% 60%,50% 0,80% 60%,100% 0,100% 100%)" : undefined }}
        />
      )}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-md flex items-center justify-center" style={{ top: s(12), width: s(30), height: s(30), background: a.skin, fontSize: s(16) }}>
        {face}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 rounded" style={{ top: s(44), width: s(40), height: s(42), background: a.shirt }} />
      <div className="absolute rounded" style={{ top: s(44), left: s(4), width: s(12), height: s(38), background: a.skin }} />
      <div className="absolute rounded" style={{ top: s(44), right: s(4), width: s(12), height: s(38), background: a.skin }} />
      <div className="absolute rounded" style={{ top: s(88), left: s(17), width: s(18), height: s(42), background: a.pants }} />
      <div className="absolute rounded" style={{ top: s(88), right: s(17), width: s(18), height: s(42), background: a.pants }} />
    </div>
  );
}

function AvatarTab() {
  const [a, setA] = useState(null);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    base44.functions.invoke("social", { action: "avatar" }).then((r) => setA(r?.data?.avatar)).catch(() => setA({ skin: "#f5c99a", shirt: "#d62828", pants: "#2a4a8a", hat: "straw", hatColor: "#f2c94c", face: "smile" }));
  }, []);
  if (!a) return <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const set = (k, v) => {
    setA((x) => ({ ...x, [k]: v }));
    setSaved("");
  };
  const save = async () => {
    setSaved("saving");
    const r = await base44.functions.invoke("social", { action: "setAvatar", avatar: a }).catch(() => null);
    setSaved(r?.data?.avatar ? "saved" : "error");
  };
  const Row = ({ k, label }) => (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SWATCHES[k].map((c) => (
          <button key={c} type="button" onClick={() => set(k, c)} aria-label={`${label} ${c}`} className={`w-7 h-7 rounded-full border-2 ${a[k] === c ? "border-white scale-110" : "border-white/20"} transition-transform`} style={{ background: c }} />
        ))}
        <input type="color" value={a[k]} onChange={(e) => set(k, e.target.value)} aria-label={`Any ${label.toLowerCase()} colour`} className="w-7 h-7 rounded-full bg-transparent cursor-pointer" />
      </div>
    </div>
  );
  return (
    <div className="grid sm:grid-cols-[160px_1fr] gap-5">
      <div className="rounded-2xl bg-gradient-to-b from-sky-400/30 to-emerald-400/20 border border-white/10 py-5">
        <AvatarFigure a={a} size={1.6} />
      </div>
      <div className="space-y-4">
        <Row k="skin" label="Skin" />
        <Row k="shirt" label="Shirt" />
        <Row k="pants" label="Pants" />
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hat</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {HATS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => set("hat", id)} className={`px-2.5 py-1 rounded-full text-xs ${a.hat === id ? "bg-white text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {a.hat !== "none" && <Row k="hatColor" label="Hat colour" />}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Face</p>
          <div className="mt-1.5 flex gap-1.5">
            {FACES.map(([id, e]) => (
              <button key={id} type="button" onClick={() => set("face", id)} aria-label={`Face ${id}`} className={`w-9 h-9 rounded-lg text-lg ${a.face === id ? "bg-white/30 ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={save} disabled={saved === "saving"} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-60">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved! Wear it in your games" : saved === "error" ? "Couldn't save, try again" : "Save avatar"}
        </button>
      </div>
    </div>
  );
}

function FriendsTab({ onPlay }) {
  const [d, setD] = useState(null);
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => base44.functions.invoke("social", { action: "friends" }).then((r) => setD(r?.data)).catch(() => setD({ friends: [], incoming: [], outgoing: [], code: "" })), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);
  const act = async (action, extra) => {
    const r = await base44.functions.invoke("social", { action, ...extra }).catch((e) => e?.response || null);
    if (r?.data?.error) setNote(r.data.error);
    else if (action === "add") setNote(r?.data?.friends ? "You're friends now!" : "Friend request sent.");
    load();
  };
  if (!d) return <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const playing = d.friends.filter((f) => f.playing);
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400">Your friend code</p>
          <p className="font-mono text-lg font-bold text-white tracking-widest">{d.code}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(d.code).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (who.trim()) act("add", { who: who.trim() }).then(() => setWho(""));
        }}
        className="flex gap-2"
      >
        <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Friend code or username" maxLength={80} className="flex-1 min-w-0 rounded-xl bg-white/5 border border-white/10 focus:border-white/40 outline-none px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" />
        <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white text-sm font-semibold">
          <UserPlus className="w-4 h-4" /> Add
        </button>
      </form>
      {note && <p className="text-sm text-amber-200">{note}</p>}

      {d.incoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Friend requests</p>
          {d.incoming.map((f) => (
            <div key={f.id} className="mt-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="flex-1 truncate text-white">{f.name}</span>
              <button onClick={() => act("accept", { id: f.id })} className="px-3 py-1 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-semibold">Accept</button>
              <button onClick={() => act("remove", { id: f.id })} className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs">Decline</button>
            </div>
          ))}
        </div>
      )}

      {playing.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Playing now</p>
          {playing.map((f) => (
            <div key={f.id} className="mt-2 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 px-3 py-2">
              <div className="w-8 h-8 rounded-lg" style={{ background: f.avatar.shirt }} />
              <span className="flex-1 min-w-0 truncate text-white">
                {f.name} <span className="text-slate-400 text-sm">· {gameName(f.playing)}</span>
              </span>
              <button onClick={() => onPlay(f.playing)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold">
                <Gamepad2 className="w-3.5 h-3.5" /> Join
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Friends ({d.friends.length})</p>
        {!d.friends.length && <p className="mt-2 text-sm text-slate-400">No friends yet. Share your friend code, or add someone by theirs.</p>}
        {d.friends.map((f) => (
          <div key={f.id} className="mt-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <span className={`w-2.5 h-2.5 rounded-full ${f.online ? "bg-emerald-400" : "bg-slate-600"}`} title={f.online ? "Online" : "Offline"} />
            <span className="flex-1 min-w-0 truncate text-white">{f.name}</span>
            <span className="text-xs text-slate-400">{f.playing ? gameName(f.playing) : f.online ? "Online" : "Offline"}</span>
            <button onClick={() => act("remove", { id: f.id })} title="Remove friend" aria-label={`Remove ${f.name}`} className="p-1 rounded text-slate-500 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {d.outgoing.length > 0 && <p className="mt-3 text-xs text-slate-500">Waiting for: {d.outgoing.map((f) => f.name).join(", ")}</p>}
      </div>
      <p className="text-[11px] text-slate-500">Friends can only see your username, your avatar and which game you're playing. There's no chat.</p>
    </div>
  );
}

export default function SocialPanel({ tab: start = "avatar", onClose, onPlay }) {
  const [tab, setTab] = useState(start);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Avatar and friends" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-slate-900 border border-white/10 shadow-2xl p-5">
        <div className="flex items-center gap-2">
          {[
            ["avatar", "Avatar"],
            ["friends", "Friends"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${tab === id ? "bg-white text-slate-900" : "text-slate-300 hover:bg-white/10"}`}>
              {label}
            </button>
          ))}
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-5">{tab === "avatar" ? <AvatarTab /> : <FriendsTab onPlay={onPlay} />}</div>
      </div>
    </div>
  );
}
