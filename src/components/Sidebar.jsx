import React, { useEffect, useState } from "react";
import { pinnedIds, togglePin, onPinsChange, withPinsFirst } from "@/lib/pinnedChats";
import { motion, AnimatePresence } from "framer-motion";
import { Pen, Plus, Code, Sparkles, Gem, Star, Check, X, ShoppingBag, Globe, Gamepad2, Search, Pin, PinOff } from "lucide-react";
import BlackholeIcon from "@/components/BlackholeIcon";
import PullToRefresh from "@/components/PullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";

const SKIP_KEY = "infinity-ai-skip-delete-confirm";

function CreditBar({ icon, label, used, total, gradient }) {
  const unlimited = total === Infinity;
  const safeTotal = unlimited ? 1 : total > 0 ? total : 1;
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / safeTotal) * 100));
  const remaining = unlimited ? "∞" : Math.max(0, total - used);
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-300 font-medium flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="text-slate-400">{unlimited ? `${used} / ∞` : `${used} / ${total}`}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-700/60 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${gradient}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-slate-500 mt-0.5">{unlimited ? "Unlimited" : `${remaining} left`}</p>
    </div>
  );
}

export default function Sidebar({ conversations, activeId, onSelect, onRename, onDelete, onRefresh, onGoHome, onGoCode, onNewChat, onGoSubscriptions, onGoDesigner, onGoGames, onGoMonitor, isAdmin, credits = {}, gapAfter = 0 }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [neverShow, setNeverShow] = useState(false);
  // Filters the chat list by title or by what was said in the chat.
  const [search, setSearch] = useState("");
  const [pins, setPins] = useState(pinnedIds);
  useEffect(() => onPinsChange(setPins), []);
  const needle = search.trim().toLowerCase();
  const ordered = withPinsFirst(conversations, pins);
  const shown = needle
    ? ordered.filter(
        (c) =>
          String(c.title || "").toLowerCase().includes(needle) ||
          (c.messages || []).some((m) => String(m.content || "").toLowerCase().includes(needle))
      )
    : ordered;
  const isMobile = useIsMobile();
  const targetWidth = isMobile ? Math.min((typeof window !== "undefined" ? window.innerWidth : 400) * 0.86, 320) : 220;

  const startEdit = (conv) => {
    setEditingId(conv.id);
    setEditValue(conv.title);
  };

  const saveEdit = () => {
    if (editingId) onRename(editingId, editValue.trim() || "Untitled");
    setEditingId(null);
  };

  const askDelete = (e, conv) => {
    e.stopPropagation();
    if (localStorage.getItem(SKIP_KEY) === "1") {
      onDelete(conv.id);
      return;
    }
    setConfirmId(conv.id);
  };

  const confirmDelete = () => {
    if (neverShow) localStorage.setItem(SKIP_KEY, "1");
    onDelete(confirmId);
    setConfirmId(null);
    setNeverShow(false);
  };

  const cancelDelete = () => {
    setConfirmId(null);
    setNeverShow(false);
  };

  return (
    <>
      <motion.div
        // A plain ease, not a spring: a spring overshoots, and the chat beside it wobbled left and
        // right. The space after it (gapAfter) grows with it, so the chat slides instead of jumping.
        initial={{ width: 0, opacity: 0, marginRight: 0 }}
        animate={{ width: targetWidth, opacity: 1, marginRight: isMobile ? 0 : gapAfter }}
        exit={{ width: 0, opacity: 0, marginRight: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`shrink-0 overflow-hidden ${isMobile ? "fixed left-0 top-0 z-40 h-[100dvh]" : "h-[524px]"}`}
      >
        <PullToRefresh
          style={{ width: targetWidth }}
          onRefresh={onRefresh}
          className={`h-full sidebar-scroll overflow-y-auto ${isMobile ? "bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 shadow-2xl" : "bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl"}`}
        >
          {/* Header */}
          <div className="p-3 space-y-0.5">
            <button
              onClick={onGoHome}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
                <BlackholeIcon className="w-full h-full" />
              </div>
              <span className="text-[13px] font-semibold">Nebulux AI</span>
            </button>
            <button
              onClick={onGoCode}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                <Code className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span className="text-[13px] font-medium">Nebulux Code</span>
            </button>
            <button
              onClick={onGoDesigner}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-sky-300" />
              </div>
              <span className="text-[13px] font-medium">Website Designer</span>
            </button>
            <button
              onClick={onGoGames}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                <Gamepad2 className="w-3.5 h-3.5 text-fuchsia-300" />
              </div>
              <span className="text-[13px] font-medium">Nebulux Games</span>
            </button>
            <button
              onClick={onGoSubscriptions}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <span className="text-[13px] font-medium">Shop</span>
            </button>
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <span className="text-[13px] font-medium">New Chat</span>
            </button>
          </div>

          {/* Credit bars */}
          <div className="px-3 space-y-1.5 pb-1.5">
            <CreditBar
              icon={<Sparkles className="w-3 h-3 text-indigo-400" />}
              label="AI"
              used={credits.aiUsed ?? 0}
              total={credits.aiTotal ?? 0}
              gradient="from-indigo-500 to-fuchsia-500"
            />
            <CreditBar
              icon={<Code className="w-3 h-3 text-emerald-300" />}
              label="Nebulux Code"
              used={credits.aiCodeUsed ?? 0}
              total={credits.aiCodeTotal ?? 0}
              gradient="from-emerald-500 to-teal-500"
            />
            {credits.galaxy5Total > 0 && (
              <CreditBar
                icon={<Gem className="w-3 h-3 text-sky-300" />}
                label="Galaxy"
                used={credits.galaxy5Used ?? 0}
                total={credits.galaxy5Total ?? 0}
                gradient="from-sky-500 to-indigo-500"
              />
            )}
            {credits.space5Total > 0 && (
              <CreditBar
                icon={<Star className="w-3 h-3 text-fuchsia-300" />}
                label="Space"
                used={credits.space5Used ?? 0}
                total={credits.space5Total ?? 0}
                gradient="from-fuchsia-500 to-pink-500"
              />
            )}
          </div>

          {/* Previous chats label (non-clickable) */}
          <div className="px-3 pb-1.5">
            <div className="px-2 py-1 text-slate-500 text-[11px] font-medium cursor-default select-none">
              Previous Chats
            </div>
            {conversations.length > 3 && (
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  className="w-full bg-slate-800/70 border border-slate-700/50 focus:border-indigo-500/50 rounded-lg pl-6 pr-2 py-1 text-[12px] text-slate-200 placeholder:text-slate-500 outline-none"
                />
              </div>
            )}
          </div>

          <div className="mx-3 h-px bg-slate-700/50" />

          {/* Chat list */}
          <div className="p-1.5 space-y-0.5 pb-3">
            {conversations.length === 0 && (
              <p className="text-center text-slate-600 text-xs py-6">No chats yet</p>
            )}
            {needle && shown.length === 0 && (
              <p className="text-center text-slate-600 text-xs py-6">No chats match</p>
            )}
            {shown.map((conv) => (
              <div
                key={conv.id}
                onClick={() => editingId !== conv.id && onSelect(conv.id)}
                className={`group relative rounded-lg px-2 py-1.5 min-h-[44px] flex items-center transition-colors cursor-pointer ${
                  conv.id === activeId ? "bg-slate-800/80" : "hover:bg-slate-800/40"
                }`}
              >
                {editingId === conv.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 bg-slate-900 border border-indigo-500/50 rounded-md px-2 py-1 text-xs text-white outline-none"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-indigo-600 text-[#fff] shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="flex items-center gap-1 min-w-0 text-xs text-slate-200 pr-[148px] sm:pr-1 sm:group-hover:pr-[148px]">
                      {pins.includes(conv.id) && <Pin className="w-3 h-3 shrink-0 text-amber-300" aria-label="Pinned" />}
                      <span className="truncate">{conv.title}</span>
                    </p>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700/80 border border-slate-600/50 text-slate-300 hover:text-amber-300"
                        title={pins.includes(conv.id) ? "Unpin" : "Pin to the top"}
                        aria-label={pins.includes(conv.id) ? "Unpin chat" : "Pin chat to the top"}
                      >
                        {pins.includes(conv.id) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700/80 border border-slate-600/50 text-slate-300 hover:text-white"
                        title="Rename"
                      >
                        <Pen className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => askDelete(e, conv)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-700/80 border border-slate-600/50 text-slate-300 hover:text-red-400"
                        title="Delete"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </PullToRefresh>
      </motion.div>

      <AnimatePresence>
        {confirmId && (
          <motion.div
            key="confirm-overlay"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white text-center">Are you sure you want to delete your chat?</h3>
              </div>
              <div className="flex gap-3 px-6">
                <button
                  onClick={cancelDelete}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
              <div className="h-px bg-slate-700/50 mx-6 mt-5" />
              <label className="flex items-center gap-2 px-6 py-4 cursor-pointer select-none text-slate-400 text-sm">
                <input
                  type="checkbox"
                  checked={neverShow}
                  onChange={(e) => setNeverShow(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500"
                />
                Never show this again
              </label>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}