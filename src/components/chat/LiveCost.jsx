import React from "react";
import { useAiActivity, useNow, liveCost, elapsedText } from "@/lib/aiActivity";

// "≈ 3 credits · 12s" under an answer being written: what it has cost so far and how long it's taken.
// since / extra: when answers run back to back (Nebulux Code), keep counting from the first one.
export default function LiveCost({ activityKey, className = "", since, extra = 0 }) {
  const all = useAiActivity();
  const e = activityKey ? all[activityKey] : null;
  const now = useNow(1000, !!e && e.status === "working");
  if (!e || e.status !== "working") return null;
  const now0 = liveCost(e);
  const cost = now0 == null ? (extra ? extra : null) : now0 + extra;
  return (
    <p className={`text-[11px] text-slate-400 ${className}`} aria-live="off">
      {cost != null ? `≈ ${cost} credit${cost === 1 ? "" : "s"} so far · ` : ""}
      {elapsedText(now - (since || e.startedAt))}
    </p>
  );
}
