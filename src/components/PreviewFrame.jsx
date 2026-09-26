import React, { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { withPreviewShim, PREVIEW_SANDBOX } from "@/lib/previewShim";

// A game or website shown in a sandboxed frame, with a fix for the "black screen" problem: the
// preview shim (lib/previewShim.js) reports if the page crashed or still shows nothing a few
// seconds after loading. The first time, the frame quietly loads it again (most black screens
// are a one-off timing problem on start-up); if it happens again, a Reload button appears.
export default function PreviewFrame({ html, title, className = "w-full h-full", ...rest }) {
  const ref = useRef(null);
  const [round, setRound] = useState(0);
  const [stuck, setStuck] = useState(false);
  const retried = useRef(false);

  useEffect(() => {
    retried.current = false;
    setStuck(false);
  }, [html]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || d.type !== "nebulux-health" || !ref.current || e.source !== ref.current.contentWindow) return;
      if (!d.blank) {
        setStuck(false);
        return;
      }
      if (!retried.current) {
        retried.current = true;
        setRound((r) => r + 1);
      } else setStuck(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const reload = () => {
    setStuck(false);
    setRound((r) => r + 1);
  };

  return (
    <div className="relative w-full h-full">
      <iframe key={round} ref={ref} srcDoc={withPreviewShim(html)} title={title} sandbox={PREVIEW_SANDBOX} className={className} {...rest} />
      {stuck && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900/95 border border-white/10 px-4 py-2.5 shadow-2xl text-sm text-slate-200">
            <span>Still a black screen? It may be waiting for a tap, or it didn't start.</span>
            <button onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-[#fff]">
              <RotateCcw className="w-3.5 h-3.5" /> Reload
            </button>
            <button onClick={() => setStuck(false)} className="text-xs text-slate-400 hover:text-white">
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
