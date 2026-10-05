import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Code, Gem, Star, ChevronDown, Lock } from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import { hasProFeatures } from "@/lib/plans";

const OPTIONS = [
  { id: "ai", label: "AI", icon: Sparkles, color: "text-indigo-400" },
  { id: "code", label: "Nebulux Code", icon: Code, color: "text-emerald-300" },
  { id: "opus5", label: "Galaxy", icon: Gem, color: "text-sky-300" },
  { id: "fable", label: "Space", icon: Star, color: "text-fuchsia-300" },
];

// labels: other names for the options in one place (the home chat calls Nebulux Code "Ultra").
export default function AiChooser({ value, onChange, plan, allowFable, labels = {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Access follows credits, not plans: an AI is unlocked while you have credits for it
  // (from a plan, a bought pack, referrals, promo codes or an admin). Before credits load,
  // allow the basics and fall back to the plan for the others. An AI with no credits can
  // still be picked: the out-of-credits card then offers to buy its credits (any plan) or upgrade.
  const credits = useAppShell()?.credits;
  const REMAINING = { ai: "aiRemaining", code: "aiCodeRemaining", opus5: "galaxy5Remaining", fable: "space5Remaining" };
  const canUse = (id) => {
    if ((id === "opus5" || id === "fable") && !allowFable) return false;
    const left = credits?.[REMAINING[id]];
    if (typeof left === "number" && Number.isFinite(left)) return left > 0;
    if (id === "ai" || id === "code") return true;
    return hasProFeatures(plan);
  };

  const current = OPTIONS.find((o) => o.id === value) || OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 text-slate-200 text-xs font-medium hover:bg-slate-700/70 transition-colors"
      >
        <current.icon className={`w-3.5 h-3.5 ${current.color}`} />
        {current.id === "fable" && (
          <span title="This AI uses more credits than the others" className="text-amber-400 font-bold cursor-help leading-none">!</span>
        )}
        {labels[current.id] || current.label}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-0 w-48 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-1 z-30"
          >
            {OPTIONS.map((o) => {
              const allowed = canUse(o.id);
              const offHere = (o.id === "opus5" || o.id === "fable") && !allowFable;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={offHere}
                  onClick={() => {
                    if (offHere) return;
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    o.id === value ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"
                  } ${offHere ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <o.icon className={`w-4 h-4 ${o.color}`} />
                    {o.id === "fable" && <span title="This AI uses more credits than the others" className="text-amber-400 font-bold cursor-help">!</span>}
                    {labels[o.id] || o.label}
                  </span>
                  {offHere ? (
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    !allowed && <span className="text-[10px] font-semibold text-amber-300">Buy credits</span>
                  )}
                </button>
              );
            })}
            {!allowFable && (
              <p className="px-2.5 py-1 text-[10px] text-slate-500">Galaxy & Space: Website Designer only</p>
            )}
            {OPTIONS.some((o) => !canUse(o.id)) && (
              <p className="px-2.5 py-1 text-[10px] text-slate-500">No credits for an AI? Pick it to buy its credits, whatever your plan, or upgrade.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}