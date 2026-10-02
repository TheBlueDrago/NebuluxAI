import React, { useState } from "react";
import { askConfirm } from "@/lib/dialogs";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, KeyRound, Loader2, Check, Flag, ExternalLink, Download, LogOut } from "lucide-react";
import { collectMyData, downloadJson } from "@/lib/myData";
import { signOut } from "@/lib/signOut";
import { clearThisBrowser, noteSignedOut } from "@/lib/sessionOnly";

const TIPS = [
  "We'll never ask for your password, by email, phone or chat.",
  "Only sign in on nebuluxai.com. Check the address first.",
  "Use a password you don't use for anything else.",
  "On a shared or school computer, untick \"Remember me\" when you sign in, and sign out when you're done.",
  "Never type a password or card number into a site someone made. Report it instead.",
];

// "Your data": a copy of what we keep about the account (src/lib/myData.js).
function MyData({ user }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const download = async () => {
    setBusy(true);
    setNote("");
    try {
      const data = await collectMyData(user);
      downloadJson(data, `nebulux-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      const missing = ["credits", "purchases", "sites", "games"].filter((k) => data[k] && data[k].error);
      setNote(missing.length ? `Downloaded, but ${missing.join(" and ")} couldn't be loaded. Try again later for those.` : "Downloaded.");
    } catch {
      setNote("Couldn't make the file. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 pt-4 border-t border-slate-700/50">
      <p className="text-slate-300 text-sm font-medium">Your data</p>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
        Download a copy of what we keep about your account: your details, plan and credits, purchases, your published sites and games, your game progress and the website and game you are working on. Your chats have their
        own backup in Settings.
      </p>
      <button
        onClick={download}
        disabled={busy || !user?.id}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download my data
      </button>
      {note && <p className="text-[11px] text-slate-400 mt-1.5 text-center" aria-live="polite">{note}</p>}
    </div>
  );
}

// Settings → Security: change password (by email link), simple ways to stay safe, and a copy
// of your data.
export default function SecurityPanel({ user, email, onBack, onChangePassword, busy }) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-200 transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-300" />
        <h3 className="text-lg font-semibold text-white">Security</h3>
      </div>
      {email && <p className="text-xs text-slate-500 mt-1 break-all">Signed in as {email}</p>}

      <button
        onClick={onChangePassword}
        disabled={busy || !email}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-[#fff] font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Change password
      </button>
      <p className="text-[11px] text-slate-500 mt-1.5 text-center">We'll email you a link to set a new one.</p>

      <p className="mt-5 text-slate-300 text-sm font-medium">Staying safe</p>
      <ul className="mt-2 space-y-2">
        {TIPS.map((t) => (
          <li key={t} className="flex items-start gap-2 text-xs text-slate-300">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/safety" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700">
          <ExternalLink className="w-4 h-4" /> Trust & safety
        </Link>
        <Link to="/report" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700">
          <Flag className="w-4 h-4" /> Report a page
        </Link>
      </div>
      <MyData user={user} />
      <EverywhereSignOut />
      <SharedComputer />
    </div>
  );
}

// Forgot to sign out somewhere (a school or library computer, an old phone)? This ends every
// sign-in on the account, this one included (cloudflare-lib/auth.js "logout-all").
function EverywhereSignOut() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const go = async () => {
    if (!(await askConfirm("Sign out on every device, including this one? You'll need your password (or Google) to sign back in.", { confirmLabel: "Sign out everywhere", danger: true }))) return;
    setBusy(true);
    setNote("");
    try {
      const token = localStorage.getItem("base44_access_token");
      const res = await fetch("/api/apps/6a8b5eb7787b8a4d6a18f662/auth/logout-all", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error();
      noteSignedOut("signed-out");
      signOut("/login");
    } catch {
      setNote("Couldn't sign out everywhere. Please try again.");
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 pt-4 border-t border-slate-700/50">
      <p className="text-slate-300 text-sm font-medium">Signed in somewhere else?</p>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
        If you forgot to sign out on another computer or phone, this signs you out on every device at once.
      </p>
      <button
        onClick={go}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />} Sign out on all devices
      </button>
      {note && <p className="text-[11px] text-red-400 mt-1.5 text-center">{note}</p>}
    </div>
  );
}

// Signing out on a shared computer: a normal sign-out puts chats aside (src/lib/chatStash.js),
// but projects and settings are kept in the browser. This removes them as well.
function SharedComputer() {
  const leave = async () => {
    if (!await askConfirm("Sign out and remove your chats, projects and settings from this browser? Download anything you want to keep first.")) return;
    clearThisBrowser();
    noteSignedOut("cleared");
    signOut();
  };
  return (
    <div className="mt-5 pt-4 border-t border-slate-700/50">
      <p className="text-slate-300 text-sm font-medium">On a shared computer?</p>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
        Signing out puts your chats away until you sign in here again, but your projects stay in this browser. Sign out this way to remove everything, so the next person can't see any of it.
      </p>
      <button onClick={leave} className="w-full px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition-colors">
        Sign out and clear this browser
      </button>
    </div>
  );
}
