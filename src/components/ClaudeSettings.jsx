import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Palette, Plug, BarChart3, CreditCard, Shield, Github, Globe, Check, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppShell } from "@/components/AppShellContext";
import { readAboutMe, saveAboutMe, ABOUT_MAX } from "@/lib/aboutMe";
import { savedToken, forgetToken, connect } from "@/lib/githubClient";
import { showNotice } from "@/lib/dialogs";

// The Claude-style Settings window: a list of sections on the left (General, Appearance,
// Connectors, Usage, Billing, Account) and the section on the right. The bigger account jobs
// (password, two-step, deleting the account, published sites and games, referrals) still open
// the older account window, which has them all.
const SECTIONS = [
  ["general", "General", User],
  ["appearance", "Appearance", Palette],
  ["connectors", "Connectors", Plug],
  ["usage", "Usage", BarChart3],
  ["billing", "Billing", CreditCard],
  ["account", "Account", Shield],
];
const PLAN_NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise", max: "Max", secret: "Secret" };
const FONT_KEY = "nx-chat-font";

const Row = ({ title, sub, children }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--cl-border)]/70 last:border-0">
    <div className="min-w-0">
      <p className="text-[14px] text-[var(--cl-text)]">{title}</p>
      {sub && <p className="text-[12.5px] text-[var(--cl-muted)] mt-0.5">{sub}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);
const Btn = ({ children, onClick, danger }) => (
  <button onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-[13px] ${danger ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-[var(--cl-border)] text-[var(--cl-text)] hover:bg-[var(--cl-hover)]"}`}>
    {children}
  </button>
);
const H = ({ children }) => <h2 className="text-[19px] font-semibold text-[var(--cl-text)] mb-2">{children}</h2>;

function Bar({ label, used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="py-3">
      <div className="flex justify-between text-[13.5px] mb-1.5">
        <span className="text-[var(--cl-text)]">{label}</span>
        <span className="text-[var(--cl-muted)]">{total > 0 ? `${pct}% used` : "Not in your plan"}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--cl-hover)] overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : "bg-[var(--cl-accent,#a78bfa)]"}`} style={{ width: `${pct}%` }} />
      </div>
      {total > 0 && <p className="text-[12px] text-[var(--cl-faint)] mt-1">{Math.max(0, total - used)} of {total} credits left</p>}
    </div>
  );
}

export default function ClaudeSettings({ open, onClose }) {
  const shell = useAppShell();
  const { currentUser, credits = {}, effPlan, lightMode, toggleLight, openProfile, goPlans } = shell;
  const [tab, setTab] = useState("general");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [font, setFont] = useState(() => { try { return localStorage.getItem(FONT_KEY) || "default"; } catch { return "default"; } });
  const [gh, setGh] = useState(savedToken);
  const [ghUser, setGhUser] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(currentUser?.full_name || "");
    setAbout(readAboutMe(currentUser?.id));
    setGh(savedToken());
  }, [open, currentUser]);
  useEffect(() => {
    if (gh) connect(gh).then(setGhUser).catch(() => setGhUser(""));
  }, [gh]);
  useEffect(() => {
    document.documentElement.dataset.chatFont = font;
    try { localStorage.setItem(FONT_KEY, font); } catch { /* fine */ }
  }, [font]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const saveGeneral = async () => {
    saveAboutMe(currentUser?.id, about);
    if (name.trim() && name.trim() !== currentUser?.full_name) {
      try {
        await base44.auth.updateMe({ full_name: name.trim() });
      } catch {
        return showNotice("Couldn't save your name. Please try again.");
      }
    }
    showNotice("Saved.");
  };
  const ghSignIn = () => {
    const w = window.open("/github/login", "nx-github", "width=620,height=760");
    if (!w) window.location.href = "/github/login";
    const onStore = (e) => e.key === "bh-github-token" && e.newValue && (setGh(e.newValue), window.removeEventListener("storage", onStore));
    window.addEventListener("storage", onStore);
  };
  const plan = PLAN_NAMES[effPlan] || "Free";

  const body = {
    general: (
      <>
        <H>Profile</H>
        <label className="block text-[13px] text-[var(--cl-muted)] mt-3 mb-1">Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] px-3 py-2 outline-none text-[var(--cl-text)] text-[14px]" />
        <label className="block text-[13px] text-[var(--cl-muted)] mt-4 mb-1">What should Nebulux AI know about you?</label>
        <textarea value={about} onChange={(e) => setAbout(e.target.value.slice(0, ABOUT_MAX))} rows={4} placeholder="e.g. I'm in 8th grade, I like games, keep answers short." className="w-full rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] px-3 py-2 outline-none text-[var(--cl-text)] text-[14px] resize-none" />
        <p className="text-[12px] text-[var(--cl-faint)] mt-1">Kept in this browser and sent with your messages so answers fit you.</p>
        <div className="mt-4 flex justify-end">
          <button onClick={saveGeneral} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[13.5px] font-medium">Save changes</button>
        </div>
      </>
    ),
    appearance: (
      <>
        <H>Appearance</H>
        <p className="text-[13.5px] text-[var(--cl-muted)] mt-3 mb-2">Color mode</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {[["light", "Light", true], ["dark", "Dark", false]].map(([k, l, isLight]) => (
            <button key={k} onClick={() => lightMode !== isLight && toggleLight()} className={`rounded-xl border-2 p-2 text-left ${lightMode === isLight ? "border-[var(--cl-focus,#a78bfa)]" : "border-[var(--cl-border)]"}`}>
              <div className={`h-16 rounded-lg mb-2 ${isLight ? "bg-[#f5f3ff]" : "bg-[#0d0b1a]"} border border-[var(--cl-border)] p-2 space-y-1.5`}>
                <div className={`h-1.5 w-10 rounded ${isLight ? "bg-[#c4b5fd]" : "bg-[#4c3d8f]"}`} />
                <div className={`h-1.5 w-16 rounded ${isLight ? "bg-[#ddd6fe]" : "bg-[#2d2654]"}`} />
                <div className={`h-1.5 w-12 rounded ${isLight ? "bg-[#ddd6fe]" : "bg-[#2d2654]"}`} />
              </div>
              <span className="text-[13px] text-[var(--cl-text)]">{l}</span>
            </button>
          ))}
        </div>
        <p className="text-[13.5px] text-[var(--cl-muted)] mt-6 mb-2">Chat font</p>
        <div className="grid grid-cols-3 gap-3 max-w-sm">
          {[["default", "Default", "font-serif"], ["sans", "Sans", "font-sans"], ["mono", "Mono", "font-mono"]].map(([k, l, cls]) => (
            <button key={k} onClick={() => setFont(k)} className={`rounded-xl border-2 py-3 ${font === k ? "border-[var(--cl-focus,#a78bfa)]" : "border-[var(--cl-border)]"}`}>
              <span className={`block text-[22px] text-[var(--cl-text)] ${cls}`}>Aa</span>
              <span className="text-[12.5px] text-[var(--cl-muted)]">{l}</span>
            </button>
          ))}
        </div>
      </>
    ),
    connectors: (
      <>
        <H>Connectors</H>
        <p className="text-[13px] text-[var(--cl-muted)]">Let Nebulux work with other apps you use.</p>
        <div className="mt-4 rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)]">
          <div className="flex items-center gap-3 p-4">
            <Github className="w-6 h-6 text-[var(--cl-text)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[var(--cl-text)]">GitHub</p>
              <p className="text-[12.5px] text-[var(--cl-muted)]">{gh ? `Connected${ghUser ? ` as ${ghUser}` : ""}` : "Open and save code in your repositories from Nebulux Code."}</p>
            </div>
            {gh ? <Btn onClick={() => { forgetToken(); setGh(""); setGhUser(""); }}>Disconnect</Btn> : <Btn onClick={ghSignIn}>Connect</Btn>}
          </div>
          <div className="flex items-center gap-3 p-4">
            <Globe className="w-6 h-6 text-[var(--cl-text)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[var(--cl-text)]">Nebulux Browser</p>
              <p className="text-[12.5px] text-[var(--cl-muted)]">Web search and pages in Nebulux Code. Always on, nothing to set up.</p>
            </div>
            <span className="flex items-center gap-1 text-[12.5px] text-emerald-400"><Check className="w-4 h-4" /> On</span>
          </div>
        </div>
      </>
    ),
    usage: (
      <>
        <H>Usage</H>
        <p className="text-[13px] text-[var(--cl-muted)]">{plan} plan · credits refill every month.</p>
        <div className="mt-3">
          <Bar label="Nebulux AI" used={credits.aiUsed || 0} total={credits.aiTotal || 0} />
          <Bar label="Ultra / Nebulux Code" used={credits.aiCodeUsed || 0} total={credits.aiCodeTotal || 0} />
          <Bar label="Galaxy" used={credits.galaxy5Used || 0} total={credits.galaxy5Total || 0} />
          <Bar label="Space" used={credits.space5Used || 0} total={credits.space5Total || 0} />
        </div>
      </>
    ),
    billing: (
      <>
        <H>Billing</H>
        <div className="mt-3 rounded-xl border border-[var(--cl-border)] p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[15px] font-medium text-[var(--cl-text)]">{plan} plan</p>
            <p className="text-[12.5px] text-[var(--cl-muted)]">
              {credits.planEndsAt ? `Ends ${new Date(credits.planEndsAt).toLocaleDateString()}` : effPlan && effPlan !== "free" ? "Active" : "Upgrade for Nebulux Code, more credits and more."}
            </p>
          </div>
          <button onClick={() => { onClose(); goPlans(); }} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[13.5px] font-medium">{effPlan && effPlan !== "free" ? "Change plan" : "Upgrade"}</button>
        </div>
        <Row title="Subscription and team" sub="Seats, team members and your plan's details."><Btn onClick={() => openProfile("subscription")}>Manage</Btn></Row>
        <Row title="Invoices and cancelling" sub="Questions about a payment, or cancel."><Btn onClick={() => window.open("/contact?topic=billing", "_blank", "noopener")}>Contact us</Btn></Row>
      </>
    ),
    account: (
      <>
        <H>Account</H>
        <Row title="Email" sub={currentUser?.email} />
        <Row title="Password" sub="Get a link to set a new one."><Btn onClick={() => openProfile("security")}>Change</Btn></Row>
        <Row title="Two-step sign-in" sub="A code by email when you sign in."><Btn onClick={() => openProfile("twostep")}>Manage</Btn></Row>
        <Row title="Published websites"><Btn onClick={() => openProfile("sites")}>View <ChevronRight className="inline w-3.5 h-3.5" /></Btn></Row>
        <Row title="Published games"><Btn onClick={() => openProfile("games")}>View <ChevronRight className="inline w-3.5 h-3.5" /></Btn></Row>
        <Row title="Refer friends" sub="Get credits when friends join."><Btn onClick={() => openProfile("refer")}>Open</Btn></Row>
        <Row title="Delete account" sub="Removes your account and everything you published."><Btn danger onClick={() => openProfile("delete")}>Delete</Btn></Row>
      </>
    ),
  }[tab];

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl h-[min(640px,calc(100dvh-1.5rem))] rounded-2xl bg-[var(--cl-card)] border border-[var(--cl-border)] shadow-2xl flex flex-col sm:flex-row overflow-hidden">
        <nav className="sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--cl-border)] p-3 flex sm:flex-col gap-1 overflow-x-auto">
          <div className="hidden sm:flex items-center justify-between px-2 pb-3">
            <span className="text-[17px] font-semibold text-[var(--cl-text)]">Settings</span>
          </div>
          {SECTIONS.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`shrink-0 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-left ${tab === k ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]/60 hover:text-[var(--cl-text)]"}`}>
              <Icon className="w-4 h-4" />
              {l}
            </button>
          ))}
        </nav>
        <div className="relative flex-1 min-h-0 overflow-y-auto p-5 sm:p-8">
          <button onClick={onClose} aria-label="Close settings" className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
            <X className="w-5 h-5" />
          </button>
          {body}
        </div>
      </div>
    </div>,
    document.body
  );
}
