import React from "react";
import { Sparkles, Code, Gem, Star } from "lucide-react";

export const REWARD_INFO = [
  { tier: "ai", label: "Nebulux AI", icon: Sparkles, color: "text-indigo-300" },
  { tier: "aiCode", label: "Nebulux Code", icon: Code, color: "text-emerald-300" },
  { tier: "galaxy5", label: "Space", icon: Gem, color: "text-sky-300" },
  { tier: "space5", label: "Nebula", icon: Star, color: "text-fuchsia-300" },
];
export const REWARD_LABEL = Object.fromEntries(REWARD_INFO.map((r) => [r.tier, r.label]));

// Four buttons, one per AI: "+25 Nebulux AI", "+15 Galaxy", ...
export default function RewardPicker({ rewards, onPick, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {REWARD_INFO.map((o) => (
        <button
          key={o.tier}
          type="button"
          disabled={disabled}
          onClick={() => onPick(o.tier)}
          className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-slate-700 text-slate-100 text-xs hover:bg-slate-600 disabled:opacity-50"
        >
          <o.icon className={`w-3.5 h-3.5 ${o.color}`} />+{rewards?.[o.tier]} {o.label}
        </button>
      ))}
    </div>
  );
}
