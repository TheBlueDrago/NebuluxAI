import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserRoundPen, X } from "lucide-react";
import { ABOUT_MAX, onAboutMe, readAboutMe, saveAboutMe } from "@/lib/aboutMe";

const EXAMPLES = ["I'm in 7th grade and I love soccer.", "Keep answers short, with examples.", "I'm learning Spanish, so explain new words.", "I run a small bakery."];

// Chat toolbar button: tell the AI a little about yourself once (lib/aboutMe.js). A dot shows
// when something is saved, so it's clear answers are being tailored.
export default function AboutMeButton({ userId }) {
  const [saved, setSaved] = useState(() => readAboutMe(userId));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setSaved(readAboutMe(userId));
    return onAboutMe(setSaved);
  }, [userId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = saved ? "About you (saved): the AI tailors answers to you" : "About you: tell the AI about yourself";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(saved);
          setOpen(true);
        }}
        title={label}
        aria-label={label}
        className="relative p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        <UserRoundPen className="w-4 h-4" />
        {saved && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="bh-about-title" className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5">
              <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="w-4 h-4" />
              </button>
              <h2 id="bh-about-title" className="text-lg font-semibold text-white">
                About you
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Tell the AI a little about yourself and how you like answers. It&apos;s used with every message you send, and kept only on this device.
              </p>
              <textarea aria-label="About you"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, ABOUT_MAX))}
                rows={4}
                autoFocus
                placeholder="For example: I'm in 7th grade and I love soccer. Keep answers short, with examples."
                className="mt-3 w-full resize-none rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500"
              />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {EXAMPLES.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setDraft((d) => (d.trim() ? `${d.trim()} ${x}` : x).slice(0, ABOUT_MAX))}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    + {x}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {draft.length}/{ABOUT_MAX}. Don&apos;t include passwords, your address or your phone number.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                {saved && (
                  <button
                    type="button"
                    onClick={() => {
                      saveAboutMe(userId, "");
                      setOpen(false);
                    }}
                    className="px-3 py-2 rounded-xl text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    saveAboutMe(userId, draft);
                    setOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-[#fff] text-sm font-semibold hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
