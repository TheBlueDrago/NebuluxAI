import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// A small note while the AI is overloaded and Nebulux is quietly trying again (lib/aiStream.js
// sends "nx-ai-busy"), so a slow answer doesn't look broken.
export default function BusyNotice() {
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    let t = 0;
    const on = (e) => {
      setBusy(e.detail || {});
      clearTimeout(t);
      t = setTimeout(() => setBusy(null), (e.detail?.waitMs || 4000) + 2500);
    };
    window.addEventListener("nx-ai-busy", on);
    return () => { window.removeEventListener("nx-ai-busy", on); clearTimeout(t); };
  }, []);
  if (!busy) return null;
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] z-[70] flex items-center gap-2 rounded-full border border-[var(--cl-border)] bg-[var(--cl-card)] px-4 py-2 text-[13.5px] text-[var(--cl-text)] shadow-xl">
      <Loader2 className="w-4 h-4 animate-spin text-[var(--cl-muted)]" />
      Lots of people are using the AI right now. Trying again{busy.of > 1 ? ` (${busy.attempt}/${busy.of})` : ""}…
    </div>
  );
}
