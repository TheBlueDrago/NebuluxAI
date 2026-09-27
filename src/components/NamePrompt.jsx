import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BlackholeIcon from "@/components/BlackholeIcon";

// Right after the user agreement, once per account: "What should Nebulux AI call you?" The answer
// becomes their username (the account's name). Marked done on the account (name_set) and on this
// device, so it's asked only once.
const doneKey = (id) => `nx-name-set:${id}`;
const BAD = /\b(fuck|shit|bitch|cunt|nigg|fag|slut|whore|porn|sex|nazi|hitler)/i;

export function cleanDisplayName(raw) {
  const n = String(raw || "").replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 30) return { error: "Use 2 to 30 characters." };
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(n)) return { error: "Use letters, numbers, spaces, or _ . ' -" };
  if (BAD.test(n)) return { error: "Please pick a friendlier name." };
  if (/nebulux|blackhole|admin|moderator|official|support|staff/i.test(n)) return { error: "That name looks official, so pick another one." };
  return { name: n };
}

export default function NamePrompt({ user, ready, onDone }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user?.id) return;
    let done = !!user.name_set;
    try {
      done = done || localStorage.getItem(doneKey(user.id)) === "1";
    } catch {
      // Storage blocked: the account's own flag decides.
    }
    if (done) {
      onDone?.();
      return;
    }
    setName(String(user.full_name || "").split("@")[0].slice(0, 30));
    setOpen(true);
  }, [ready, user?.id, user?.name_set, user?.full_name, onDone]);

  // Like the agreement: the app behind it waits.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || !open) return;
    root.inert = true;
    return () => {
      root.inert = false;
    };
  }, [open]);

  if (!open) return null;

  const save = async (e) => {
    e.preventDefault();
    const c = cleanDisplayName(name);
    if (c.error) return setErr(c.error);
    setBusy(true);
    setErr("");
    try {
      await base44.auth.updateMe({ full_name: c.name, name_set: true });
      try {
        localStorage.setItem(doneKey(user.id), "1");
        localStorage.removeItem("bh-me"); // the saved "who's signed in" has the old name
      } catch {
        // Fine.
      }
      setOpen(false);
      onDone?.(c.name);
    } catch {
      setErr("Couldn't save that. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/80 p-4">
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="name-title" className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center shadow-2xl">
        <span className="mx-auto block w-14 h-14 rounded-2xl overflow-hidden">
          <BlackholeIcon className="w-full h-full" />
        </span>
        <h2 id="name-title" className="mt-3 text-lg font-semibold text-white">
          What should Nebulux AI call you?
        </h2>
        <p className="mt-1 text-sm text-slate-400">This is your username. You can use a nickname. Don't use your full real name if you're a kid.</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Your name"
          aria-label="Your name"
          className="mt-4 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-center text-white outline-none focus:border-indigo-400"
        />
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        <button type="submit" disabled={busy || !name.trim()} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-[#fff] disabled:opacity-40">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Continue
        </button>
      </form>
    </div>,
    document.body
  );
}
