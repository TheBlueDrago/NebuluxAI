import React, { useEffect, useState } from "react";
import { Plus, Code, Globe, Gamepad2, ShoppingBag, MessageSquare, PanelLeft, Search, Pin, PinOff, Pen, X, Check, Activity, ChevronUp, Sun, Moon, Settings, Gift, HelpCircle, LogOut, Ticket, Gauge, Languages, ArrowUpCircle, LayoutGrid, History, Info, ChevronRight, KeyRound, ExternalLink } from "lucide-react";
import { useInstallApp } from "@/lib/installPrompt";
import { showNotice } from "@/lib/dialogs";
import { signOut } from "@/lib/signOut";
import { markSessionOnly, noteSignedOut } from "@/lib/sessionOnly";
import { stashChats } from "@/lib/chatStash";
import { pinnedIds, togglePin, onPinsChange, withPinsFirst } from "@/lib/pinnedChats";
import { useAiActivity } from "@/lib/aiActivity";
import StatusMark from "@/components/chat/StatusMark";
import BlackholeIcon from "@/components/BlackholeIcon";
import { askConfirm } from "@/lib/dialogs";

// The app's left sidebar, laid out like Claude's: logo and collapse button, New chat, the tools,
// the recent chats, and the account at the bottom. Collapsed, it's a thin strip of icons.
const PLAN_NAMES = { free: "Free plan", pro: "Pro plan", team: "Team plan", enterprise: "Enterprise plan", max: "Max plan" };

function NavRow({ icon: Icon, label, onClick, collapsed, active, accent }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-[14px] transition-colors ${
        active ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]/70 hover:text-[var(--cl-text)]"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {accent ? (
        <span className="w-6 h-6 rounded-full bg-[var(--cl-accent)] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--cl-side)]" strokeWidth={2.5} />
        </span>
      ) : (
        <Icon className="w-[18px] h-[18px] shrink-0" />
      )}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function ClaudeSidebar({ shell, collapsed, onToggle, mobile, onClose, path }) {
  const { conv, currentUser, effPlan, isAdmin, avatarInitial, openProfile, credits = {} } = shell;
  const activity = useAiActivity();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [pins, setPins] = useState(pinnedIds);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const app = useInstallApp();
  // Ctrl+, (Cmd+, on a Mac) opens Settings, like Claude.
  useEffect(() => {
    const k = (e) => (e.ctrlKey || e.metaKey) && e.key === "," && (e.preventDefault(), openProfile("general"));
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [openProfile]);
  const getApps = () => {
    if (app.canPrompt) app.install();
    else if (app.ios) showNotice("On iPhone or iPad: tap the Share button in Safari, then Add to Home Screen.");
    else showNotice("Nebulux AI is already installed here, or this browser can't install apps. In Chrome or Edge, use the install icon in the address bar.");
  };
  useEffect(() => {
    if (!menu) return;
    const off = (e) => !e.target.closest?.("[data-acct]") && setMenu(false);
    window.addEventListener("mousedown", off);
    return () => window.removeEventListener("mousedown", off);
  }, [menu]);
  const logOut = () => {
    markSessionOnly(false);
    stashChats(currentUser?.id);
    noteSignedOut("signed-out");
    signOut();
  };
  useEffect(() => onPinsChange(setPins), []);
  const needle = search.trim().toLowerCase();
  const list = withPinsFirst(conv.conversations || [], pins).filter(
    (c) => !needle || String(c.title || "").toLowerCase().includes(needle) || (c.messages || []).some((m) => String(m.content || "").toLowerCase().includes(needle))
  );
  const go = (fn) => () => {
    fn();
    if (mobile) onClose?.();
  };
  const name = String(currentUser?.full_name || currentUser?.email || "You").trim();
  const del = async (c) => {
    if (await askConfirm("Delete this chat?")) conv.deleteConversation(c.id);
  };

  return (
    <aside
      className={`h-[100dvh] flex flex-col bg-[var(--cl-side)] border-r border-[var(--cl-border)]/60 text-[var(--cl-muted)] transition-[width] duration-200 ${
        mobile ? "fixed left-0 top-0 z-50 w-[288px] shadow-2xl" : collapsed ? "w-[56px] shrink-0" : "w-[288px] shrink-0"
      }`}
    >
      {/* logo + collapse */}
      <div className={`flex items-center h-14 px-3 gap-1 ${collapsed && !mobile ? "flex-col h-auto py-3 justify-center" : ""}`}>
        {/* light / dark, in the top-left corner */}
        <button onClick={shell.toggleLight} className="p-1.5 rounded-lg hover:bg-[var(--cl-hover)]/70 text-[var(--cl-muted)]" title={shell.lightMode ? "Dark mode" : "Light mode"} aria-label={shell.lightMode ? "Switch to dark mode" : "Switch to light mode"}>
          {shell.lightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        {!(collapsed && !mobile) && (
          <button onClick={go(shell.goHome)} className="flex-1 min-w-0 flex items-center gap-2 text-[var(--cl-text)] font-semibold text-[17px] tracking-tight" aria-label="Nebulux AI home">
            <BlackholeIcon className="w-6 h-6" />
            Nebulux AI
          </button>
        )}
        <button onClick={mobile ? onClose : onToggle} className="p-1.5 rounded-lg hover:bg-[var(--cl-hover)]/70 text-[var(--cl-muted)]" title={mobile ? "Close" : collapsed ? "Open sidebar" : "Close sidebar"} aria-label="Toggle sidebar">
          {mobile ? <X className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Chat | Code switch at the top, like the Claude app */}
      {!(collapsed && !mobile) ? (
        <div className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--cl-hover)] p-1 text-[13px]">
          <button onClick={go(shell.goHome)} className={`rounded-md py-1.5 ${path !== "/chat/code" ? "bg-[var(--cl-card)] text-[var(--cl-text)]" : "text-[var(--cl-faint)] hover:text-[var(--cl-text)]"}`}>Chat</button>
          <button onClick={go(shell.goCode)} className={`rounded-md py-1.5 ${path === "/chat/code" ? "bg-[var(--cl-card)] text-[var(--cl-text)]" : "text-[var(--cl-faint)] hover:text-[var(--cl-text)]"}`}>Code</button>
        </div>
      ) : (
        <div className="px-2 mb-1"><NavRow icon={Code} label="Nebulux Code" onClick={go(shell.goCode)} collapsed active={path === "/chat/code"} /></div>
      )}

      {/* new chat + tools */}
      <nav className="px-2 space-y-0.5">
        <NavRow icon={Plus} label="New chat" accent onClick={go(shell.newChat)} collapsed={collapsed && !mobile} />
        <NavRow icon={MessageSquare} label="Chats" onClick={() => { if (collapsed && !mobile) onToggle(); setSearching(true); }} collapsed={collapsed && !mobile} active={searching} />
        <NavRow icon={Globe} label="Website Designer" onClick={go(shell.goDesigner)} collapsed={collapsed && !mobile} />
        <NavRow icon={Gamepad2} label="Nebulux Games" onClick={go(shell.goGames)} collapsed={collapsed && !mobile} />
        <NavRow icon={ShoppingBag} label="Shop" onClick={go(shell.goPlans)} collapsed={collapsed && !mobile} />
        <NavRow icon={Gift} label="Invite friends, get credits" onClick={() => { openProfile("refer"); if (mobile) onClose?.(); }} collapsed={collapsed && !mobile} />
        {isAdmin && <NavRow icon={Activity} label="Monitor" onClick={go(shell.goMonitor)} collapsed={collapsed && !mobile} />}
      </nav>

      {/* recents */}
      {!(collapsed && !mobile) ? (
        <div className="flex-1 min-h-0 flex flex-col mt-4">
          <div className="px-4 flex items-center justify-between">
            <span className="text-[12px] text-[var(--cl-faint)]">Recents</span>
          </div>
          {searching && (
            <div className="px-3 mt-1.5 relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--cl-faint)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setSearch(""), setSearching(false))}
                placeholder="Search your chats..."
                className="w-full bg-[var(--cl-card)] border border-[var(--cl-border)] focus:border-[var(--cl-accent)]/60 rounded-lg pl-7 pr-2 py-1.5 text-[13px] text-[var(--cl-text)] placeholder:text-[var(--cl-faint)] outline-none"
              />
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-2 mt-1 pb-2">
            {list.length === 0 && <p className="px-2 py-3 text-[13px] text-[var(--cl-faint)]">{needle ? "No chats match" : "No chats yet"}</p>}
            {list.map((c) => (
              <div
                key={c.id}
                onClick={() => editingId !== c.id && (conv.selectConversation(c.id), shell.navigate("/chat"), mobile && onClose?.())}
                className={`group relative flex items-center rounded-lg px-2 py-1.5 cursor-pointer text-[13.5px] ${c.id === conv.activeId && path === "/chat" ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "hover:bg-[var(--cl-hover)]/70 hover:text-[var(--cl-text)]"}`}
              >
                {editingId === c.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (conv.renameConversation(c.id, editValue.trim() || "Untitled"), setEditingId(null));
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 min-w-0 bg-[var(--cl-card)] border border-[var(--cl-accent)]/60 rounded px-1.5 py-0.5 text-[13px] text-[var(--cl-text)] outline-none"
                    />
                    <button onClick={() => (conv.renameConversation(c.id, editValue.trim() || "Untitled"), setEditingId(null))} className="p-1 rounded hover:bg-[var(--cl-card)]" aria-label="Save name">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <StatusMark status={activity[`chat:${c.id}`]?.status} />
                    {pins.includes(c.id) && <Pin className="w-3 h-3 mr-1 shrink-0 text-[var(--cl-accent)]" />}
                    <span className="truncate flex-1 pr-1 group-hover:pr-20">{c.title}</span>
                    <span className="absolute right-1 hidden group-hover:flex items-center gap-0.5 bg-[var(--cl-hover)] rounded-md">
                      <button onClick={(e) => (e.stopPropagation(), togglePin(c.id))} className="p-1 rounded hover:text-[var(--cl-accent)]" title={pins.includes(c.id) ? "Unpin" : "Pin"} aria-label="Pin chat">
                        {pins.includes(c.id) ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={(e) => (e.stopPropagation(), setEditingId(c.id), setEditValue(c.title))} className="p-1 rounded hover:text-[var(--cl-text)]" title="Rename" aria-label="Rename chat">
                        <Pen className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => (e.stopPropagation(), del(c))} className="p-1 rounded hover:text-red-400" title="Delete" aria-label="Delete chat">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* account */}
      <div className="relative p-2 border-t border-[var(--cl-border)]/60" data-acct>
        {/* Claude-style account menu: opens upward from your name */}
        {menu && (
          <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] shadow-2xl py-1.5 text-[14px] z-10">
            <p className="px-3 pt-1 pb-2 text-[13px] text-[var(--cl-faint)] truncate">{currentUser?.email}</p>
            <button onClick={() => { setMenu(false); setMore(false); openProfile("general"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <Settings className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Settings</span>
              <span className="text-[12px] text-[var(--cl-faint)]">Ctrl+,</span>
            </button>
            <button onClick={() => { setMenu(false); setMore(false); openProfile("usage"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <Gauge className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Usage</span>
            </button>
            <button onClick={() => { setMenu(false); setMore(false); openProfile("general"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <Languages className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Language</span>
            </button>
            <button onClick={() => { setMenu(false); setMore(false); window.open("/contact", "_blank", "noopener"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <HelpCircle className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Get help</span>
            </button>
            <div className="my-1 h-px bg-[var(--cl-border)]" />
            <button onClick={() => { setMenu(false); setMore(false); shell.goPlans(); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <ArrowUpCircle className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Upgrade plan</span>
            </button>
            <button onClick={() => { setMenu(false); setMore(false); getApps(); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <LayoutGrid className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Get apps and extensions</span>
            </button>
            <button onClick={() => { setMenu(false); setMore(false); window.open("/whats-new", "_blank", "noopener"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <History className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">View changelog</span>
            </button>
            <div className="relative">
              <button onClick={() => setMore((m) => !m)} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
                <Info className="w-4 h-4 text-[var(--cl-muted)]" />
                <span className="flex-1">Learn more</span>
                <ChevronRight className="w-4 h-4 text-[var(--cl-faint)]" />
              </button>
              {more && (
                <div className={`${mobile ? "relative mx-3 mb-1" : "absolute left-full bottom-0 ml-1 w-48"} rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] shadow-2xl py-1.5`}>
                  {[["About Nebulux AI", "/about"], ["Guides", "/guides"], ["Terms of Service", "/terms"], ["Privacy Policy", "/privacy"], ["Safety", "/safety"]].map(([l, h]) => (
                    <a key={h} href={h} target="_blank" rel="noopener" onClick={() => { setMenu(false); setMore(false); }} className="block px-3 py-1.5 text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">{l}</a>
                  ))}
                </div>
              )}
            </div>
            {isAdmin && (
              <>
                <button onClick={() => { setMenu(false); setMore(false); shell.goMonitor(); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
                  <Activity className="w-4 h-4 text-[var(--cl-muted)]" />
                  <span className="flex-1">Monitor</span>
                </button>
                <button onClick={() => { setMenu(false); setMore(false); shell.goPromos(); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
                  <Ticket className="w-4 h-4 text-[var(--cl-muted)]" />
                  <span className="flex-1">Promo codes</span>
                </button>
              </>
            )}
            <button onClick={() => { setMenu(false); setMore(false); openProfile("refer"); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <Gift className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Refer friends</span>
            </button>
            <div className="my-1 h-px bg-[var(--cl-border)]" />
            <button onClick={() => { setMenu(false); window.open("/api", "_blank", "noopener"); if (mobile) onClose?.(); }} className="w-full flex items-start gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <KeyRound className="w-4 h-4 mt-0.5 text-[var(--cl-muted)]" />
              <span className="flex-1">Get API keys<span className="block text-[12.5px] text-[var(--cl-faint)]">on Nebulux Platform</span></span>
              <ExternalLink className="w-4 h-4 text-[var(--cl-muted)]" />
            </button>
            <div className="my-1 h-px bg-[var(--cl-border)]" />
            <button onClick={() => { setMenu(false); setMore(false); logOut(); if (mobile) onClose?.(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[var(--cl-text)] hover:bg-[var(--cl-hover)]/70">
              <LogOut className="w-4 h-4 text-[var(--cl-muted)]" />
              <span className="flex-1">Log out</span>
            </button>
          </div>
        )}
        <button
          onClick={() => setMenu((m) => !m)}
          className={`w-full flex items-center gap-2.5 rounded-lg p-2 hover:bg-[var(--cl-hover)]/70 text-left ${collapsed && !mobile ? "justify-center p-1" : ""}`}
          title="Your account and settings"
          aria-label="Your account and settings"
        >
          <span className="keep-color w-8 h-8 rounded-full bg-[var(--cl-muted)] text-[var(--cl-side)] flex items-center justify-center text-[13px] font-bold shrink-0">{avatarInitial}</span>
          {!(collapsed && !mobile) && (
            <>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] text-[var(--cl-text)] truncate">{name}</span>
                <span className="block text-[12px] text-[var(--cl-faint)] truncate">{PLAN_NAMES[effPlan] || "Free plan"}</span>
              </span>
              <ChevronUp className="w-4 h-4 text-[var(--cl-faint)]" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
