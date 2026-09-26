import React, { useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, UserPlus, Gift, Sparkles, ShoppingBag, Bot, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { onBell, localNotifications, markLocalRead, soundOn, setSound } from "@/lib/nebuluxChat";

const ICON = { message: MessageCircle, friend: UserPlus, reward: Gift, update: Sparkles, purchase: ShoppingBag, ai: Bot };
const ago = (iso) => {
  const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000);
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
};

// The bell next to the profile button: purchases, the AI
// finishing while you were away, and updates. A dot shows how many are new.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => localNotifications());
  const [sound, setSoundState] = useState(soundOn);
  const box = useRef(null);
  const navigate = useNavigate();


  useEffect(() => {
    const off = onBell((n) => setItems((cur) => [n, ...cur].slice(0, 40)));
    const onDoc = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => {
      off();
      document.removeEventListener("mousedown", onDoc);
    };
  }, []);

  const unread = items.filter((n) => !n.read).length;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      markLocalRead();
      setTimeout(() => setItems((cur) => cur.map((n) => ({ ...n, read: true }))), 1500);
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        title="Notifications"
        className="relative w-10 h-10 rounded-full bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-slate-200 hover:bg-slate-700/70"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[#fff] text-[10px] font-bold flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white">Notifications</p>
            <button
              type="button"
              onClick={() => {
                setSound(!sound);
                setSoundState(!sound);
              }}
              title={sound ? "Sound on" : "Sound off"}
              aria-label={sound ? "Turn notification sound off" : "Turn notification sound on"}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet</p>}
            {items.map((n) => {
              const Icon = ICON[n.kind] || Bell;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-800/70 ${n.read ? "" : "bg-indigo-500/5"}`}
                >
                  <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-indigo-300" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-200 break-words">{n.text}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{ago(n.at)}</span>
                  </span>
                  {!n.read && <span className="mt-2 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
