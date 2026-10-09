import React from "react";
import { X, Clock } from "lucide-react";

// Messages that wait for the AI to finish ("after you finish…", see useMessageQueue). Anything
// else sent while the AI is writing interrupts it instead, so this list is usually empty.
// Pass the object returned by useMessageQueue as `q`.
export default function QueueList({ q }) {
  const { queue, notice, dismissNotice, remove } = q;
  return (
    <>
      {notice && (
        <div className="mb-2 flex items-start gap-2 bg-indigo-900/30 border border-indigo-500/40 rounded-lg px-3 py-2 text-xs text-indigo-100">
          <span className="flex-1">{notice}</span>
          <button onClick={dismissNotice} className="text-indigo-300 hover:text-white" title="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {queue.length > 0 && (
        <div className="mb-2 flex flex-col items-end gap-1.5">
          {queue.map((it) => (
            <div key={it.id} className="group flex max-w-[85%] items-start gap-2 rounded-2xl border border-dashed border-slate-500/50 bg-slate-800/40 px-3 py-2 text-sm text-slate-200">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{it.text}</span>
              <button onClick={() => remove(it.id)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-300" title="Don't send">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <span className="text-[11px] text-slate-400">Sends when Nebulux finishes</span>
        </div>
      )}
    </>
  );
}
