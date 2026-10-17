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
  ["tophat", "Top hat"],
  ["headphones", "Headphones"],
  ["viking", "Viking helmet"],
  ["wizard", "Wizard hat"],
  ["halo", "Halo"],
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

// A blocky figure, the same colours the games use: shaded plastic parts, sleeves, shoes and the hat.
const shade = (c, k) => {
  const n = parseInt(String(c).slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
};
const plastic = (c) => ({ background: `linear-gradient(135deg, ${shade(c, 1.18)} 0%, ${c} 45%, ${shade(c, 0.8)} 100%)`, boxShadow: "inset 0 -2px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.18)" });
function Hat({ a, s }) {
  const c = a.hatColor, base = { position: "absolute", left: "50%", transform: "translateX(-50%)" };
  switch (a.hat) {
    case "straw":
      return <><div style={{ ...base, top: s(9), width: s(50), height: s(5), borderRadius: s(3), ...plastic(c) }} /><div style={{ ...base, top: s(2), width: s(30), height: s(9), borderRadius: s(4) + "px " + s(4) + "px 0 0", ...plastic(c) }} /><div style={{ ...base, top: s(8), width: s(30), height: s(3), background: "#d62828" }} /></>;
    case "tricorn":
      return <><div style={{ ...base, top: s(6), width: s(46), height: s(7), borderRadius: s(3), ...plastic(c) }} /><div style={{ ...base, top: s(0), width: s(30), height: s(9), borderRadius: s(3) + "px " + s(3) + "px 0 0", ...plastic(c) }} /><div style={{ ...base, top: s(2), width: s(6), height: s(5), background: "#fff", borderRadius: 2 }} /></>;
    case "bandana":
      return <div style={{ ...base, top: s(10), width: s(32), height: s(8), borderRadius: s(2), ...plastic(c) }} />;
    case "helmet":
      return <div style={{ ...base, top: s(6), width: s(34), height: s(14), borderRadius: s(8) + "px " + s(8) + "px " + s(2) + "px " + s(2) + "px", ...plastic(c) }} />;
    case "cap":
      return <><div style={{ ...base, top: s(6), width: s(32), height: s(10), borderRadius: s(8) + "px " + s(8) + "px 0 0", ...plastic(c) }} /><div style={{ position: "absolute", top: s(14), left: "50%", width: s(20), height: s(4), borderRadius: s(2), ...plastic(c) }} /></>;
    case "crown":
      return <div style={{ ...base, top: s(1), width: s(32), height: s(13), clipPath: "polygon(0 100%,0 15%,20% 60%,35% 5%,50% 55%,65% 5%,80% 60%,100% 15%,100% 100%)", ...plastic(c) }} />;
    case "tophat":
      return <><div style={{ ...base, top: s(9), width: s(42), height: s(5), borderRadius: s(2), ...plastic(c) }} /><div style={{ ...base, top: s(-12), width: s(28), height: s(23), borderRadius: s(2), ...plastic(c) }} /><div style={{ ...base, top: s(4), width: s(28), height: s(4), background: "#c62828" }} /></>;
    case "headphones":
      return <><div style={{ ...base, top: s(4), width: s(36), height: s(18), border: `${s(4)}px solid ${c}`, borderBottom: "none", borderRadius: s(18) + "px " + s(18) + "px 0 0" }} /><div style={{ position: "absolute", top: s(18), left: s(16), width: s(8), height: s(12), borderRadius: s(3), ...plastic(c) }} /><div style={{ position: "absolute", top: s(18), right: s(16), width: s(8), height: s(12), borderRadius: s(3), ...plastic(c) }} /></>;
    case "viking":
      return <><div style={{ ...base, top: s(4), width: s(34), height: s(14), borderRadius: s(16) + "px " + s(16) + "px " + s(2) + "px " + s(2) + "px", ...plastic(c) }} /><div style={{ position: "absolute", top: s(-2), left: s(10), width: s(8), height: s(14), borderRadius: s(8) + "px 0 0 0", background: "#f5f5f5", transform: "rotate(-25deg)" }} /><div style={{ position: "absolute", top: s(-2), right: s(10), width: s(8), height: s(14), borderRadius: "0 " + s(8) + "px 0 0", background: "#f5f5f5", transform: "rotate(25deg)" }} /></>;
    case "wizard":
      return <><div style={{ ...base, top: s(-16), width: s(30), height: s(28), clipPath: "polygon(50% 0,100% 100%,0 100%)", ...plastic(c) }} /><div style={{ ...base, top: s(9), width: s(44), height: s(5), borderRadius: s(3), ...plastic(c) }} /><div style={{ ...base, top: s(-4), width: s(5), height: s(5), background: "#ffd54f", borderRadius: "50%" }} /></>;
    case "halo":
      return <div style={{ ...base, top: s(-6), width: s(30), height: s(8), borderRadius: "50%", border: `${s(3)}px solid ${c}`, boxShadow: `0 0 ${s(8)}px ${c}` }} />;
    default:
      return null;
  }
}
export function AvatarFigure({ a, size = 1 }) {
  const s = (n) => n * size;
  const face = (FACES.find((f) => f[0] === a.face) || FACES[0])[1];
  const part = (style, c, r = 3) => <div className="absolute" style={{ borderRadius: s(r), ...plastic(c), ...style }} />;
  return (
    <div className="relative mx-auto" style={{ width: s(72), height: s(140) }} aria-hidden="true">
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" style={{ top: s(12), width: s(30), height: s(30), borderRadius: s(7), ...plastic(a.skin), fontSize: s(16) }}>
        {face}
      </div>
      <Hat a={a} s={s} />
      {part({ top: s(44), left: s(16), width: s(40), height: s(42) }, a.shirt)}
      {part({ top: s(44), left: s(3), width: s(12), height: s(14) }, a.shirt)}
      {part({ top: s(44), right: s(3), width: s(12), height: s(14) }, a.shirt)}
      {part({ top: s(58), left: s(3), width: s(12), height: s(26) }, a.skin)}
      {part({ top: s(58), right: s(3), width: s(12), height: s(26) }, a.skin)}
      {part({ top: s(87), left: s(17), width: s(18), height: s(44) }, a.pants)}
      {part({ top: s(87), right: s(17), width: s(18), height: s(44) }, a.pants)}
      {part({ top: s(128), left: s(16), width: s(20), height: s(8) }, "#3a3a3a")}
      {part({ top: s(128), right: s(16), width: s(20), height: s(8) }, "#3a3a3a")}
    </div>
  );
}

const DEFAULT_LOOK = { skin: "#f5c99a", shirt: "#d62828", pants: "#2a4a8a", hat: "straw", hatColor: "#f2c94c", face: "smile" };
// The Stardust shop (prices from the server): { stardust, owned, prices, dailyReady, dailyAmount, playLeft }
function useShop() {
  const [shop, setShop] = useState(null);
  const load = useCallback(
    () =>
      base44.functions
        .invoke("social", { action: "shop" })
        .then((r) => setShop({ stardust: r?.data?.nebux ?? 0, owned: r?.data?.owned || [], prices: r?.data?.prices || {}, dailyReady: !!r?.data?.dailyReady, dailyAmount: r?.data?.dailyAmount || 0, playLeft: r?.data?.playLeft ?? 0 }))
        .catch(() => setShop({ stardust: 0, owned: [], prices: {}, dailyReady: false, dailyAmount: 0, playLeft: 0 })),
    []
  );
  useEffect(() => {
    load();
  }, [load]);
  return [shop, load];
}
const locked = (shop, item) => !!(shop && item in shop.prices && !shop.owned.includes(item));
const Star = () => <span aria-hidden="true">✨</span>;

function AvatarTab({ goShop }) {
  const [a, setA] = useState(null);
  const [saved, setSaved] = useState("");
  const [shop] = useShop();
  useEffect(() => {
    base44.functions.invoke("social", { action: "avatar" }).then((r) => setA(r?.data?.avatar || DEFAULT_LOOK)).catch(() => setA(DEFAULT_LOOK));
  }, []);
  if (!a || !shop) return <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const set = (k, v) => {
    setA((x) => ({ ...x, [k]: v }));
    setSaved("");
  };
  const needs = [["hat:" + a.hat], ["face:" + a.face]].map(([i]) => i).filter((i) => locked(shop, i));
  const save = async () => {
    if (needs.length) return;
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
  const Lock = ({ item }) => (locked(shop, item) ? <span className="ml-1 text-[10px] opacity-80"><Star />{shop.prices[item]}</span> : null);
  return (
    <div className="grid sm:grid-cols-[170px_1fr] gap-5">
      <div className="rounded-2xl bg-gradient-to-b from-sky-400/40 via-sky-300/20 to-emerald-400/25 border border-white/10 pt-8 pb-4">
        <AvatarFigure a={a} size={1.6} />
        <p className="mt-3 text-center text-sm font-semibold text-white"><Star /> {shop.stardust.toLocaleString()} Stardust</p>
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
                <Lock item={"hat:" + id} />
              </button>
            ))}
          </div>
        </div>
        {a.hat !== "none" && <Row k="hatColor" label="Hat colour" />}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Face</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FACES.map(([id, e]) => (
              <button key={id} type="button" onClick={() => set("face", id)} aria-label={`Face ${id}`} className={`relative w-9 h-9 rounded-lg text-lg ${a.face === id ? "bg-white/30 ring-2 ring-white" : "bg-white/10 hover:bg-white/20"}`}>
                {e}
                {locked(shop, "face:" + id) && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
              </button>
            ))}
          </div>
        </div>
        {needs.length > 0 ? (
          <button onClick={goShop} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400">
            Get it in the Shop first <Star />
          </button>
        ) : (
          <button onClick={save} disabled={saved === "saving"} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-60">
            {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved! Wear it in your games" : saved === "error" ? "Couldn't save, try again" : "Save avatar"}
          </button>
        )}
      </div>
    </div>
  );
}

const ITEM_NAMES = Object.fromEntries([...HATS.map(([id, l]) => ["hat:" + id, l]), ...FACES.map(([id, e]) => ["face:" + id, `${e} ${id.charAt(0).toUpperCase() + id.slice(1)} face`])]);
function ShopTab() {
  const [shop, load] = useShop();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [look, setLook] = useState(DEFAULT_LOOK);
  useEffect(() => {
    base44.functions.invoke("social", { action: "avatar" }).then((r) => r?.data?.avatar && setLook(r.data.avatar)).catch(() => {});
  }, []);
  if (!shop) return <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const call = async (action, extra, what) => {
    setBusy(what);
    setNote("");
    const r = await base44.functions.invoke("social", { action, ...extra }).catch((e) => e?.response || null);
    if (r?.data?.error) setNote(r.data.error);
    await load();
    setBusy("");
    return r?.data;
  };
  const wear = async (item) => {
    const [kind, id] = item.split(":");
    const next = { ...look, [kind]: id };
    const r = await call("setAvatar", { avatar: next }, item);
    if (r?.avatar) {
      setLook(r.avatar);
      setNote(`You're wearing it! It shows in your games.`);
    }
  };
  const items = Object.entries(shop.prices).sort((x, y) => x[1] - y[1]);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-fuchsia-500/20 border border-amber-300/30 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-white"><Star /> {shop.stardust.toLocaleString()}</p>
          <p className="text-xs text-slate-300">Stardust · earn it by playing ({shop.playLeft} more today) and from your daily gift</p>
        </div>
        <button onClick={() => call("daily", {}, "daily")} disabled={!shop.dailyReady || busy === "daily"} className="px-4 py-2 rounded-xl bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 disabled:opacity-50">
          {shop.dailyReady ? `Claim daily +${shop.dailyAmount}` : "Daily claimed ✓"}
        </button>
      </div>
      {note && <p className="text-sm text-amber-200">{note}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(([item, price]) => {
          const [kind, id] = item.split(":"), have = shop.owned.includes(item), wearing = look[kind] === id;
          return (
            <div key={item} className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col">
              <div className="rounded-xl bg-gradient-to-b from-sky-400/30 to-emerald-400/20 pt-6 pb-1 overflow-hidden">
                <AvatarFigure a={{ ...look, [kind]: id }} size={0.75} />
              </div>
              <p className="mt-2 text-sm font-semibold text-white truncate">{ITEM_NAMES[item] || id}</p>
              {have ? (
                <button onClick={() => wear(item)} disabled={wearing || busy === item} className="mt-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-60">
                  {wearing ? "Wearing" : "Wear"}
                </button>
              ) : (
                <button onClick={() => call("buy", { item }, item)} disabled={busy === item || shop.stardust < price} className="mt-2 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-fuchsia-500 text-xs font-bold text-slate-900 disabled:opacity-50">
                  <Star /> {price} · Buy
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">Stardust is free and only for avatar items. It can't be bought or traded.</p>
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
            ["shop", "Shop"],
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
        <div className="mt-5">{tab === "avatar" ? <AvatarTab goShop={() => setTab("shop")} /> : tab === "shop" ? <ShopTab /> : <FriendsTab onPlay={onPlay} />}</div>
      </div>
    </div>
  );
}
