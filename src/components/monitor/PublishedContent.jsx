import React, { useEffect, useState } from "react";
import { askConfirm } from "@/lib/dialogs";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, Globe, Gamepad2, Sparkles, EyeOff, Eye, ExternalLink, ArrowLeft, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { siteUrl } from "@/lib/blackholeDomain";

const FLAGS = {
  red: { dot: "bg-red-500", chip: "bg-red-600/25 text-red-200 border-red-500/50", label: "Red flag" },
  yellow: { dot: "bg-amber-400", chip: "bg-amber-500/20 text-amber-200 border-amber-400/50", label: "Yellow flag" },
  green: { dot: "bg-emerald-500", chip: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40", label: "Green flag" },
};
const KINDS = {
  site: { label: "Websites", icon: Globe, color: "text-sky-300" },
  game: { label: "Games", icon: Gamepad2, color: "text-fuchsia-300" },
};

const urlOf = (it) => (it.kind === "site" ? siteUrl(it.name) || "#" : `/chat/game/${encodeURIComponent(it.name)}`);
const countFlags = (list) => {
  const c = { red: 0, yellow: 0, green: 0 };
  for (const it of list) c[it.flag] += 1;
  return c;
};

function FlagCounts({ counts }) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-red-300">🔴 {counts.red}</span>
      <span className="text-amber-200">🟡 {counts.yellow}</span>
      <span className="text-emerald-300">🟢 {counts.green}</span>
    </span>
  );
}

// Monitor → every published site and game with who made it and a safety flag:
// red (inappropriate, copyright clone, phishing, 50%+ malware) first, then yellow
// (might be harmful), then green (looks safe). Flags come from functions/admin-content.js.
// Monitor shows two buttons, Websites and Games; each opens its list full screen, as its own
// history entry so Back (or the phone's back button) returns to Monitor.
export default function PublishedContent() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showGreen, setShowGreen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const openKind = KINDS[location.state?.publishedList] ? location.state.publishedList : null;

  const openList = (kind) => {
    setShowGreen(false);
    navigate(location.pathname, { state: { ...(location.state || {}), publishedList: kind } });
  };
  const closeList = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(location.pathname, { replace: true, state: {} });
  };

  const load = async () => {
    setError("");
    try {
      const r = await base44.functions.invoke("admin-content", { action: "list" });
      setItems(r.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not load published sites and games.");
      setItems([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const replaceItem = (it, next) => setItems((list) => list.map((x) => (x.kind === it.kind && x.name === it.name ? next : x)));

  const aiCheck = async (it) => {
    setBusy(`ai:${it.kind}:${it.name}`);
    setError("");
    try {
      const r = await base44.functions.invoke("admin-content", { action: "ai-check", kind: it.kind, name: it.name });
      if (r.data?.item) replaceItem(it, r.data.item);
    } catch (e) {
      setError(e?.response?.data?.error || "The AI check failed.");
    } finally {
      setBusy("");
    }
  };

  // Your own verdict on a page (e.g. one you made and know is safe); null = back to automatic.
  const setFlag = async (it, flag) => {
    setBusy(`flag:${it.kind}:${it.name}`);
    setError("");
    try {
      const r = await base44.functions.invoke("admin-content", { action: "set-flag", kind: it.kind, name: it.name, flag });
      if (r.data?.item) replaceItem(it, r.data.item);
    } catch (e) {
      setError(e?.response?.data?.error || "Could not change the flag.");
    } finally {
      setBusy("");
    }
  };

  const takeDown = async (it, hide) => {
    if (hide && !await askConfirm(`Take down "${it.title}"? Visitors will see that it was removed.`)) return;
    setBusy(`td:${it.kind}:${it.name}`);
    try {
      await base44.functions.invoke("admin-reports", { action: hide ? "hide" : "unhide", kind: it.kind, name: it.name.toLowerCase() });
      replaceItem(it, { ...it, takenDown: hide });
    } catch (e) {
      setError(e?.response?.data?.error || "Could not change that page.");
    } finally {
      setBusy("");
    }
  };

  // Pages published before names were limited to first names show the maker's email to anyone.
  const emailsShown = (items || []).filter((it) => it.emailShown).length;
  const hideEmails = async () => {
    setBusy("emails");
    setError("");
    try {
      await base44.functions.invoke("admin-content", { action: "hide-emails" });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || "Could not hide the emails.");
    } finally {
      setBusy("");
    }
  };

  const ofKind = (kind) => (items || []).filter((it) => it.kind === kind);

  const renderItem = (it) => {
    const f = FLAGS[it.flag];
    const key = `${it.kind}:${it.name}`;
    return (
      <div
        key={key}
        className={`rounded-2xl border p-4 ${
          it.flag === "red" ? "border-red-500/40 bg-red-950/20" : it.flag === "yellow" ? "border-amber-400/30 bg-amber-950/10" : "border-slate-700/50 bg-slate-800/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base text-white font-medium flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${f.dot}`} />
              <span className="truncate">{it.title}</span>
              {it.takenDown && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/40 text-red-100 shrink-0">taken down</span>}
              {it.hidden && !it.takenDown && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 shrink-0">hidden</span>}
            </p>
            <p className="text-xs text-slate-400 break-all">
              {it.kind === "site" ? `${it.name}.nebuluxai.com` : `game: ${it.name}`} · by {it.ownerName || "(no name)"} · {it.ownerEmail || "unknown email"}
            </p>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${f.chip}`}>
            {f.label}
            {it.setByAdmin ? " · set by you" : ""}
          </span>
        </div>
        {(it.reasons.length > 0 || it.ai) && (
          <ul className={`mt-2 text-xs space-y-0.5 ${it.setByAdmin ? "text-slate-500" : "text-slate-300"}`}>
            {it.setByAdmin && <li>The automatic check said ({FLAGS[it.autoFlag]?.label.toLowerCase()}):</li>}
            {it.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
            {it.ai && (
              <li className={it.setByAdmin ? "" : "text-indigo-200"}>
                ✦ AI check: {it.ai.flag}
                {it.ai.reasons.length ? ` — ${it.ai.reasons.join("; ")}` : " — looks fine"}
              </li>
            )}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-xs text-slate-400">Set flag:</span>
          {[
            ["green", "🟢 Safe"],
            ["yellow", "🟡 Unsure"],
            ["red", "🔴 Bad"],
          ].map(([flag, label]) => (
            <button
              key={flag}
              onClick={() => setFlag(it, flag)}
              disabled={!!busy || (it.setByAdmin && it.flag === flag)}
              className={`px-2.5 py-1 rounded-lg text-xs border disabled:opacity-60 ${
                it.setByAdmin && it.flag === flag ? FLAGS[flag].chip : "border-slate-600 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
          {it.setByAdmin && (
            <button onClick={() => setFlag(it, null)} disabled={!!busy} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 underline disabled:opacity-50">
              Use automatic
            </button>
          )}
          {busy === `flag:${key}` && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <button
            onClick={() => aiCheck(it)}
            disabled={!!busy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-[#fff] text-xs hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === `ai:${key}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI check
          </button>
          <a
            href={urlOf(it)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 text-slate-100 text-xs hover:bg-slate-600"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </a>
          <button
            onClick={() => takeDown(it, !it.takenDown)}
            disabled={!!busy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs disabled:opacity-50 ${
              it.takenDown ? "bg-emerald-600/80 text-white hover:bg-emerald-500" : "bg-red-600/80 text-white hover:bg-red-500"
            }`}
          >
            {busy === `td:${key}` ? <Loader2 className="w-3 h-3 animate-spin" /> : it.takenDown ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {it.takenDown ? "Put back" : "Take down"}
          </button>
        </div>
      </div>
    );
  };

  // Full-screen list of one kind.
  if (openKind) {
    const K = KINDS[openKind];
    const list = ofKind(openKind);
    const counts = countFlags(list);
    // Green pages are tucked away unless asked for, but ones you set yourself stay in view.
    const shown = list.filter((it) => showGreen || it.flag !== "green" || it.setByAdmin);
    return (
      <div className="fixed inset-0 z-40 bg-slate-950 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={closeList} className="inline-flex items-center gap-1.5 -ml-2 px-2 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="flex-1 text-white font-semibold flex items-center gap-2">
              <K.icon className={`w-5 h-5 ${K.color}`} /> {K.label} <span className="text-slate-500 font-normal">({list.length})</span>
            </h2>
            <FlagCounts counts={counts} />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-3">
          <p className="text-xs text-slate-500">
            🔴 inappropriate for kids, copyright copy, phishing or 50%+ malware · 🟡 might be harmful · 🟢 looks safe. Use "AI check" for a closer look, or "Set flag" when
            you know better (your flag resets if the page changes).
          </p>
          {!items && (
            <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
          )}
          {items && list.length === 0 && <p className="text-slate-500 text-sm py-6">No {K.label.toLowerCase()} published yet.</p>}
          {shown.map(renderItem)}
          {counts.green > 0 && (
            <button onClick={() => setShowGreen((s) => !s)} className="text-sm text-slate-400 hover:text-slate-200 underline">
              {showGreen ? "Hide green (safe) ones" : `Show ${counts.green} green (safe) one${counts.green === 1 ? "" : "s"}`}
            </button>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mt-6 bg-slate-900/70 border border-slate-700/50 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-white font-semibold text-sm">Published sites & games</span>
        {items && <FlagCounts counts={countFlags(items)} />}
      </div>
      {emailsShown > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-950/20 p-3 flex flex-wrap items-center gap-2">
          <p className="flex-1 min-w-[12rem] text-xs text-amber-100">
            {emailsShown} published page{emailsShown === 1 ? " shows its maker's" : "s show their makers'"} email address to anyone who looks.
          </p>
          <button
            onClick={hideEmails}
            disabled={busy === "emails"}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-60"
          >
            {busy === "emails" ? "Hiding…" : "Hide emails"}
          </button>
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(KINDS).map(([kind, K]) => {
          const list = ofKind(kind);
          return (
            <button
              key={kind}
              onClick={() => openList(kind)}
              className="text-left rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-colors"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-white font-semibold">
                  <K.icon className={`w-5 h-5 ${K.color}`} /> {K.label}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{items ? `${list.length} published` : "Loading…"}</span>
                {items && <FlagCounts counts={countFlags(list)} />}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
