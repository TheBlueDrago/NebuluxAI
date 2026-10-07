import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Compass, Gamepad2, Globe, MessageCircle, Menu, UserRound, X } from "lucide-react";
import BlackholeIcon from "@/components/BlackholeIcon";
import { shouldOfferTour, markTourSeen } from "@/lib/welcomeTour";

// A new account's first visit: offer a short guided tour, or let them explore on their own
// (who gets it: lib/welcomeTour.js). Each step can jump straight to the page.
// go: which app page "Try it" opens (see AppShellContext).
const STEPS = [
  {
    icon: MessageCircle,
    title: "Ask the AI anything",
    text: "Type or tap the microphone and ask in your own words: homework explained step by step, help writing an essay or email, a quiz before a test, or a photo of a question. Turn on Study mode and it guides you step by step, or ask for flashcards to study with.",
    cta: "Start chatting",
    go: "chat",
  },
  {
    icon: Menu,
    title: "Everything is in the sidebar",
    text: "The sidebar on the left has your chats and every tool: the Website Designer, Nebulux Games, and Nebulux Code for programming (switch between Chat and Code at the top).",
    cta: "Open the menu",
    go: "menu",
  },
  {
    icon: Globe,
    title: "Make a website",
    text: "Describe a website or pick a template, change anything by chatting, and publish it free at yourname.nebuluxai.com. Forms on it send messages straight to you.",
    cta: "Open the Website Designer",
    go: "designer",
  },
  {
    icon: Gamepad2,
    title: "Make a game",
    text: "Describe a game and play it right away, on a phone or a computer. When it's ready, share the link so friends can play too.",
    cta: "Open the Game Designer",
    go: "game",
  },
  {
    icon: UserRound,
    title: "Your credits and account",
    text: "Each AI reply uses credits, and you get a fresh allowance every month. Your name at the bottom of the sidebar opens your plan, usage, settings and help.",
    cta: "Open settings",
    go: "profile",
  },
];

export default function WelcomeTour({ user, shell, blocked }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(-1); // -1: the choice; 0+: a tour step

  useEffect(() => {
    if (!blocked && shouldOfferTour(user)) setOpen(true);
  }, [user, blocked]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function finish() {
    markTourSeen(user.id);
    setOpen(false);
  }

  const tryIt = (go) => {
    finish();
    if (go === "chat") shell.goHome();
    else if (go === "menu") {
      shell.goHome();
      shell.setSidebarOpen(true);
    } else if (go === "designer") shell.goDesigner();
    else if (go === "game") shell.goGameDesigner();
    else if (go === "profile") shell.openProfile("general");
  };

  const s = step >= 0 ? STEPS[step] : null;
  const last = step === STEPS.length - 1;

  // First: a small card in the corner (nothing blocked). The tour itself opens only if they want it.
  if (!s) {
    return createPortal(
      <div role="dialog" aria-labelledby="bh-tour-title" className="fixed z-[80] right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-card)] shadow-2xl p-4 text-[var(--cl-text)]">
        <button onClick={finish} aria-label="Close" className="absolute top-2 right-2 p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 pr-6">
          <BlackholeIcon className="keep-color w-9 h-9 rounded-xl" />
          <div>
            <h2 id="bh-tour-title" className="text-[15px] font-semibold">Welcome to Nebulux AI!</h2>
            <p className="text-[13px] text-[var(--cl-muted)]">New here? A 1-minute tour shows you around.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setStep(0)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-3 py-2 text-[13.5px] font-medium">
            <Compass className="w-4 h-4" /> Show me
          </button>
          <button onClick={finish} className="flex-1 rounded-lg border border-[var(--cl-border)] px-3 py-2 text-[13.5px] text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">No thanks</button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
      <div role="dialog" aria-modal="true" aria-labelledby="bh-tour-title" className="relative w-full max-w-md rounded-3xl bg-[var(--cl-card)] border border-[var(--cl-border)] shadow-2xl p-6 text-[var(--cl-text)]">
        <button onClick={finish} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">
          <X className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cl-muted)]">
            Step {step + 1} of {STEPS.length}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[var(--cl-hover)] border border-[var(--cl-border)] flex items-center justify-center shrink-0">
              <s.icon className="w-6 h-6" />
            </span>
            <h2 id="bh-tour-title" className="text-lg font-bold">{s.title}</h2>
          </div>
          <p className="mt-3 text-sm text-[var(--cl-muted)] leading-relaxed">{s.text}</p>
          <button onClick={() => tryIt(s.go)} className="mt-4 text-sm font-medium underline underline-offset-2">
            {s.cta} now
          </button>
          <div className="mt-6 flex items-center justify-between gap-2">
            <button onClick={() => (step === 0 ? setStep(-1) : setStep(step - 1))} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex gap-1" aria-hidden="true">
              {STEPS.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-[var(--cl-text)]" : "bg-[var(--cl-border)]"}`} />
              ))}
            </div>
            <button onClick={() => (last ? finish() : setStep(step + 1))} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[var(--cl-text)] text-[var(--cl-bg)] text-sm font-semibold">
              {last ? "Finish" : "Next"} {!last && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
