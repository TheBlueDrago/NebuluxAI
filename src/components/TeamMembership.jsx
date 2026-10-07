import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, Plus, Check, UserMinus, Users, Crown } from "lucide-react";
import { base44 } from "@/api/base44Client";

function ConfirmDialog({ open, title, confirmLabel, busy, onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6"
          >
            <p className="text-slate-200 text-center text-sm leading-relaxed">{title}</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? "…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MemberCircle({ label, initial, kind, selecting, selected, onClick }) {
  // kind: "owner" | "filled" | "empty"
  const ring =
    selected && selecting
      ? "border-sky-400 bg-sky-500/20"
      : kind === "empty"
      ? "border-dashed border-slate-600 bg-slate-800/50"
      : "border-slate-600 bg-gradient-to-br from-indigo-500 to-fuchsia-500";
  return (
    <div className="flex flex-col items-center gap-2" onClick={onClick}>
      <div className={`relative w-16 h-16 rounded-full flex items-center justify-center border-2 ${ring}`}>
        {kind === "owner" ? (
          <Crown className="w-7 h-7 text-amber-300" />
        ) : kind === "filled" ? (
          <span className="text-xl font-bold text-white">{initial}</span>
        ) : (
          <User className="w-7 h-7 text-slate-500" />
        )}
        {kind === "empty" && (
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sky-500 border-2 border-slate-900 flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 text-white" />
          </span>
        )}
        {selecting && selected && (
          <span className="absolute -right-1 top-0 w-6 h-6 rounded-full bg-sky-500 border-2 border-slate-900 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </span>
        )}
      </div>
      <span className="text-xs text-slate-400 max-w-[84px] truncate text-center">
        {kind === "owner" ? "You" : kind === "empty" ? "Empty" : label}
      </span>
    </div>
  );
}

export default function TeamMembership({ onBack }) {
  const [team, setTeam] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("view");
  const [selected, setSelected] = useState([]);
  const [addEmail, setAddEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    Promise.all([
      base44.functions.invoke("my-team").catch(() => null),
      base44.auth.me().catch(() => null),
    ]).then(([r, u]) => {
      setTeam(r?.data?.team ?? null);
      setMe(u);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
  }, []);

  const addMember = async () => {
    const e = addEmail.trim().toLowerCase();
    if (!e || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await base44.functions.invoke("team-invite", { emails: [e] });
      setTeam((t) => (t ? { ...t, memberEmails: r.data?.memberEmails ?? t.memberEmails } : t));
      setAddEmail("");
      setShowAdd(false);
    } catch (ex) {
      setMsg(ex?.response?.data?.error || ex?.message || "Could not add member.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (email) =>
    setSelected((s) => (s.includes(email) ? s.filter((x) => x !== email) : [...s, email]));

  const doRemove = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await base44.functions.invoke("team-remove", { emails: selected });
      setTeam((t) => (t ? { ...t, memberEmails: r.data?.memberEmails ?? t.memberEmails } : t));
      setSelected([]);
      setMode("view");
      setConfirmRemove(false);
    } catch (ex) {
      setMsg(ex?.response?.data?.error || ex?.message || "Could not remove.");
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await base44.functions.invoke("team-leave");
      setMsg(r.data?.message || "You will be removed at the end of the current period.");
      setConfirmLeave(false);
      load();
    } catch (ex) {
      setMsg(ex?.response?.data?.error || ex?.message || "Could not leave.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;

  const backBtn = (
    <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 mb-4">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  if (!team || !team.active) {
    return (
      <div className="p-6">
        {backBtn}
        <div className="flex flex-col items-center text-center py-10">
          <Users className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-300 font-medium">No Team membership</p>
          <p className="text-slate-500 text-sm mt-1">Get the Team plan to invite up to 2 people and share credits.</p>
        </div>
      </div>
    );
  }

  if (team.isAdmin) {
    return (
      <div className="p-6">
        {backBtn}
        <h3 className="text-center text-lg font-bold text-white">{isEnterprise ? "Your organization" : "Team Membership"}</h3>
        <div className="mt-6 rounded-2xl bg-slate-800/40 border border-slate-700/40 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="text-slate-200">Secret (Admin)</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Nebulux AI credits</span><span className="text-slate-200">50</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Galaxy credits</span><span className="text-slate-200">25</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Space credits</span><span className="text-slate-200">40</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Nebula credits</span><span className="text-slate-200">25</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Expires</span><span className="text-slate-200">Never</span></div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">Admins get the Secret membership for free, forever.</p>
      </div>
    );
  }

  const members = team.memberEmails ?? [];
  const isOwner = team.isOwner;
  const isSecretTeam = team.ownerPlan === "secret";
  const isEnterprise = team.ownerPlan === "enterprise";
  // How many people besides the owner (from the server; Enterprise follows its seats).
  const memberCap = typeof team.cap === "number" ? team.cap : isSecretTeam ? 4 : 2;
  // Enterprise can have many seats, so it shows a list instead of a circle per seat.
  const slots = isEnterprise ? [] : Array.from({ length: memberCap }, (_, i) => i);
  const planName = isEnterprise ? "Enterprise" : isSecretTeam ? "Secret" : "Team";
  const full = members.length >= memberCap;
  const myEmail = (me?.email ?? "").toLowerCase();
  const iAmPending = (team.pendingRemovalEmails ?? []).map((e) => String(e).toLowerCase()).includes(myEmail);

  return (
    <div className="p-6">
      {backBtn}
      <h3 className="text-center text-lg font-bold text-white">Team Membership</h3>

      {isEnterprise && (
        <div className="mt-5">
          <p className="text-center text-sm text-slate-300">
            {members.length + 1} of {memberCap + 1} seats used
          </p>
          <div className="mt-3 max-h-48 overflow-y-auto sidebar-scroll space-y-1.5">
            {members.map((m) => (
              <button
                key={m}
                onClick={() => mode === "remove" && toggleSelect(m)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate border ${
                  mode === "remove" && selected.includes(m) ? "border-red-500/60 bg-red-950/30 text-red-100" : "border-slate-700/50 bg-slate-800/50 text-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
            {members.length === 0 && <p className="text-center text-xs text-slate-500">No one added yet.</p>}
          </div>
        </div>
      )}

      {/* Owner + member slots */}
      <div className={`flex items-center justify-center gap-4 mt-6 ${isEnterprise ? "hidden" : ""}`}>
        <MemberCircle kind="owner" />
        {slots.map((i) => {
          const m = members[i];
          if (m) {
            return (
              <MemberCircle
                key={i}
                label={m}
                initial={(m[0] || "?").toUpperCase()}
                kind="filled"
                selecting={mode === "remove"}
                selected={selected.includes(m)}
                onClick={() => mode === "remove" && toggleSelect(m)}
              />
            );
          }
          return <MemberCircle key={i} kind="empty" />;
        })}
      </div>

      {/* Add / Remove button */}
      <div className="mt-6 flex justify-center">
        {isOwner ? (
          mode === "view" ? (
            full ? (
              <button
                onClick={() => {
                  setMode("remove");
                  setSelected([]);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700"
              >
                Remove
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-sky-700 to-indigo-600 text-[#fff] font-medium hover:opacity-90"
                >
                  {isEnterprise ? "Add people" : members.length === 0 ? `Add ${memberCap} people` : `Add ${memberCap - members.length} more`}
                </button>
                {isEnterprise && members.length > 0 && (
                  <button
                    onClick={() => {
                      setMode("remove");
                      setSelected([]);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMode("view");
                  setSelected([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmRemove(true)}
                disabled={selected.length === 0}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium disabled:opacity-50 hover:bg-red-500"
              >
                Remove selected
              </button>
            </div>
          )
        ) : null}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            <div className="flex gap-2">
              <input
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                placeholder="teammate@email.com"
                className="flex-1 bg-slate-800/70 border border-slate-700/50 focus:border-sky-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
              />
              <button
                onClick={addMember}
                disabled={busy || !addEmail.trim()}
                className="px-4 py-2.5 rounded-xl bg-sky-700 text-[#fff] text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">They create an account with this email to join your team.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details */}
      <div className="mt-6 rounded-2xl bg-slate-800/40 border border-slate-700/40 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Plan</span>
          <span className="text-slate-200">{planName}</span>
        </div>
        {isEnterprise ? (
          <p className="text-xs text-slate-400">Everyone shares one pool of credits: each seat adds 100 Nebulux AI, 75 Galaxy, 50 Space and 25 Nebula a month.</p>
        ) : (
          <div className="flex justify-between">
            <span className="text-slate-400">Shared Galaxy credits</span>
            <span className="text-slate-200">{team.aiCodeUsed ?? 0} / 25</span>
          </div>
        )}
        {team.isPromo && team.ownerPlanExpiresAt && (
          <div className="flex justify-between">
            <span className="text-slate-400">Promo ends</span>
            <span className="text-slate-200">{new Date(team.ownerPlanExpiresAt).toLocaleDateString()}</span>
          </div>
        )}
        {isOwner && team.ownerLeaving && (
          <div className="text-amber-300 text-xs">Your membership will end at the end of the current period.</div>
        )}
        {!isOwner && iAmPending && (
          <div className="text-amber-300 text-xs">You're set to be removed at the end of the current period.</div>
        )}
      </div>

      {/* Leave member */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setConfirmLeave(true)}
          className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-medium"
        >
          <UserMinus className="w-4 h-4" /> Leave member
        </button>
      </div>

      {msg && <p className="mt-3 text-center text-xs text-amber-300">{msg}</p>}

      <ConfirmDialog
        open={confirmRemove}
        title="Are you sure you want to delete these accounts from your membership."
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={doRemove}
      />
      <ConfirmDialog
        open={confirmLeave}
        title="Leave this team? You'll keep access until the end of the current period, then be removed."
        confirmLabel="Yes, leave"
        busy={busy}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={doLeave}
      />
    </div>
  );
}