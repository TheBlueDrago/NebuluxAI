import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Settings as Gear, UserCircle, ShieldCheck, CreditCard, Gauge, Briefcase, Brain, Code, Plug, KeyRound, Monitor, Sun, Moon, Github, Globe, Check, ChevronRight, ArrowUpRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppShell } from "@/components/AppShellContext";
import { readAboutMe, saveAboutMe, ABOUT_MAX } from "@/lib/aboutMe";
import { savedToken, forgetToken, connect } from "@/lib/githubClient";
import { showNotice } from "@/lib/dialogs";
import { LANGUAGES, readLanguage, saveLanguage, readMotion, saveMotion, readNotify, saveNotify } from "@/lib/prefs";

// The Settings window, laid out like Claude's: a search box and grouped sections on the left,
// the section on the right. Only things Nebulux really has (and that are free) are listed.
// The bigger account jobs (password, two-step, deleting the account, published sites and
// games, referrals) open the older account window, which has them all.
const GROUPS = [
  ["Settings", [
    ["general", "General", Gear],
    ["account", "Account", UserCircle],
    ["privacy", "Privacy", ShieldCheck],
    ["billing", "Billing", CreditCard],
    ["usage", "Usage", Gauge],
    ["capabilities", "Capabilities", Briefcase],
    ["memory", "Memory", Brain],
    ["code", "Nebulux Code", Code],
  ]],
  ["Customize", [["connectors", "Connectors", Plug]]],
  ["Platform", [["api", "API keys", KeyRound]]],
];
export const SETTINGS_TABS = GROUPS.flatMap(([, items]) => items.map(([k]) => k));
const PLAN_NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise", max: "Max", secret: "Secret" };
const FONTS = [["default", "Nebulux Serif"], ["system", "System"], ["mono", "Mono"]];
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } };

const Row = ({ title, sub, children }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--cl-border)]/70">
    <div className="min-w-0">
      <p className="text-[15px] text-[var(--cl-text)]">{title}</p>
      {sub && <p className="text-[13.5px] text-[var(--cl-muted)] mt-0.5">{sub}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);
const H = ({ children, first }) => <h2 className={`text-[17px] font-semibold text-[var(--cl-text)] ${first ? "" : "mt-10"} mb-1`}>{children}</h2>;
const Btn = ({ children, onClick, danger }) => (
  <button onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-[13.5px] ${danger ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-[var(--cl-border)] text-[var(--cl-text)] hover:bg-[var(--cl-hover)]"}`}>{children}</button>
);
const Toggle = ({ on, onChange, label }) => (
  <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-blue-500" : "bg-[var(--cl-hover)]"}`}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
  </button>
);
const Segmented = ({ value, onChange, options }) => (
  <div className="flex rounded-lg bg-[var(--cl-hover)]/60 p-0.5">
    {options.map(([k, l]) => (
      <button key={k} onClick={() => onChange(k)} aria-label={typeof l === "string" ? l : k} className={`px-3 py-1 rounded-md text-[14px] ${value === k ? "bg-[var(--cl-card)] text-[var(--cl-text)] shadow" : "text-[var(--cl-muted)]"}`}>{l}</button>
    ))}
  </div>
);
const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-[14.5px] text-[var(--cl-text)] outline-none cursor-pointer text-right">
    {options.map(([k, l]) => <option key={k} value={k} className="bg-[var(--cl-card)]">{l}</option>)}
  </select>
);

function Bar({ label, used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="py-3">
      <div className="flex justify-between text-[14px] mb-1.5">
        <span className="text-[var(--cl-text)]">{label}</span>
        <span className="text-[var(--cl-muted)]">{total > 1e12 ? "Unlimited" : total > 0 ? `${pct}% used` : "Not in your plan"}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--cl-hover)] overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : "bg-blue-500"}`} style={{ width: `${total > 1e12 ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

export default function ClaudeSettings({ open, initialTab = "general", onClose }) {
  const shell = useAppShell();
  const { currentUser, credits = {}, effPlan, lightMode, toggleLight, openProfile, goPlans } = shell;
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [theme, setTheme] = useState(() => lsGet("nx-theme-mode", lightMode ? "light" : "dark"));
  const [font, setFont] = useState(() => lsGet("nx-chat-font", "default"));
  const [motion, setMotion] = useState(readMotion);
  const [lang, setLang] = useState(readLanguage);
  const [notify, setNotify] = useState(readNotify);
  const [web, setWeb] = useState(() => lsGet("nx-web", "on") === "on");
  const [followUps, setFollowUps] = useState(() => lsGet("nx-followups", "on") === "on");
  const [codeSession, setCodeSession] = useState(() => lsGet("nx-code-session", "cloud"));
  const [gh, setGh] = useState(savedToken);
  // Usage: plan credits (chatting) vs. API key credits (the prepaid balance API keys and website AI use)
  const [usageView, setUsageView] = useState("plan");
  const [api, setApi] = useState(null);
  const [apiErr, setApiErr] = useState("");
  const loadApi = () => base44.functions.invoke("api-billing", { action: "status" }).then((r) => setApi(r.data)).catch(() => setApi({ error: true }));
  const setUseApi = async (on) => {
    setApiErr("");
    try { setApi((await base44.functions.invoke("api-billing", { action: "set-mode", useApi: on })).data); }
    catch (e) { setApiErr(e?.response?.data?.error || "Couldn't change that. Please try again."); }
  };
  const [ghUser, setGhUser] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(SETTINGS_TABS.includes(initialTab) ? initialTab : "general");
    setName(currentUser?.full_name || "");
    setAbout(readAboutMe(currentUser?.id));
    setGh(savedToken());
  }, [open, initialTab, currentUser]);
  useEffect(() => {
    if (open && tab === "usage" && !api) loadApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);
  useEffect(() => {
    if (gh) connect(gh).then(setGhUser).catch(() => setGhUser(""));
  }, [gh]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const pickTheme = (t) => {
    setTheme(t);
    lsSet("nx-theme-mode", t);
    const wantLight = t === "system" ? window.matchMedia?.("(prefers-color-scheme: light)").matches : t === "light";
    if (!!wantLight !== !!lightMode) toggleLight();
  };
  const pickFont = (f) => {
    setFont(f);
    lsSet("nx-chat-font", f);
    document.documentElement.dataset.chatFont = f;
  };
  const pickNotify = async (on) => {
    if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const p = await Notification.requestPermission().catch(() => "denied");
      if (p !== "granted") return showNotice("Your browser blocked notifications. Allow them for this site in the browser's settings, then try again.");
    }
    setNotify(on);
    saveNotify(on);
  };
  const saveProfile = async () => {
    if (name.trim() && name.trim() !== currentUser?.full_name) {
      try {
        await base44.auth.updateMe({ full_name: name.trim() });
      } catch {
        return showNotice("Couldn't save your name. Please try again.");
      }
    }
    showNotice("Saved.");
  };
  const plan = PLAN_NAMES[effPlan] || "Free";
  const go = (fn) => () => { onClose(); fn(); };

  const body = {
    general: (
      <>
        <H first>Appearance</H>
        <Row title="Theme">
          <Segmented value={theme} onChange={pickTheme} options={[["system", <Monitor key="s" className="w-4 h-4" />], ["light", <Sun key="l" className="w-4 h-4" />], ["dark", <Moon key="d" className="w-4 h-4" />]]} />
        </Row>
        <Row title="Chat font"><Select value={font} onChange={pickFont} options={FONTS} /></Row>
        <Row title="Motion" sub="Reduce animation in streaming responses and other interface elements.">
          <Segmented value={motion} onChange={(v) => (setMotion(v), saveMotion(v))} options={[["system", "System"], ["reduced", "Reduced"]]} />
        </Row>
        <H>Language</H>
        <Row title="Reply language" sub="The language Nebulux AI answers in."><Select value={lang} onChange={(v) => (setLang(v), saveLanguage(v))} options={LANGUAGES.map((l) => [l, l])} /></Row>
        <H>Notifications</H>
        <Row title="Response completions" sub="Get notified when Nebulux AI has finished a response. Useful for long-running tasks.">
          <Toggle on={notify} onChange={pickNotify} label="Response completions" />
        </Row>
      </>
    ),
    account: (
      <>
        <H first>Account</H>
        <label className="block text-[13.5px] text-[var(--cl-muted)] mt-4 mb-1">Full name</label>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] px-3 py-2 outline-none text-[var(--cl-text)] text-[14.5px]" />
          <button onClick={saveProfile} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 text-[13.5px] font-medium">Save</button>
        </div>
        <Row title="Email" sub={currentUser?.email} />
        <Row title="Password" sub="Get a link to set a new one."><Btn onClick={() => openProfile("security", tab)}>Change</Btn></Row>
        <Row title="Two-step sign-in" sub="A code by email when you sign in."><Btn onClick={() => openProfile("twostep", tab)}>Manage</Btn></Row>
        <Row title="Refer friends" sub="Get credits when friends join."><Btn onClick={() => openProfile("refer", tab)}>Open</Btn></Row>
        <Row title="Delete account" sub="Removes your account and everything you published."><Btn danger onClick={() => openProfile("delete", tab)}>Delete account</Btn></Row>
      </>
    ),
    privacy: (
      <>
        <H first>Privacy</H>
        <p className="text-[14px] text-[var(--cl-muted)]">Nebulux never sells your data. Your chats are used to answer you, not to train models.</p>
        <Row title="Published websites" sub="Take sites down or delete them."><Btn onClick={() => openProfile("sites", tab)}>Manage <ChevronRight className="inline w-3.5 h-3.5" /></Btn></Row>
        <Row title="Published games"><Btn onClick={() => openProfile("games", tab)}>Manage <ChevronRight className="inline w-3.5 h-3.5" /></Btn></Row>
        <Row title="Privacy Policy"><Btn onClick={() => window.open("/privacy", "_blank", "noopener")}>Read <ArrowUpRight className="inline w-3.5 h-3.5" /></Btn></Row>
        <Row title="Terms of Service"><Btn onClick={() => window.open("/terms", "_blank", "noopener")}>Read <ArrowUpRight className="inline w-3.5 h-3.5" /></Btn></Row>
      </>
    ),
    billing: (
      <>
        <H first>Billing</H>
        <div className="mt-3 rounded-xl border border-[var(--cl-border)] p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[16px] font-medium text-[var(--cl-text)]">{plan} plan</p>
            <p className="text-[13px] text-[var(--cl-muted)]">{credits.planEndsAt ? `Ends ${new Date(credits.planEndsAt).toLocaleDateString()}` : effPlan && effPlan !== "free" ? "Active" : "Upgrade for Nebulux Code and more credits."}</p>
          </div>
          <button onClick={go(goPlans)} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[13.5px] font-medium">{effPlan && effPlan !== "free" ? "Change plan" : "Upgrade"}</button>
        </div>
        <Row title="Subscription and team" sub="Seats, team members and your plan's details."><Btn onClick={() => openProfile("subscription", tab)}>Manage</Btn></Row>
        <Row title="Invoices and cancelling" sub="Questions about a payment, or cancel."><Btn onClick={() => window.open("/contact?topic=billing", "_blank", "noopener")}>Contact us</Btn></Row>
      </>
    ),
    usage: (
      <>
        <H first>Usage</H>
        <div className="mt-2 mb-4"><Segmented value={usageView} onChange={setUsageView} options={[["plan", "Plan credits"], ["api", "API key credits"]]} /></div>
        {usageView === "plan" ? (
          <>
            <p className="text-[14px] text-[var(--cl-muted)]">{plan} plan · credits for chatting, refilled every month.</p>
            <Bar label="Nebulux AI" used={credits.aiUsed || 0} total={credits.aiTotal || 0} />
            <Bar label="Ultra / Nebulux Code" used={credits.aiCodeUsed || 0} total={credits.aiCodeTotal || 0} />
            <Bar label="Galaxy" used={credits.galaxy5Used || 0} total={credits.galaxy5Total || 0} />
            <Bar label="Space" used={credits.space5Used || 0} total={credits.space5Total || 0} />
          </>
        ) : !api ? (
          <p className="text-[14px] text-[var(--cl-muted)]">Loading…</p>
        ) : (
          <>
            <p className="text-[14px] text-[var(--cl-muted)]">Your prepaid API balance pays for API keys, the Playground and AI on your websites. Plan credits are never used for those.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[["nebulux-ai", "Nebulux AI"], ["galaxy", "Galaxy"], ["space", "Space"], ["nebula", "Nebula"]].map(([id, n]) => (
                <div key={id} className="rounded-xl border border-[var(--cl-border)] p-3">
                  <p className="text-[12.5px] text-[var(--cl-muted)]">{n}</p>
                  <p className="text-[20px] font-semibold text-[var(--cl-text)]">{(api.balanceTexts || {})[id] || "$0.00"}</p>
                </div>
              ))}
            </div>
            <button onClick={() => window.open("/api", "_blank", "noopener")} className="mt-3 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[13.5px] font-medium">Add funds <ArrowUpRight className="inline w-4 h-4" /></button>
            <Row title="Use API key credits" sub={api.useApi ? "On: your API keys and website AI work, and every request is charged to your API balance." : "Off: your API keys and website AI don't work until you turn this on."}>
              <Toggle on={!!api.useApi} onChange={setUseApi} label="Use API key credits" />
            </Row>
            {!api.agreed && <p className="mt-2 text-[13px] text-amber-400">Agree to API billing on the Nebulux Platform first, then turn this on.</p>}
            {apiErr && <p className="mt-2 text-[13px] text-amber-400">{apiErr}</p>}
          </>
        )}
      </>
    ),
    capabilities: (
      <>
        <H first>Capabilities</H>
        <Row title="Web search" sub="Let Nebulux AI look things up on the web when a question needs fresh facts.">
          <Toggle on={web} onChange={(v) => (setWeb(v), lsSet("nx-web", v ? "on" : "off"))} label="Web search" />
        </Row>
        <Row title="Suggested follow-ups" sub="Show quick follow-up questions under replies.">
          <Toggle on={followUps} onChange={(v) => (setFollowUps(v), lsSet("nx-followups", v ? "on" : "off"))} label="Suggested follow-ups" />
        </Row>
      </>
    ),
    memory: (
      <>
        <H first>Memory</H>
        <p className="text-[14px] text-[var(--cl-muted)] mb-3">What Nebulux AI should know about you. It's sent with your messages so answers fit you, and kept only in this browser.</p>
        <textarea value={about} onChange={(e) => setAbout(e.target.value.slice(0, ABOUT_MAX))} rows={6} placeholder="e.g. I'm in 8th grade, I like games, keep answers short." className="w-full rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] focus:border-[var(--cl-focus)] px-3 py-2 outline-none text-[var(--cl-text)] text-[14.5px] resize-none" />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[12.5px] text-[var(--cl-faint)]">{about.length}/{ABOUT_MAX}</span>
          <div className="flex gap-2">
            <Btn onClick={() => { setAbout(""); saveAboutMe(currentUser?.id, ""); }}>Clear</Btn>
            <button onClick={() => { saveAboutMe(currentUser?.id, about); showNotice("Saved."); }} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-1.5 text-[13.5px] font-medium">Save</button>
          </div>
        </div>
      </>
    ),
    code: (
      <>
        <H first>Nebulux Code</H>
        <Row title="Default session" sub="Cloud keeps working if you close the tab or go offline.">
          <Segmented value={codeSession} onChange={(v) => (setCodeSession(v), lsSet("nx-code-session", v))} options={[["local", "Local"], ["cloud", "Cloud"]]} />
        </Row>
        <Row title="Open Nebulux Code" sub="Needs Pro or higher."><Btn onClick={go(shell.goCode)}>Open</Btn></Row>
      </>
    ),
    connectors: (
      <>
        <H first>Connectors</H>
        <p className="text-[14px] text-[var(--cl-muted)]">Let Nebulux work with other apps you use.</p>
        <div className="mt-4 rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)]">
          <div className="flex items-center gap-3 p-4">
            <Github className="w-6 h-6 text-[var(--cl-text)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[var(--cl-text)]">GitHub</p>
              <p className="text-[13px] text-[var(--cl-muted)]">{gh ? `Connected${ghUser ? ` as ${ghUser}` : ""}` : "Only in Nebulux Code (Pro and up): open and save code in your repositories."}</p>
            </div>
            {gh ? <Btn onClick={() => { forgetToken(); setGh(""); setGhUser(""); }}>Disconnect</Btn> : <Btn onClick={go(shell.goCode)}>Connect in Nebulux Code</Btn>}
          </div>
          <div className="flex items-center gap-3 p-4">
            <Globe className="w-6 h-6 text-[var(--cl-text)]" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[var(--cl-text)]">Nebulux Browser</p>
              <p className="text-[13px] text-[var(--cl-muted)]">Web search and pages in Nebulux Code.</p>
            </div>
            <span className="flex items-center gap-1 text-[13px] text-emerald-400"><Check className="w-4 h-4" /> On</span>
          </div>
        </div>
      </>
    ),
    api: (
      <>
        <H first>API keys</H>
        <p className="text-[14px] text-[var(--cl-muted)]">Use Nebulux AI from your own apps and code. Make and manage keys, try the API and read the docs on the Nebulux Platform.</p>
        <div className="mt-4"><button onClick={() => window.open("/api", "_blank", "noopener")} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[13.5px] font-medium">Open Nebulux Platform <ArrowUpRight className="inline w-4 h-4" /></button></div>
      </>
    ),
  }[tab];

  const ql = q.trim().toLowerCase();
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()} className="w-full max-w-6xl h-full sm:h-[min(860px,calc(100dvh-3rem))] sm:rounded-2xl bg-[var(--cl-bg)] border border-[var(--cl-border)] shadow-2xl flex flex-col sm:flex-row overflow-hidden">
        <nav className="sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--cl-border)] p-2 pr-12 sm:p-3 flex flex-row sm:flex-col overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] px-3 py-2 mb-3">
            <Search className="w-4 h-4 text-[var(--cl-muted)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="flex-1 bg-transparent outline-none text-[14.5px] text-[var(--cl-text)] placeholder:text-[var(--cl-faint)]" />
          </div>
          {GROUPS.map(([group, items]) => {
            const shown = items.filter(([, l]) => !ql || l.toLowerCase().includes(ql));
            if (!shown.length) return null;
            return (
              <div key={group} className="flex sm:block shrink-0 sm:mb-3">
                <p className="hidden sm:block px-2.5 py-1.5 text-[13px] text-[var(--cl-faint)]">{group}</p>
                {shown.map(([k, l, Icon]) => (
                  <button key={k} onClick={() => setTab(k)} className={`shrink-0 sm:w-full flex items-center gap-2 sm:gap-3 rounded-lg px-3 sm:px-2.5 py-2 text-[14px] sm:text-[15px] text-left whitespace-nowrap ${tab === k ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]/60 hover:text-[var(--cl-text)]"}`}>
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="flex-1">{l}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="relative flex-1 min-h-0 overflow-y-auto px-5 py-6 sm:px-10 sm:py-12">
          <button onClick={onClose} aria-label="Close settings" className="absolute top-3 right-3 p-1.5 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-hover)] hover:text-[var(--cl-text)]">
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-3xl">{body}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
