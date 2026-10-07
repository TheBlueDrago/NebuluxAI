import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Clock, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CreditControls from "./CreditControls";
import useEscape from "@/hooks/useEscape";
import useDialogFocus from "@/hooks/useDialogFocus";

const LABELS = { ai: "Nebulux AI", aiCode: "Galaxy", galaxy5: "Space", space5: "Nebula" };

function fmtTime(min) {
  if (!min) return "under a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export default function UserDetail({ user, onClose }) {
  useEscape(true, onClose);
  const dialogRef = useDialogFocus(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.functions
      .invoke("userActivity", { userId: user.id })
      .then((r) => setData(r.data))
      .catch(() => setError("Could not load this user's activity."));
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="User details"
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto sidebar-scroll bg-slate-900 border border-slate-700/60 rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{user.full_name || "Unnamed"}</h3>
            <p className="text-slate-400 text-sm truncate">{user.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <CreditControls userId={user.id} />

        {error && <p className="text-red-400 text-sm mt-6">{error}</p>}
        {!data && !error && (
          <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        )}

        {data && (
          <>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Time on the AI</p>
                <p className="text-white text-sm font-semibold">{fmtTime(data.minutesOnAi)}</p>
                <p className="text-[11px] text-slate-500">{data.sessions} session{data.sessions === 1 ? "" : "s"}</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                <p className="text-[11px] text-slate-400 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Questions asked</p>
                <p className="text-white text-sm font-semibold">{data.totalPrompts}</p>
                <p className="text-[11px] text-slate-500">
                  {data.lastSeen ? `last ${new Date(data.lastSeen).toLocaleString()}` : "never"}
                </p>
              </div>
            </div>

            <p className="text-slate-300 text-sm font-medium mt-5 mb-2">Latest 5 questions</p>
            {data.recent?.length ? (
              <div className="space-y-2">
                {data.recent.map((r) => (
                  <div key={r.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
                    <p className="text-slate-100 text-sm break-words">{r.prompt || "—"}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {LABELS[r.bucket] || "AI"} · {new Date(r.at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No questions recorded yet.</p>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}