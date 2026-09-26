import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Hash, Users, UserPlus, Settings, Send, Reply, Pencil, Trash2, Flag, X, Menu, ArrowLeft, Check, Ban, MessageCircle, ShoppingBag, Loader2, Plus, Copy, LogOut, Trophy, Gem, Link2 } from "lucide-react";
import { chatApi, connectChat, onChatEvent, sendTyping, addNotification } from "@/lib/nebuluxChat";
import { askConfirm } from "@/lib/dialogs";
import { base44 } from "@/api/base44Client";
import NotificationBell from "@/components/NotificationBell";
import { useAppShell } from "@/components/AppShellContext";

// Nebulux Chat: laid out and colored like Discord (group rail, channels, messages, members), with
// the Nebulux nebula as its logo. Groups work like Discord servers: you only chat with people in groups
// you share, and private messages are only between friends. The chat server is workers/nebulux-chat.
const C = {
  rail: "bg-[#1e1f22]",
  side: "bg-[#2b2d31]",
  main: "bg-[#313338]",
  input: "bg-[#383a40]",
  hover: "hover:bg-[#35373c]",
  active: "bg-[#404249]",
  me: "bg-[#232428]",
  field: "bg-[#1e1f22]",
};
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];
const EMOJI = ["😀", "😂", "🥹", "😍", "😎", "🤔", "😭", "😡", "👍", "👎", "👏", "🙏", "💪", "👋", "🤝", "✌️", "❤️", "💜", "🔥", "✨", "⭐", "🌌", "🪐", "🚀", "🎉", "🎮", "🎨", "📚", "💡", "✅", "❌", "💀"];
const FRAME = {
  glow: "ring-2 ring-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]",
  stars: "ring-2 ring-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]",
  fire: "ring-2 ring-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.95)]",
  rainbow: "ring-[3px] ring-fuchsia-400 shadow-[0_0_10px_#f472b6,0_0_18px_#60a5fa,0_0_26px_#facc15]",
  ice: "ring-2 ring-cyan-200 shadow-[0_0_14px_rgba(165,243,252,0.95)]",
};
// Profile banners (the strip at the top of a profile card).
const BANNER = {
  aurora: "linear-gradient(120deg,#22d3ee,#a78bfa,#34d399)",
  sunset: "linear-gradient(120deg,#f97316,#ec4899,#8b5cf6)",
  ocean: "linear-gradient(120deg,#0ea5e9,#1e3a8a,#14b8a6)",
  space: "radial-gradient(circle at 30% 40%,#a855f7 0,transparent 35%),radial-gradient(circle at 75% 60%,#3b82f6 0,transparent 30%),#0b0a1f",
  candy: "linear-gradient(120deg,#f9a8d4,#fde68a,#a5f3fc)",
  lava: "linear-gradient(120deg,#7f1d1d,#ef4444,#f59e0b)",
};
const bannerOf = (u) => (u?.banner && BANNER[u.banner]) || u?.avatarBg || "#5865f2";
// Name effects.
const EFFECT = {
  shimmer: { backgroundImage: "linear-gradient(90deg,#fff,#c4b5fd,#fff)", WebkitBackgroundClip: "text", color: "transparent" },
  rainbow: { backgroundImage: "linear-gradient(90deg,#f87171,#fbbf24,#4ade80,#60a5fa,#c084fc)", WebkitBackgroundClip: "text", color: "transparent" },
  glow: { textShadow: "0 0 8px currentColor" },
};
const GALAXY = { background: "#313338" }; // Discord's own colors
const WELCOMES = ["just landed in the chat!", "joined the party.", "arrived from a faraway galaxy.", "is here. Say hi!", "just showed up. Everyone wave!"];

// The spinning nebula (the Nebulux logo turning all the way round), with "hi" underneath.
function NebulaHi({ size = 56, label = "hi!" }) {
  return (
    <span className="inline-flex flex-col items-center">
      <img src="/logo.png" alt="" className="rounded-full animate-[spin_4s_linear_infinite] shadow-[0_0_18px_rgba(168,85,247,0.6)]" style={{ width: size, height: size }} />
      {label && <span className="mt-1 text-sm font-bold bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">{label}</span>}
    </span>
  );
}

function Avatar({ user, size = 40, online }) {
  if (!user) return null;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className={`keep-color w-full h-full rounded-full flex items-center justify-center select-none ${FRAME[user.frame] || ""}`} style={{ background: user.avatarBg || "#6366f1", fontSize: size * 0.5 }}>
        {user.avatar || "🌌"}
      </span>
      {user.deco && (
        <span className="absolute pointer-events-none select-none" style={{ top: -size * 0.28, right: -size * 0.18, fontSize: Math.max(10, size * 0.42) }}>
          {user.deco}
        </span>
      )}
      {online !== undefined && <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${online ? "bg-emerald-500" : "bg-slate-500"}`} />}
    </span>
  );
}

const Name = ({ user, className = "" }) => (
  <span className={`font-semibold ${className}`} style={{ color: user?.nameColor || "#e2e8f0" }}>
    <span style={EFFECT[user?.effect]}>{user?.name}</span>
    {user?.badge ? <span className="ml-1">{user.badge}</span> : null}
    {user?.admin ? <span className="ml-1.5 align-middle rounded bg-[#5865f2] px-1 text-[9px] font-bold text-[#fff]">STAFF</span> : null}
  </span>
);

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
const copy = (t) => navigator.clipboard?.writeText(t).catch(() => {});

export default function Community() {
  const navigate = useNavigate();
  const shell = useAppShell();
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState(null);
  const [stars, setStars] = useState(0);
  const [meta, setMeta] = useState(null);
  const [servers, setServers] = useState([]);
  const [server, setServer] = useState(params.get("s") || "nebulux");
  const [channels, setChannels] = useState([]);
  const [dms, setDms] = useState([]);
  const [view, setView] = useState(["friends", "quests", "shop"].includes(params.get("tab")) ? params.get("tab") : "server");
  const [channel, setChannel] = useState(params.get("c") || "");
  const [messages, setMessages] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [typing, setTyping] = useState({});
  const [people, setPeople] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [profileTab, setProfileTab] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [notice, setNotice] = useState("");
  const [away, setAway] = useState(false); // scrolled up: show "Jump to newest"
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(null); // null: the screen size decides (shown on wide screens)
  const listRef = useRef(null);
  const boxRef = useRef(null);
  const typingSent = useRef(0);
  const channelRef = useRef(channel);
  channelRef.current = channel;

  const flash = useCallback((m) => {
    setNotice(m);
    setTimeout(() => setNotice(""), 3500);
  }, []);

  const loadMe = useCallback(
    (invite = "") =>
      chatApi(`/me${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`).then((r) => {
        setMe(r.me);
        setStars(r.stars ?? r.orbs ?? 0);
        setMeta(r);
      }),
    []
  );
  const loadServers = useCallback(() => chatApi("/servers").then((r) => setServers(r.servers || [])), []);
  const loadChannels = useCallback(
    (sid = server) =>
      chatApi(`/channels?server=${encodeURIComponent(sid)}`).then((r) => {
        setChannels(r.channels || []);
        setDms(r.dms || []);
        return r.channels || [];
      }),
    [server]
  );
  const loadPeople = useCallback(
    () => chatApi(server === "nebulux" ? "/people" : `/servers/${server}/members`).then((r) => setPeople(r.people || [])).catch(() => {}),
    [server]
  );

  // First load. The profile is made before the live connection so an invite link counts.
  useEffect(() => {
    const invite = params.get("invite") || "";
    const join = params.get("join") || "";
    (async () => {
      // A slow first answer is asked again instead of spinning forever.
      for (let i = 0; ; i++) {
        try {
          await Promise.race([loadMe(invite), new Promise((_, no) => setTimeout(() => no(Object.assign(new Error("Nebulux Chat is taking too long. Check your internet and try again."), { slow: true })), 10000))]);
          break;
        } catch (e) {
          if (i >= 2 || e.status === 401) throw e;
        }
      }
      connectChat();
      if (join) {
        const r = await chatApi("/servers/join", "POST", { code: join }).catch((e) => (flash(e.message), null));
        if (r?.server) setServer(r.server.id);
      }
      await loadServers();
    })()
      .catch((e) => setError(e.status === 401 ? "Sign in to use Nebulux Chat." : e.message))
      .finally(() => setLoading(false));
  }, []);

  // Channels and members of the open group.
  useEffect(() => {
    if (!me) return;
    loadChannels(server)
      .then((list) => {
        setChannel((c) => (c && (c.startsWith("dm:") || list.some((x) => x.id === c)) ? c : list[0]?.id || ""));
      })
      .catch((e) => {
        flash(e.message);
        setServer("nebulux");
      });
    loadPeople();
    const t = setInterval(loadPeople, 30000);
    return () => clearInterval(t);
  }, [me, server, loadChannels, loadPeople, flash]);

  const openChannel = useCallback(
    (id) => {
      setView("server");
      setChannel(id);
      setDrawer(false);
      setReplyTo(null);
      setEditing(null);
      setParams(id.startsWith("dm:") ? { c: id } : server === "nebulux" ? { c: id } : { s: server, c: id }, { replace: true });
    },
    [setParams, server]
  );
  const openPage = (p) => {
    setView(p);
    setDrawer(false);
    setParams({ tab: p }, { replace: true });
  };
  const openServer = (id) => {
    setView("server");
    setDrawer(false);
    if (id === server && !channel.startsWith("dm:")) return;
    setChannel("");
    setServer(id);
    setParams(id === "nebulux" ? {} : { s: id }, { replace: true });
  };

  useEffect(() => {
    if (view !== "server" || !me || !channel) return;
    let alive = true;
    setMessages([]);
    chatApi(`/channels/${encodeURIComponent(channel)}/messages`)
      .then((r) => {
        if (!alive) return;
        setMessages(r.messages || []);
        setMore(!!r.more);
        setChannels((cs) => cs.map((c) => (c.id === channel ? { ...c, unread: false } : c)));
        setDms((ds) => ds.map((c) => (c.id === channel ? { ...c, unread: false } : c)));
        requestAnimationFrame(() => listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight));
      })
      .catch((e) => alive && flash(e.message));
    return () => {
      alive = false;
    };
  }, [channel, view, me, flash]);

  // Live events
  useEffect(
    () =>
      onChatEvent((e) => {
        if (e.type === "message") {
          const m = e.message;
          if (m.channel === channelRef.current) {
            setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
            const el = listRef.current;
            if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
            setTyping((t) => ({ ...t, [m.user.id]: undefined }));
          } else {
            setChannels((cs) => cs.map((c) => (c.id === m.channel ? { ...c, unread: true } : c)));
            if (m.channel.startsWith("dm:")) loadChannels();
          }
        } else if (e.type === "edit") setMessages((cur) => cur.map((x) => (x.id === e.id ? { ...x, text: e.text, edited: true } : x)));
        else if (e.type === "delete") setMessages((cur) => cur.map((x) => (x.id === e.id ? { ...x, deleted: true, text: "" } : x)));
        else if (e.type === "react") setMessages((cur) => cur.map((x) => (x.id === e.id ? { ...x, reactions: e.reactions } : x)));
        else if (e.type === "typing" && e.channel === channelRef.current && e.userId !== me?.id) {
          setTyping((t) => ({ ...t, [e.userId]: { name: e.name, until: Date.now() + 4000 } }));
        }
      }),
    [me, loadChannels]
  );
  useEffect(() => {
    const t = setInterval(() => setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, v]) => v && v.until > Date.now()))), 1000);
    return () => clearInterval(t);
  }, []);

  const post = async (body, reply) => {
    const r = await chatApi(`/channels/${encodeURIComponent(channel)}/messages`, "POST", { text: body, replyTo: reply });
    setMessages((cur) => (cur.some((x) => x.id === r.message.id) ? cur : [...cur, r.message]));
    if (r.removed?.length) flash(`For safety we took out: ${r.removed.join(", ")}.`);
    requestAnimationFrame(() => listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight));
  };
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      if (editing) {
        await chatApi(`/messages/${editing.id}`, "PATCH", { text: body });
        setEditing(null);
      } else await post(body, replyTo?.id);
      setText("");
      setReplyTo(null);
    } catch (e) {
      flash(e.message);
    }
  };
  const wave = (m) => post("::wave::", m.id).catch((e) => flash(e.message));

  const loadOlder = async () => {
    if (!messages.length) return;
    const el = listRef.current;
    const h = el.scrollHeight;
    const r = await chatApi(`/channels/${encodeURIComponent(channel)}/messages?before=${messages[0].id}`).catch(() => null);
    if (!r) return;
    setMessages((cur) => [...r.messages, ...cur]);
    setMore(!!r.more);
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - h));
  };

  // @mentions: yours glow gold like on Discord, everyone's are shown as a chip.
  const myTag = `@${me?.name || ""}`.toLowerCase();
  const mentionsMe = (m) => !!me && m.user.id !== me.id && !m.deleted && m.text.toLowerCase().includes(myTag);
  const renderText = (t) =>
    t.split(/(@[\p{L}\p{N}_.-]{2,24})/gu).map((part, i) =>
      i % 2 ? (
        <span key={i} className={`rounded px-0.5 font-medium ${part.toLowerCase() === myTag ? "bg-amber-400/25 text-amber-100" : "bg-indigo-500/25 text-indigo-100"}`}>
          {part}
        </span>
      ) : (
        part
      )
    );
  const addEmoji = (emo) => {
    const el = boxRef.current;
    const at = el ? el.selectionStart : text.length;
    setText((t) => t.slice(0, at) + emo + t.slice(at));
    setEmojiOpen(false);
    requestAnimationFrame(() => el && (el.focus(), el.setSelectionRange(at + emo.length, at + emo.length)));
  };
  const jumpDown = () => listRef.current && listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });

  const react = (m, emo) => chatApi(`/messages/${m.id}/react`, "POST", { emoji: emo }).then((r) => setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, reactions: r.reactions } : x)))).catch((e) => flash(e.message));
  const isDm = channel.startsWith("dm:");
  const group = servers.find((s) => s.id === server) || { id: "nebulux", name: "Nebulux Community" };
  const current = isDm ? dms.find((d) => d.id === channel) : channels.find((c) => c.id === channel);
  const title = isDm ? current?.user?.name || "Direct message" : `${current?.name || ""}`;
  const typingNames = Object.values(typing).filter(Boolean).map((t) => t.name);
  const byId = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);

  if (loading)
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-3" style={GALAXY}>
        <NebulaHi size={72} label="" />
        <p className="text-sm text-indigo-200">Opening Nebulux Chat…</p>
      </div>
    );
  if (error || !me)
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-3 text-slate-200 p-6 text-center" style={GALAXY}>
        <p className="text-base font-semibold">{error || "Nebulux Chat couldn't load."}</p>
        {!/Sign in/.test(error) && (
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-[#404249] text-[#fff] text-sm">
            Try again
          </button>
        )}
        <button onClick={() => navigate("/chat")} className="px-4 py-2 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] text-[#fff] text-sm">
          Back to Nebulux AI
        </button>
      </div>
    );

  const railBtn = (active) => `w-11 h-11 flex items-center justify-center overflow-hidden transition-all ${active ? "rounded-2xl" : "rounded-full hover:rounded-2xl"}`;
  const sidebarList = (
    <div className="flex h-full">
      {/* Group rail */}
      <div className={`w-[64px] shrink-0 ${C.rail} flex flex-col items-center gap-2 py-3 overflow-y-auto`}>
        <button onClick={() => navigate("/chat")} title="Back to Nebulux AI" aria-label="Back to Nebulux AI" className={`${railBtn(false)} bg-[#383a40] hover:bg-[#5865f2] text-slate-200`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-7 h-0.5 bg-[#35363c] rounded" />
        <button onClick={() => { setView("friends"); setDrawer(false); }} title="Friends and private messages" aria-label="Friends and private messages" className={`${railBtn(view === "friends")} ${view === "friends" ? "bg-[#5865f2]" : "bg-[#383a40] hover:bg-[#5865f2]"}`}>
          <MessageCircle className="w-5 h-5 text-[#fff]" />
        </button>
        <div className="w-7 h-0.5 bg-[#35363c] rounded" />
        {servers.map((s) => {
          const on = view === "server" && !isDm && server === s.id;
          return (
            <span key={s.id} className="relative">
              {on && <span className="absolute -left-[10px] top-1.5 w-1 h-8 rounded-r bg-white" />}
              <button onClick={() => openServer(s.id)} title={s.name} aria-label={s.name} className={`${railBtn(on)} ${s.id === "nebulux" ? "" : on ? "bg-[#5865f2]" : "bg-[#383a40] hover:bg-[#5865f2]"} text-xl`}>
                {s.id === "nebulux" ? <img src="/logo.png" alt="" className="w-full h-full object-cover" /> : s.icon}
              </button>
            </span>
          );
        })}
        <button onClick={() => setGroupOpen(true)} title="Make or join a group" aria-label="Make or join a group" className={`${railBtn(false)} bg-[#383a40] text-emerald-400 hover:bg-emerald-600 hover:text-[#fff]`}>
          <Plus className="w-5 h-5" />
        </button>
        <button onClick={() => openPage("quests")} className="mt-auto flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 hover:bg-[#383a40]" title="Your stars: do quests to earn more">
          <span className="text-base">⭐</span>
          <span className="text-[10px] font-bold text-amber-200">{stars}</span>
        </button>
      </div>
      {/* Channel list */}
      <div className={`w-56 shrink-0 ${C.side} flex flex-col`}>
        <div className="h-11 px-3 flex items-center gap-1 border-b border-black/40">
          <p className="flex-1 font-bold text-sm text-white truncate">{view === "friends" ? "Private messages" : group.name}</p>
          {view === "server" && group.invite && (
            <button onClick={() => { copy(`${location.origin}/chat/community?join=${group.invite}`); flash("Invite link copied! Only people with it can join this group."); }} title="Copy invite link" aria-label="Copy invite link" className={`p-1.5 rounded ${C.hover} text-slate-300`}>
              <UserPlus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 text-sm">
          <button onClick={() => openPage("quests")} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-amber-200 ${C.hover}`}>
            <Trophy className="w-4 h-4" /> <span className="flex-1 text-left">Quests</span> <span className="text-[10px] rounded bg-amber-400/15 px-1.5">earn ⭐</span>
          </button>
          <button onClick={() => openPage("shop")} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-fuchsia-200 ${C.hover}`}>
            <ShoppingBag className="w-4 h-4" /> <span className="flex-1 text-left">Star shop</span> <span className="text-[10px]">⭐ {stars}</span>
          </button>
          <button onClick={() => setProfileTab("profile")} className={`w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded-md text-indigo-200 ${C.hover}`}>
            <Gem className="w-4 h-4" /> <span className="flex-1 text-left">Profile and perks</span>
          </button>
          {view === "server" && (
            <>
              <div className="flex items-center px-1.5 pb-1 pt-1">
                <p className="flex-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Text channels</p>
                {group.owner && (
                  <button
                    onClick={async () => {
                      const name = window.prompt("New channel name");
                      if (!name) return;
                      chatApi(`/servers/${server}/channels`, "POST", { name }).then((r) => { setChannels((cs) => [...cs, r.channel]); openChannel(r.channel.id); }).catch((e) => flash(e.message));
                    }}
                    title="Add a channel"
                    aria-label="Add a channel"
                    className="text-slate-400 hover:text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              {channels.map((c) => (
                <button key={c.id} onClick={() => openChannel(c.id)} className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left ${channel === c.id ? `${C.active} text-white` : c.unread ? `text-white ${C.hover}` : `text-slate-400 ${C.hover} hover:text-slate-200`}`}>
                  <Hash className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className={`truncate ${c.unread ? "font-semibold" : ""}`}>{c.name}</span>
                  {c.unread && channel !== c.id && <span className="ml-auto w-2 h-2 rounded-full bg-fuchsia-300" />}
                </button>
              ))}
              {server !== "nebulux" && (
                <button
                  onClick={async () => {
                    if (group.owner) {
                      if (!(await askConfirm(`Delete ${group.name} for everyone? All its messages are deleted too.`))) return;
                      chatApi(`/servers/${server}`, "DELETE").then(() => { loadServers(); openServer("nebulux"); }).catch((e) => flash(e.message));
                    } else {
                      if (!(await askConfirm(`Leave ${group.name}?`))) return;
                      chatApi(`/servers/${server}/leave`, "POST").then(() => { loadServers(); openServer("nebulux"); }).catch((e) => flash(e.message));
                    }
                  }}
                  className={`mt-3 w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-xs text-red-300/80 ${C.hover}`}
                >
                  <LogOut className="w-3.5 h-3.5" /> {group.owner ? "Delete group" : "Leave group"}
                </button>
              )}
            </>
          )}
          <p className="px-1.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Private messages</p>
          <button onClick={() => { setView("friends"); setDrawer(false); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md ${view === "friends" ? `${C.active} text-white` : `text-slate-300 ${C.hover}`}`}>
            <Users className="w-4 h-4" /> Friends
          </button>
          {dms.map((d) => (
            <button key={d.id} onClick={() => openChannel(d.id)} className={`w-full flex items-center gap-2 px-2 py-1 rounded-md ${channel === d.id && view === "server" ? `${C.active} text-white` : `text-slate-400 ${C.hover} hover:text-slate-200`}`}>
              <Avatar user={d.user} size={28} />
              <span className={`truncate ${d.unread ? "font-semibold text-white" : ""}`}>{d.user.name}</span>
            </button>
          ))}
        </div>
        {/* Me */}
        <div className={`h-12 px-2 ${C.me} flex items-center gap-1`}>
          <button onClick={() => setProfileTab("profile")} className={`flex items-center gap-2 min-w-0 flex-1 rounded-md px-1 py-1 ${C.hover} text-left`}>
            <Avatar user={me} size={30} online />
            <span className="min-w-0">
              <Name user={me} className="block truncate text-xs" />
              <span className="block text-[10px] text-slate-400">⭐ {stars} stars{meta?.plus?.plus ? " · 💎 Plus" : ""}</span>
            </span>
          </button>
          <button onClick={() => openPage("quests")} title="Quests" aria-label="Quests" className={`p-1.5 rounded-md text-amber-200 ${C.hover}`}>
            <Trophy className="w-4 h-4" />
          </button>
          <button onClick={() => setProfileTab("profile")} title="Profile, looks and Star shop" aria-label="Profile settings" className={`p-1.5 rounded-md text-slate-300 ${C.hover}`}>
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderMessage = (m, i) => {
    const prev = messages[i - 1];
    const special = (x) => x && (x.text === "::join::" || x.text === "::wave::");
    const grouped = prev && !special(prev) && !special(m) && prev.user.id === m.user.id && !m.replyTo && Date.parse(m.at) - Date.parse(prev.at) < 5 * 60 * 1000 && !prev.deleted;
    const newDay = !prev || day(prev.at) !== day(m.at);
    const reply = m.replyTo ? byId[m.replyTo] : null;
    const mine = m.user.id === me.id;
    const divider = newDay && (
      <div className="flex items-center gap-2 px-4 my-3">
        <div className="flex-1 h-px bg-[#3f4147]" />
        <span className="text-[10px] font-semibold text-slate-400">{day(m.at)}</span>
        <div className="flex-1 h-px bg-[#3f4147]" />
      </div>
    );
    if (m.text === "::join::" && !m.deleted) {
      const line = WELCOMES[m.id % WELCOMES.length];
      return (
        <React.Fragment key={m.id}>
          {divider}
          <div className="group flex items-center gap-3 px-4 py-1.5 mt-1 hover:bg-white/[0.03]">
            <span className="w-10 flex justify-center text-emerald-400 text-lg">→</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-300">
                Welcome, <button onClick={() => setViewUser(m.user)} className="hover:underline"><Name user={m.user} /></button> {line}
                <span className="ml-2 text-[10px] text-slate-500">{time(m.at)}</span>
              </p>
              {!mine && (
                <button onClick={() => wave(m)} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#383a40] border border-indigo-400/30 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-[#5865f2]/40">
                  <span className="text-base">👋</span> Wave to say hi to {m.user.name}
                </button>
              )}
            </div>
          </div>
        </React.Fragment>
      );
    }
    if (m.text === "::wave::" && !m.deleted) {
      return (
        <React.Fragment key={m.id}>
          {divider}
          <div className="flex gap-3 px-4 pt-2 pb-1 mt-1 hover:bg-white/[0.03]">
            <button onClick={() => setViewUser(m.user)} aria-label={`${m.user.name}'s profile`} className="self-start">
              <Avatar user={m.user} size={40} />
            </button>
            <div className="min-w-0">
              <p className="leading-5 text-[13px]">
                <Name user={m.user} /> <span className="text-slate-400">says hi{reply && reply.user.id !== m.user.id ? <> to <Name user={reply.user} /></> : ""}</span>
                <span className="ml-2 text-[10px] text-slate-500">{time(m.at)}</span>
              </p>
              <div className="mt-2">
                <NebulaHi size={64} />
              </div>
            </div>
          </div>
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={m.id}>
        {divider}
        <div className={`group relative flex gap-3 px-4 ${mentionsMe(m) ? "bg-amber-400/10 border-l-2 border-amber-400 hover:bg-amber-400/15" : "hover:bg-white/[0.03]"} ${grouped ? "py-0.5" : "pt-2 pb-0.5 mt-1.5"}`}>
          <div className="w-10 shrink-0">
            {!grouped ? (
              <button onClick={() => setViewUser(m.user)} aria-label={`${m.user.name}'s profile`}>
                <Avatar user={m.user} size={40} />
              </button>
            ) : (
              <span className="hidden group-hover:block text-[9px] text-slate-500 pt-1 text-right">{time(m.at)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {reply && (
              <p className="text-[11px] text-slate-400 truncate mb-0.5">
                ↪ <Name user={reply.user} className="text-[11px]" /> {reply.deleted ? "message deleted" : special(reply) ? "👋" : reply.text}
              </p>
            )}
            {!grouped && (
              <p className="leading-5 text-[13px]">
                <button onClick={() => setViewUser(m.user)} className="hover:underline">
                  <Name user={m.user} />
                </button>
                <span className="ml-2 text-[10px] text-slate-500">{day(m.at) === day(new Date().toISOString()) ? `Today at ${time(m.at)}` : `${day(m.at)} ${time(m.at)}`}</span>
              </p>
            )}
            {m.deleted ? (
              <p className="text-xs italic text-slate-500">This message was deleted.</p>
            ) : (
              <p className="text-[13px] leading-5 text-slate-100 whitespace-pre-wrap break-words">
                {renderText(m.text)}
                {m.edited && <span className="ml-1 text-[9px] text-slate-500">(edited)</span>}
              </p>
            )}
            {Object.keys(m.reactions || {}).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(m.reactions).map(([emo, users]) => (
                  <button key={emo} onClick={() => react(m, emo)} className={`px-1.5 py-0.5 rounded-md text-[11px] border ${users.includes(me.id) ? "bg-indigo-500/25 border-indigo-400" : "bg-[#383a40] border-transparent hover:border-slate-500"}`}>
                    {emo} {users.length}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!m.deleted && (
            <div className="absolute -top-3 right-4 hidden group-hover:flex items-center rounded-md bg-[#383a40] border border-black/40 shadow-lg">
              {REACTIONS.slice(0, 4).map((emo) => (
                <button key={emo} title={`React ${emo}`} onClick={() => react(m, emo)} className="px-1.5 py-1 hover:bg-[#404249] text-sm">
                  {emo}
                </button>
              ))}
              <button title="Reply" aria-label="Reply" onClick={() => setReplyTo(m)} className="p-1.5 hover:bg-[#404249] text-slate-300">
                <Reply className="w-3.5 h-3.5" />
              </button>
              {mine && (
                <button title="Edit" aria-label="Edit" onClick={() => { setEditing(m); setText(m.text); }} className="p-1.5 hover:bg-[#404249] text-slate-300">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {(mine || me.admin) && (
                <button title="Delete" aria-label="Delete" onClick={async () => { if (await askConfirm("Delete this message?")) chatApi(`/messages/${m.id}`, "DELETE").catch((e) => flash(e.message)); }} className="p-1.5 hover:bg-[#404249] text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!mine && (
                <button title="Report" aria-label="Report" onClick={async () => { if (await askConfirm("Report this message to the Nebulux team?")) chatApi(`/messages/${m.id}/report`, "POST", {}).then(() => flash("Thanks, we'll take a look.")).catch((e) => flash(e.message)); }} className="p-1.5 hover:bg-[#404249] text-slate-300">
                  <Flag className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="fixed inset-0 z-20 flex text-slate-200 text-[13px]" style={GALAXY}>
      <div className="hidden md:flex">{sidebarList}</div>
      {drawer && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="flex shadow-2xl">{sidebarList}</div>
          <div className="flex-1 bg-black/60" onClick={() => setDrawer(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="h-11 shrink-0 px-3 flex items-center gap-2 border-b border-black/40">
          <button onClick={() => setDrawer(true)} className={`md:hidden p-1.5 -ml-1 rounded-md text-slate-300 ${C.hover}`} aria-label="Channels">
            <Menu className="w-5 h-5" />
          </button>
          {view === "quests" || view === "shop" ? (
            <p className="font-bold text-white flex items-center gap-2">
              {view === "quests" ? <Trophy className="w-4 h-4 text-amber-200" /> : <ShoppingBag className="w-4 h-4 text-fuchsia-200" />} {view === "quests" ? "Quests" : "Star shop"}
            </p>
          ) : view === "friends" ? (
            <p className="font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" /> Friends
            </p>
          ) : (
            <p className="font-bold text-white flex items-center gap-1.5 min-w-0">
              {isDm ? <Avatar user={current?.user} size={22} /> : <Hash className="w-4 h-4 text-slate-400" />}
              <span className="truncate">{title}</span>
              {current?.topic && <span className="hidden sm:inline ml-2 pl-3 border-l border-slate-600 text-xs font-normal text-slate-400 truncate">{current.topic}</span>}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            {view === "server" && !isDm && (
              <button onClick={() => setShowMembers((s) => !s)} title="Show members" aria-label="Show members" className={`p-1.5 rounded-md ${showMembers ? "text-white" : "text-slate-400"} ${C.hover}`}>
                <Users className="w-5 h-5" />
              </button>
            )}
            <NotificationBell />
            <button onClick={() => shell?.openProfile?.()} className="keep-color w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold" aria-label="Your Nebulux AI account">
              {shell?.avatarInitial || "U"}
            </button>
          </div>
        </div>

        {notice && <div className="mx-3 mt-2 rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-xs text-amber-200">{notice}</div>}

        {view === "quests" ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PageBanner icon="🏆" title="Quests" text="Finish quests to earn stars, then spend them in the Star shop. Each quest pays once." stars={stars} />
            <div className="max-w-3xl -mt-4">
              <Quests meta={meta} onStars={(s) => setStars(s)} flash={flash} />
            </div>
          </div>
        ) : view === "shop" ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PageBanner icon="🛍" title="Star shop" text="Name colors, glowing frames and badges. Earn stars from Quests." stars={stars} />
            <div className="-mt-4">
              <Shop packs={meta?.starPacks} shop={meta?.shop || {}} owned={meta?.owned || []} stars={stars} onStars={(s, owned) => { setStars(s); if (owned) setMeta((m) => ({ ...m, owned: [...new Set([...(m.owned || []), ...owned])] })); }} />
            </div>
          </div>
        ) : view === "friends" ? (
          <Friends me={me} onOpenDm={(id) => loadChannels().then(() => openChannel(id))} onView={setViewUser} flash={flash} />
        ) : (
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 flex flex-col">
              <div ref={listRef} onScroll={(e) => setAway(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight > 400)} className="flex-1 overflow-y-auto py-3">
                {more && (
                  <div className="text-center pb-3">
                    <button onClick={loadOlder} className="text-xs text-indigo-300 hover:underline">
                      Load older messages
                    </button>
                  </div>
                )}
                {!more && channel && (
                  <div className="px-4 pb-4">
                    {isDm ? <Avatar user={current?.user} size={64} /> : <NebulaHi size={64} label="hi!" />}
                    <p className="mt-2 text-xl font-bold text-white">{isDm ? current?.user?.name : `Welcome to #${title}!`}</p>
                    <p className="text-xs text-slate-400">{isDm ? "This is the start of your private messages. Only friends can message each other." : current?.topic || "This is the start of this channel."}</p>
                  </div>
                )}
                {messages.map(renderMessage)}
              </div>
              {/* Composer */}
              <div className="relative px-4 pb-3">
                {away && (
                  <button onClick={jumpDown} className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 rounded-full bg-[#5865f2] hover:bg-[#4752c4] px-3 py-1.5 text-xs font-semibold text-[#fff] shadow-lg">
                    ↓ Jump to newest
                  </button>
                )}
                {(replyTo || editing) && (
                  <div className="flex items-center justify-between rounded-t-lg bg-[#2b2d31] px-3 py-1.5 text-xs text-slate-300">
                    <span className="truncate">{editing ? "Editing your message" : <>Replying to <Name user={replyTo.user} className="text-xs" /></>}</span>
                    <button onClick={() => { setReplyTo(null); setEditing(null); setText(""); }} aria-label="Cancel" className="text-slate-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className={`flex items-end gap-2 ${C.input} px-3 ${replyTo || editing ? "rounded-b-lg" : "rounded-lg"}`}>
                  <textarea
                    ref={boxRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (Date.now() - typingSent.current > 3000) {
                        typingSent.current = Date.now();
                        sendTyping(channel, me.name);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                      if (e.key === "Escape") {
                        setReplyTo(null);
                        setEditing(null);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    disabled={!channel}
                    placeholder={isDm ? `Message @${title}` : `Message #${title}`}
                    className="flex-1 bg-transparent resize-none outline-none py-2.5 text-[13px] text-slate-100 placeholder:text-slate-500 max-h-40"
                  />
                  <span className="relative">
                    <button onClick={() => setEmojiOpen((o) => !o)} aria-label="Emoji" title="Emoji" className="p-2 text-lg leading-none grayscale hover:grayscale-0">
                      😊
                    </button>
                    {emojiOpen && (
                      <div className="absolute bottom-11 right-0 z-30 w-64 grid grid-cols-8 gap-0.5 rounded-xl bg-[#2b2d31] border border-black/30 p-2 shadow-2xl">
                        {EMOJI.map((emo) => (
                          <button key={emo} onClick={() => addEmoji(emo)} className="h-7 rounded hover:bg-[#404249] text-base">
                            {emo}
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                  <button onClick={send} disabled={!text.trim()} aria-label="Send" className="p-2 text-slate-300 hover:text-white disabled:opacity-40">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="h-4 pt-0.5 text-[11px] text-slate-400">{typingNames.length ? `${typingNames.slice(0, 3).join(", ")} ${typingNames.length > 1 ? "are" : "is"} typing…` : ""}</p>
              </div>
            </div>
            {/* Members of this group */}
            {!isDm && (
              <div className={`${showMembers === false ? "hidden" : showMembers ? "fixed inset-y-0 right-0 z-40 shadow-2xl lg:static lg:shadow-none block" : "hidden lg:block"} w-56 shrink-0 ${C.side} overflow-y-auto px-2 py-3`}>
                {[["Online", people.filter((p) => p.online)], ["Offline", people.filter((p) => !p.online)]].map(([label, list]) =>
                  list.length ? (
                    <div key={label} className="mb-4">
                      <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {label} — {list.length}
                      </p>
                      {list.map((p) => (
                        <button key={p.id} onClick={() => setViewUser(p)} className={`w-full flex items-center gap-2.5 px-2 py-1 rounded-md ${C.hover} ${p.online ? "" : "opacity-50"}`}>
                          <Avatar user={p} size={30} online={p.online} />
                          <Name user={p} className="truncate text-xs" />
                          {p.owner && <span title="Made this group" className="text-[11px]">👑</span>}
                        </button>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {profileTab && meta && (
        <ProfileEditor
          tab={profileTab}
          setTab={setProfileTab}
          me={me}
          stars={stars}
          meta={meta}
          flash={flash}
          onClose={() => setProfileTab("")}
          onSaved={(p) => setMe(p)}
          onStars={(s, owned) => {
            setStars(s);
            if (owned) setMeta((m) => ({ ...m, owned: [...new Set([...(m.owned || []), ...owned])] }));
          }}
        />
      )}
      {groupOpen && (
        <GroupDialog
          avatars={meta?.avatars || []}
          onClose={() => setGroupOpen(false)}
          onDone={(s) => {
            setGroupOpen(false);
            loadServers().then(() => openServer(s.id));
          }}
        />
      )}
      {viewUser && <UserCard user={viewUser} me={me} onClose={() => setViewUser(null)} flash={flash} onMessage={(id) => { setViewUser(null); loadChannels().then(() => openChannel(id)); }} />}
    </div>
  );
}

function Modal({ children, onClose, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`relative w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[90vh] overflow-y-auto rounded-2xl bg-[#313338] border border-black/30 shadow-2xl text-sm`}>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-400 hover:bg-[#404249] hover:text-white">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

// Make a group (like a Discord server) or join one with an invite code or link.
function GroupDialog({ avatars, onClose, onDone }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🪐");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (p) => {
    setBusy(true);
    setErr("");
    p.then((r) => onDone(r.server)).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };
  return (
    <Modal onClose={onClose}>
      <div className="p-5 space-y-5">
        <div>
          <p className="text-base font-bold text-white">Make a group</p>
          <p className="text-xs text-slate-400">A place for you and your friends. Only people you send the invite link to can join.</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {avatars.slice(0, 16).map((a) => (
              <button key={a} onClick={() => setIcon(a)} className={`w-8 h-8 rounded-lg text-base ${icon === a ? "bg-[#5865f2]" : "bg-[#1e1f22] hover:bg-[#404249]"}`}>
                {a}
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Group name" className="mt-2 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          <button disabled={busy || name.trim().length < 2} onClick={() => run(chatApi("/servers", "POST", { name, icon }))} className="mt-2 w-full rounded-lg bg-[#5865f2] hover:bg-[#4752c4] py-2 font-semibold text-[#fff] disabled:opacity-40">
            Make group
          </button>
        </div>
        <div className="border-t border-black/30 pt-4">
          <p className="text-base font-bold text-white">Join a group</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste an invite link or code" className="mt-2 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          <button disabled={busy || !code.trim()} onClick={() => run(chatApi("/servers/join", "POST", { code: (code.match(/join=([\w-]+)/) || [, code.trim()])[1] }))} className="mt-2 w-full rounded-lg bg-emerald-600 py-2 font-semibold text-[#fff] disabled:opacity-40">
            Join group
          </button>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
      </div>
    </Modal>
  );
}

function UserCard({ user, me, onClose, flash, onMessage }) {
  const [busy, setBusy] = useState(false);
  const self = user.id === me.id;
  return (
    <Modal onClose={onClose}>
      <div className="h-20 rounded-t-2xl" style={{ background: bannerOf(user) }} />
      <div className="px-5 pb-5 -mt-10">
        <Avatar user={user} size={76} />
        <p className="mt-2 text-lg">
          <Name user={user} />
        </p>
        {user.bio && <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">{user.bio}</p>}
        {!self && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                chatApi("/friends", "POST", { userId: user.id })
                  .then((r) => flash(r.status === "friend" ? `You and ${user.name} are friends now!` : "Friend request sent."))
                  .catch((e) => flash(e.message))
                  .finally(() => setBusy(false));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-[#fff] text-xs font-medium hover:bg-emerald-500"
            >
              <UserPlus className="w-4 h-4" /> Add friend
            </button>
            <button onClick={() => onMessage(`dm:${[me.id, user.id].sort().join(":")}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#5865f2] text-[#fff] text-xs font-medium hover:bg-[#4752c4]">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
            <button
              onClick={async () => {
                if (!(await askConfirm(`Block ${user.name}? They won't be able to message you or add you.`))) return;
                chatApi("/blocks", "POST", { userId: user.id }).then(() => { flash(`${user.name} is blocked.`); onClose(); }).catch((e) => flash(e.message));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#404249] text-[#fff] text-xs font-medium hover:bg-[#4e5058]"
            >
              <Ban className="w-4 h-4" /> Block
            </button>
            {me.admin && (
              <button
                onClick={async () => {
                  if (!(await askConfirm(`Ban ${user.name} from Nebulux Chat?`))) return;
                  chatApi("/admin/ban", "POST", { userId: user.id }).then(() => { flash(`${user.name} is banned from chat.`); onClose(); }).catch((e) => flash(e.message));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-[#fff] text-xs font-medium hover:bg-red-500"
              >
                Ban from chat
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-[10px] text-slate-500">Private messages only work between friends. Never share your address, school, phone number or passwords.</p>
      </div>
    </Modal>
  );
}

function Friends({ me, onOpenDm, onView, flash }) {
  const [tab, setTab] = useState("online");
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [found, setFound] = useState([]);
  const load = useCallback(() => chatApi("/friends").then((r) => setList(r.friends || [])).catch((e) => flash(e.message)), [flash]);
  useEffect(() => {
    load();
    return onChatEvent((e) => e.type === "notification" && e.kind === "friend" && load());
  }, [load]);
  const shown = tab === "online" ? list.filter((f) => f.status === "friend" && f.online) : tab === "all" ? list.filter((f) => f.status === "friend") : tab === "pending" ? list.filter((f) => f.status !== "friend") : [];
  const pending = list.filter((f) => f.status === "incoming").length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-black/40">
        {[["online", "Online"], ["all", "All"], ["pending", `Pending${pending ? ` (${pending})` : ""}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-2.5 py-1 rounded-md text-xs ${tab === id ? "bg-[#404249] text-white" : "text-slate-400 hover:bg-[#35373c] hover:text-slate-200"}`}>
            {label}
          </button>
        ))}
        <button onClick={() => setTab("add")} className={`px-2.5 py-1 rounded-md text-xs font-medium ${tab === "add" ? "text-emerald-400" : "bg-emerald-600 text-[#fff]"}`}>
          Add Friend
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === "add" ? (
          <div className="max-w-xl">
            <p className="font-bold text-white">ADD FRIEND</p>
            <p className="text-xs text-slate-400">Find people by their Nebulux Chat name. Once you're friends you can message each other privately.</p>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim().length >= 2) chatApi(`/people?q=${encodeURIComponent(e.target.value.trim())}`).then((r) => setFound((r.people || []).filter((p) => p.id !== me.id))).catch(() => {});
                else setFound([]);
              }}
              placeholder="Their name"
              className="mt-3 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-3 space-y-1">
              {found.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[#35373c]">
                  <Avatar user={p} size={30} online={p.online} />
                  <Name user={p} className="flex-1 truncate" />
                  <button onClick={() => chatApi("/friends", "POST", { userId: p.id }).then((r) => { flash(r.status === "friend" ? "You're friends now!" : "Friend request sent."); load(); }).catch((e) => flash(e.message))} className="px-3 py-1 rounded-md bg-emerald-600 text-[#fff] text-xs font-medium">
                    Send request
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <NebulaHi size={72} label="" />
            <p className="mt-3 text-xs text-slate-400">{tab === "pending" ? "No pending friend requests." : "No friends here yet. Tap Add Friend to find people."}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {shown.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[#35373c] border-t border-indigo-300/10">
                <button onClick={() => onView(f)}>
                  <Avatar user={f} size={34} online={f.online} />
                </button>
                <span className="flex-1 min-w-0">
                  <Name user={f} className="block truncate" />
                  <span className="text-[11px] text-slate-400">{f.status === "incoming" ? "Wants to be friends" : f.status === "sent" ? "Request sent" : f.online ? "Online" : "Offline"}</span>
                </span>
                {f.status === "friend" && (
                  <button onClick={() => onOpenDm(f.dm)} title="Message" aria-label={`Message ${f.name}`} className="p-2 rounded-full bg-[#2b2d31] text-slate-300 hover:text-white">
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
                {f.status === "incoming" && (
                  <button onClick={() => chatApi("/friends", "POST", { userId: f.id }).then(load).catch((e) => flash(e.message))} title="Accept" aria-label="Accept" className="p-2 rounded-full bg-[#2b2d31] text-emerald-400">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={async () => { if (await askConfirm(f.status === "friend" ? `Remove ${f.name} as a friend?` : "Cancel this request?")) chatApi(`/friends/${f.id}`, "DELETE").then(load); }} title="Remove" aria-label="Remove" className="p-2 rounded-full bg-[#2b2d31] text-slate-400 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Quests: the way to earn stars. Each one is checked on the chat server when claimed.
function Quests({ meta, onStars, flash }) {
  const [busy, setBusy] = useState("");
  const [data, setData] = useState(null);
  const load = useCallback(() => chatApi("/quests").then(setData).catch((e) => flash(e.message)), [flash]);
  useEffect(() => {
    load();
  }, [load]);
  const link = `${location.origin}/chat/community?invite=${meta.inviteCode || ""}`;
  const mult = meta.plus?.mult || 1;
  const claim = (q) => {
    setBusy(q.id);
    chatApi("/quests/claim", "POST", { id: q.id })
      .then((r) => {
        onStars(r.stars ?? r.orbs);
        addNotification({ kind: "reward", text: `Quest done: you got ${r.got} stars!` });
        load();
      })
      .catch((e) => flash(e.message))
      .finally(() => setBusy(""));
  };
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-indigo-600/30 via-fuchsia-600/20 to-transparent border border-black/30 p-4">
        <p className="font-bold text-white flex items-center gap-1.5">
          <Link2 className="w-4 h-4" /> Your chat invite link
        </p>
        <p className="text-xs text-slate-300">When someone joins Nebulux Chat with it, your invite quest is done. If they upgrade later, you get free credits too.</p>
        <div className="mt-2 flex gap-2">
          <input readOnly value={link} className="flex-1 min-w-0 rounded-lg bg-[#1e1f22] px-3 py-1.5 text-xs text-slate-200" onFocus={(e) => e.target.select()} />
          <button onClick={() => { copy(link); flash("Invite link copied!"); }} className="inline-flex items-center gap-1 rounded-lg bg-[#5865f2] px-3 text-xs font-semibold text-[#fff]">
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
      </div>
      {mult > 1 && (
        <p className="text-xs text-fuchsia-200 flex items-center gap-1.5">
          <Gem className="w-4 h-4" /> Plus perk: you get {mult}× stars from every quest.
        </p>
      )}
      {!data ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-indigo-300 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-3 py-1 font-semibold ${data.claimsLeft ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {data.claimsLeft ? `You can claim ${data.claimsLeft} more today` : "No claims left today. Come back tomorrow!"}
            </span>
            <span className="text-slate-400">Up to {data.dailyClaims} claims a day · new weekly quests in {untilText(data.weekEnds)}</span>
          </div>
          <QuestList title="This week's quests" items={data.weekly} {...{ mult, busy, claim, canClaim: data.claimsLeft > 0 }} />
          <QuestList title="Milestones (once ever)" items={data.milestones} {...{ mult, busy, claim, canClaim: data.claimsLeft > 0 }} />
        </>
      )}
    </div>
  );
}

const untilText = (iso) => {
  const ms = Date.parse(iso) - Date.now();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${Math.max(1, h)}h`;
};

function QuestList({ title, items, mult, busy, claim, canClaim }) {
  const sorted = [...items].sort((a, b) => ({ ready: 0, todo: 1, claimed: 2 })[a.status] - ({ ready: 0, todo: 1, claimed: 2 })[b.status]);
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-300">{title}</p>
      <div className="space-y-1.5">
        {sorted.map((q) => (
          <div key={q.id} className={`flex items-center gap-3 rounded-lg p-2.5 ${q.status === "claimed" ? "bg-[#2b2d31] opacity-55" : "bg-[#2b2d31] border border-black/20"}`}>
            <span className="text-lg">{q.status === "claimed" ? "✅" : q.status === "ready" ? "🎁" : q.weekly ? "📅" : "🎯"}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-white">{q.title}</span>
              <span className="block text-[11px] text-slate-400">{q.text}</span>
              {q.weekly && q.status !== "claimed" && (
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 max-w-[160px] rounded-full bg-[#1e1f22] overflow-hidden">
                    <span className="block h-full bg-[#5865f2]" style={{ width: `${Math.round(((q.have || 0) / q.need) * 100)}%` }} />
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {q.have || 0}/{q.need}
                  </span>
                </span>
              )}
            </span>
            <span className="text-xs font-bold text-amber-200 whitespace-nowrap">⭐ {Math.round(q.stars * mult)}</span>
            {q.status === "ready" ? (
              <button disabled={busy === q.id || !canClaim} onClick={() => claim(q)} title={canClaim ? "" : "You've claimed 2 quests today. Come back tomorrow!"} className="rounded-md bg-[#248046] hover:bg-[#1a6334] px-3 py-1.5 text-xs font-bold text-[#fff] disabled:opacity-40">
                Claim
              </button>
            ) : q.status === "todo" && q.link ? (
              <a href={q.link} className="rounded-md bg-[#4e5058] px-3 py-1.5 text-xs text-slate-100 hover:bg-[#6d6f78]">
                Go
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileEditor({ tab, setTab, me, stars, meta, flash, onClose, onSaved, onStars }) {
  const [draft, setDraft] = useState({ name: me.name, avatar: me.avatar, avatarBg: me.avatarBg, nameColor: me.nameColor, frame: me.frame || "", badge: me.badge || "", banner: me.banner || "", deco: me.deco || "", effect: me.effect || "", bio: me.bio || "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const owned = meta.owned || [];
  const shop = meta.shop || {};
  const plus = meta.plus || {};
  const ownedColors = Object.entries(shop).filter(([id, it]) => it.kind === "name_color" && owned.includes(id)).map(([, it]) => it.value);
  const colors = [...(meta.freeColors || []), ...ownedColors];
  const preview = { ...me, ...draft };

  const save = () => {
    setSaving(true);
    setErr("");
    chatApi("/me", "PATCH", draft)
      .then((r) => {
        onSaved(r.me);
        onClose();
      })
      .catch((e) => setErr(e.message))
      .finally(() => setSaving(false));
  };
  const field = "mt-1 w-full rounded-lg bg-[#1e1f22] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <Modal onClose={onClose} wide>
      <div className="flex border-b border-black/30 px-5 pt-4 gap-4">
        {[["profile", "My profile"], ["quests", "Quests"], ["shop", "Star shop"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`pb-3 text-xs font-semibold border-b-2 ${tab === id ? "border-[#5865f2] text-white" : "border-transparent text-slate-400"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto pb-3 text-xs font-bold text-amber-200 pr-8">⭐ {stars}</span>
      </div>
      {tab === "quests" ? (
        <Quests meta={meta} onStars={(s) => onStars(s)} flash={flash} />
      ) : tab === "profile" ? (
        <div className="p-5 grid sm:grid-cols-2 gap-5">
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-400">Display name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={24} className={field} />
            </label>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Avatar</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(meta.avatars || []).map((a) => (
                  <button key={a} onClick={() => setDraft({ ...draft, avatar: a })} className={`w-8 h-8 rounded-lg text-base ${draft.avatar === a ? "bg-[#5865f2]" : "bg-[#1e1f22] hover:bg-[#404249]"}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Avatar color</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(meta.avatarBgs || []).map((c) => (
                  <button key={c} aria-label={c} onClick={() => setDraft({ ...draft, avatarBg: c })} className={`keep-color w-6 h-6 rounded-full ${draft.avatarBg === c ? "ring-2 ring-white" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Name tag color</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <button key={c} aria-label={c} onClick={() => setDraft({ ...draft, nameColor: c })} className={`keep-color w-6 h-6 rounded-full ${draft.nameColor === c ? "ring-2 ring-white" : ""}`} style={{ background: c }} />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Get more colors in the Star shop{plus.plus ? "" : ", or all of them free with Pro and up"}.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["frame", "Avatar frame"], ["badge", "Badge"], ["banner", "Profile banner"], ["deco", "Decoration"], ["effect", "Name effect"]].map(([f, label]) => (
                <label key={f} className="block">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
                  <select value={draft[f]} onChange={(e) => setDraft({ ...draft, [f]: e.target.value })} className="mt-1 w-full rounded-lg bg-[#1e1f22] px-2 py-2 text-xs text-white outline-none">
                    <option value="">None</option>
                    {Object.entries(shop)
                      .filter(([id, it]) => it.kind === f && owned.includes(id))
                      .map(([id, it]) => (
                        <option key={id} value={it.value}>
                          {it.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-[10px] font-bold uppercase text-slate-400">About me</span>
              <textarea value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value.slice(0, 190) })} rows={3} placeholder="Say something about yourself (no personal info!)" className={`${field} resize-none`} />
            </label>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Preview</span>
            <div className="mt-1 rounded-xl bg-[#1e1f22] overflow-hidden">
              <div className="h-14" style={{ background: bannerOf(preview) }} />
              <div className="px-4 pb-4 -mt-8">
                <Avatar user={preview} size={60} online />
                <p className="mt-2 text-base">
                  <Name user={preview} />
                </p>
                {draft.bio && <p className="mt-1 text-xs text-slate-300 whitespace-pre-wrap break-words">{draft.bio}</p>}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-fuchsia-400/25 bg-gradient-to-br from-indigo-600/20 to-fuchsia-600/15 p-3">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Gem className="w-4 h-4 text-fuchsia-300" /> Nebulux Plus {plus.plus ? "is on" : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                {plus.plus
                  ? `Thanks for being on ${plus.plan === "pro" ? "Pro" : plus.plan === "team" ? "Team" : "a paid plan"}! You have every name color, the Glow frame and the 💎 badge free, and ${plus.mult}× stars from quests.`
                  : "Pro and up get every name color, the Glow frame and the 💎 badge free, plus 1.5× to 2× stars from quests."}
              </p>
              {!plus.plus && (
                <a href="/chat/plans" className="mt-2 inline-block rounded-md bg-[#5865f2] hover:bg-[#4752c4] px-3 py-1 text-xs font-semibold text-[#fff]">
                  See plans
                </a>
              )}
            </div>
            <button onClick={() => setTab("quests")} className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#404249] text-[#fff] text-xs font-semibold hover:bg-[#4e5058]">
              <Trophy className="w-4 h-4 text-amber-200" /> Do quests to earn stars
            </button>
            {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
            <button onClick={save} disabled={saving} className="mt-3 w-full px-3 py-2 rounded-lg bg-emerald-600 text-[#fff] text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
        <Shop packs={meta.starPacks} shop={shop} owned={owned} stars={stars} onStars={onStars} />
      )}
    </Modal>
  );
}

// The Star shop: name colors, avatar frames and badges, bought with stars from quests.
const SHOP_GROUPS = [
  ["name_color", "Name tag colors", "Your name shows in this color everywhere in the chat."],
  ["frame", "Avatar frames", "A glowing ring around your avatar."],
  ["badge", "Badges", "Shown next to your name."],
  ["banner", "Profile banners", "The picture strip at the top of your profile."],
  ["deco", "Avatar decorations", "A little extra sitting on your avatar."],
  ["effect", "Name effects", "Make your name shimmer, shine or glow."],
];
function Shop({ shop, owned, stars, onStars, packs }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const buy = (id) => {
    setErr("");
    setBusy(id);
    chatApi("/shop/buy", "POST", { item: id })
      .then((r) => onStars(r.stars ?? r.orbs, r.owned))
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(""));
  };
  return (
    <div className="p-4 space-y-5">
      {err && <p className="text-xs text-red-400">{err}</p>}
      {SHOP_GROUPS.map(([kind, title, text]) => (
        <section key={kind}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{title}</p>
          <p className="text-[11px] text-slate-500 mb-2">{text}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {Object.entries(shop)
              .filter(([, it]) => it.kind === kind)
              .map(([id, it]) => {
                const have = owned.includes(id);
                const short = stars < it.price;
                return (
                  <div key={id} className={`rounded-xl border p-3 flex flex-col items-center text-center gap-1.5 ${have ? "border-emerald-400/30 bg-emerald-500/5" : "border-black/30 bg-[#383a40]"}`}>
                    <span className="keep-color w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: kind === "name_color" ? it.value : kind === "banner" ? BANNER[it.value] : "#1e1f22" }}>
                      {kind === "badge" || kind === "deco" ? it.value : kind === "frame" ? <span className={`w-9 h-9 rounded-full bg-slate-600 ${FRAME[it.value]}`} /> : kind === "effect" ? <span className="text-sm font-bold" style={EFFECT[it.value]}>Aa</span> : ""}
                    </span>
                    <span className="text-xs font-medium text-white leading-tight" style={kind === "name_color" ? { color: it.value } : undefined}>
                      {it.name}
                    </span>
                    {have ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                        <Check className="w-3.5 h-3.5" /> Owned
                      </span>
                    ) : it.plusOnly ? (
                      <a href="/chat/plans" className="text-[11px] text-fuchsia-200 hover:underline">💎 Free with Pro and up</a>
                    ) : (
                      <button disabled={short || busy === id} onClick={() => buy(id)} title={short ? `You need ${it.price - stars} more stars. Do quests to earn them.` : ""} className="w-full rounded-md bg-[#5865f2] hover:bg-[#4752c4] py-1 text-[11px] font-semibold text-[#fff] disabled:opacity-40">
                        ⭐ {it.price}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
      <BuyStars packs={packs} onStars={onStars} />
      <p className="text-[11px] text-slate-500">To wear what you bought, open Profile and perks.</p>
    </div>
  );
}

// Full-page Quests and Shop (like Discord's own pages), with a galaxy banner on top.
function PageBanner({ icon, title, text, stars }) {
  return (
    <div className="m-4 rounded-2xl bg-gradient-to-br from-indigo-600/40 via-fuchsia-600/25 to-transparent border border-black/30 p-4 flex items-center gap-4">
      <img src="/logo.png" alt="" className="w-14 h-14 rounded-full animate-[spin_8s_linear_infinite] shadow-[0_0_18px_rgba(168,85,247,0.6)]" />
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-white">
          {icon} {title}
        </p>
        <p className="text-[11px] text-slate-300">{text}</p>
      </div>
      <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-amber-200 whitespace-nowrap">⭐ {stars}</span>
    </div>
  );
}

// Stars for money, through the same checkout as plans and credit packs. When the payment
// is done, the chat server adds the stars (POST /stars/sync, run each time the shop opens).
function BuyStars({ packs, onStars }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    chatApi("/stars/sync", "POST")
      .then((r) => r.added && onStars(r.stars ?? r.orbs))
      .catch(() => {});
  }, []);
  if (!packs) return null;
  const buy = async (key) => {
    setErr("");
    setBusy(key);
    try {
      const res = await base44.functions.invoke("create-checkout", { productId: `credits-stars-${key}` });
      if (!res.data?.redirectUrl) throw new Error();
      window.location.href = res.data.redirectUrl;
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't start the payment. Try again in a minute.");
      setBusy("");
    }
  };
  return (
    <section className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-400/10 to-transparent p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-200">Get more stars</p>
      <p className="text-[11px] text-slate-400 mb-2">Can't wait for quests? Buy stars. Ask a parent first if you're under 18.</p>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(packs).map(([key, p], i) => (
          <button key={key} disabled={!!busy} onClick={() => buy(key)} className="rounded-lg bg-[#2b2d31] border border-black/20 p-2.5 text-center hover:border-amber-300/40 disabled:opacity-50">
            <span className="block text-lg">{["⭐", "🌟", "💫"][i] || "⭐"}</span>
            <span className="block text-xs font-bold text-white">{p.stars} stars</span>
            <span className="mt-1 block rounded-md bg-[#5865f2] py-1 text-[11px] font-semibold text-[#fff]">{busy === key ? "Opening…" : `$${p.price}`}</span>
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-[11px] text-red-400">{err}</p>}
    </section>
  );
}
