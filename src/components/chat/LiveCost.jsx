import React from "react";
import { useAiActivity, useNow, liveCost, elapsedText, tokenText } from "@/lib/aiActivity";

// "≈ 12.4K tokens · 12s" under an answer being written: what it has cost so far and how long it's taken.
export default function LiveCost({ activityKey, className = "" }) {
  const all = useAiActivity();
  const e = activityKey ? all[activityKey] : null;
  const now = useNow(1000, !!e && e.status === "working");
  if (!e || e.status !== "working") return null;
  const cost = liveCost(e);
  return (
    <p className={`text-[11px] text-slate-400 ${className}`} aria-live="off">
      {cost != null ? `≈ ${tokenText(cost)} tokens so far · ` : ""}
      {elapsedText(now - e.startedAt)}
    </p>
  );
}
