import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus } from "lucide-react";
import { myTeam } from "@/lib/myTeam";
import useEscape from "@/hooks/useEscape";
import useDialogFocus from "@/hooks/useDialogFocus";

// Team and Enterprise owners with empty seats: once each time they sign in (each browser
// session), a reminder to add their people, with "Don't show this again" to stop it for good.
const neverKey = (id) => `infinity-team-welcome-${id}`;
const sessionKey = (id) => `bh-team-reminded-${id}`;
const read = (store, k) => {
  try {
    return store.getItem(k);
  } catch {
    return null;
  }
};
const write = (store, k) => {
  try {
    store.setItem(k, "1");
  } catch {
    // Storage blocked: it may show again, nothing breaks.
  }
};

export default function TeamWelcomePopup({ onAddPeople }) {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    myTeam()
      .then((r) => {
        const t = r.data?.team;
        if (!t || !t.isOwner || !t.active || !t.id) return;
        const used = (t.memberEmails ?? []).length;
        const cap = Number(t.cap) || (t.ownerPlan === "secret" ? 4 : 2);
        if (used >= cap) return;
        if (read(localStorage, neverKey(t.id)) === "1" || read(sessionStorage, sessionKey(t.id)) === "1") return;
        write(sessionStorage, sessionKey(t.id));
        setTeam({ id: t.id, plan: t.ownerPlan ?? "team", used, cap });
      })
      .catch(() => {});
  }, []);

  const close = () => setTeam(null);
  const never = () => {
    if (team) write(localStorage, neverKey(team.id));
    close();
  };
  useEscape(!!team, close);
  const dialogRef = useDialogFocus(!!team);

  const addNow = () => {
    close();
    onAddPeople?.();
  };

  const left = team ? team.cap - team.used : 0;
  const enterprise = team?.plan === "enterprise";
  return (
    <AnimatePresence>
      {team && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add members"
            className="w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain max-w-sm bg-slate-900 border border-sky-500/40 rounded-2xl p-6 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-sky-300" />
            </div>
            <h3 className="text-lg font-semibold text-white">Add members</h3>
            <p className="text-slate-400 text-sm mt-2">
              {enterprise
                ? `Your organization has ${team.cap + 1} seats: you and ${team.cap} more. ${team.used} added, ${left} still free. Add the people in your organization so they can use Nebulux AI.`
                : `Your ${team.plan === "secret" ? "Secret" : "Team"} plan has room for ${team.cap} more ${team.cap === 1 ? "person" : "people"}. ${team.used} added, ${left} still free.`}
            </p>
            <p className="text-slate-500 text-xs mt-2">You can also add them later from your account → Settings → Membership.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700">
                Later
              </button>
              <button
                onClick={addNow}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-sky-700 to-indigo-600 text-[#fff] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add members
              </button>
            </div>
            <button onClick={never} className="mt-3 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200">
              Don't show this again
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
