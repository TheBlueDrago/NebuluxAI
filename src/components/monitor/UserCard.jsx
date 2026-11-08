import React from "react";
import UserActions from "./UserActions";

function PlanBadge({ plan }) {
  const map = {
    free: { label: "Free", cls: "bg-slate-700/60 text-slate-300" },
    pro: { label: "Pro", cls: "bg-amber-500/20 text-amber-200 border border-amber-400/40" },
    team: { label: "Team", cls: "bg-sky-500/20 text-sky-200 border border-sky-400/40" },
    secret: { label: "Secret", cls: "bg-black text-slate-100 border border-slate-600" },
    enterprise: { label: "Enterprise", cls: "bg-violet-500/20 text-violet-200 border border-violet-400/40" },
  };
  const m = map[plan] || map.free;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

// A Stripe purchase doesn't change the plan field on the account, so it comes in as `paid`
// (cloudflare-lib/monitorLive.js). The higher one is what the person really has.
const RANK = { free: 0, pro: 1, team: 2, secret: 3, enterprise: 4 };
const planShown = (u) => (u.paid && (RANK[u.paid.plan] || 0) > (RANK[u.plan] || 0) ? u.paid.plan : u.plan);

function StatusBadge({ user }) {
  if (user.banned)
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500/40">Banned</span>;
  if (user.blockedUntil && new Date(user.blockedUntil) > new Date())
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/25 text-orange-200 border border-orange-400/40">Blocked</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">Active</span>;
}

export default function UserCard({ user, onApply, onOpenDetail }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onOpenDetail?.(user)}
          title="View credits and AI activity"
          className="text-white font-medium truncate max-w-[60%] hover:text-sky-300 hover:underline transition-colors"
        >
          {user.full_name || "Unnamed"}
        </button>
        <PlanBadge plan={planShown(user)} />
        <StatusBadge user={user} />
      </div>
      <p className="text-slate-400 text-sm truncate">{user.email}</p>
      <p className="text-slate-600 text-xs mb-3">
        Joined {user.created_date ? new Date(user.created_date).toLocaleDateString() : "—"}
        {user.planExpiresAt ? ` · plan expires ${new Date(user.planExpiresAt).toLocaleDateString()}` : ""}
        {user.paid ? ` · bought ${user.paid.name}${user.paid.test ? " (test payment)" : ""}` : ""}
      </p>
      <UserActions user={user} onApply={onApply} />
    </div>
  );
}