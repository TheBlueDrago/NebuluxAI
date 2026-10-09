import React, { useState, useEffect, useRef } from "react";
import { askConfirm, askText } from "@/lib/dialogs";
import { formatDistanceToNow } from "date-fns";
import {
  Menu, Globe, Plus, Sparkles, Loader2, Pencil, Trash2, Eye, EyeOff, Crown, ExternalLink, QrCode, Star, Inbox as InboxIcon, X, FileArchive,
} from "lucide-react";
import { useAppShell } from "@/components/AppShellContext";
import SiteMessages from "@/components/designer/SiteMessages";
import QrDialog from "@/components/designer/QrDialog";
import { base44 } from "@/api/base44Client";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import AiChooser from "@/components/AiChooser";
import { siteLimit } from "@/lib/publishLimits";
import { siteUrl } from "@/lib/blackholeDomain";
import { resetDesignerProject, loadDesignerHtmlIntoProject } from "@/lib/designerStore";
import { SITE_TEMPLATES } from "@/lib/siteTemplates";
import { zipToSite } from "@/lib/zipSite";
import { hasProFeatures, hasSpace } from "@/lib/plans";

const SUGGESTIONS = [
  "A portfolio site for a photographer",
  "A landing page for a SaaS product",
  "An online menu for a restaurant",
  "A one-page site for a local gym",
];

function initialOf(s) {
  return (s || "?").trim().charAt(0).toUpperCase();
}

// A thumbnail's HTML is only inline once it's small enough to be worth a live
// render — a legacy entry that still stores a file URL, or is missing, falls
// back to the gradient placeholder instead of trying to render a URL string.
function isInlineHtml(html) {
  return typeof html === "string" && /^\s*<(!doctype|html)/i.test(html);
}

const THUMB_SOURCE_WIDTH = 1280;
const THUMB_SOURCE_HEIGHT = 720;

function SitePreviewThumb({ html }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / THUMB_SOURCE_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none">
      {scale > 0 && (
        <iframe
          srcDoc={html}
          title="Website preview"
          tabIndex={-1}
          scrolling="no"
          sandbox=""
          style={{
            width: THUMB_SOURCE_WIDTH,
            height: THUMB_SOURCE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: 0,
            background: "#fff",
          }}
        />
      )}
    </div>
  );
}

// A dot on the inbox button when form messages arrived since the owner last opened them.
function useNewMessages(site) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (site.hidden) return;
    let alive = true;
    base44.functions
      .invoke("site-form", { action: "count", site: site.name })
      .then((r) => {
        let seen = "";
        try {
          seen = localStorage.getItem(`bh-inbox-seen:${site.name}`) || "";
        } catch {}
        if (alive) setFresh(!!r.data?.latest && r.data.latest > seen);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [site.name, site.hidden]);
  return [fresh, () => setFresh(false)];
}

function SiteCard({ site, onEdit, onToggleHidden, onDelete, inGallery, onToggleGallery, takenDown, onMessages, onQr }) {
  const [fresh, clearFresh] = useNewMessages(site);
  const hasPreview = isInlineHtml(site.html);
  return (
    <div className="group relative rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4 hover:border-indigo-500/40 transition-colors">
      <button onClick={() => onEdit(site)} className="w-full text-left">
        <div className="relative aspect-video rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-slate-700/50 overflow-hidden mb-3">
          {hasPreview ? (
            <SitePreviewThumb html={site.html} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg">
                {initialOf(site.name)}
              </div>
            </div>
          )}
          {takenDown ? (
            <span
              className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-red-600/90 text-xs font-medium text-white"
              title="An admin took this site down for breaking the rules. Visitors see a 'removed' page."
            >
              Taken down
            </span>
          ) : site.hidden ? (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-xs font-medium text-slate-300 border border-white/10">
              Hidden
            </span>
          ) : (
            <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur text-xs font-medium text-emerald-300 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-slate-100 truncate">{site.name}</p>
        <p className="text-xs text-slate-500 truncate">{site.name}.nebuluxai.com</p>
        <p className="text-xs text-slate-600 mt-0.5">
          Updated {site.updated_date ? formatDistanceToNow(new Date(site.updated_date), { addSuffix: true }) : "recently"}
        </p>
      </button>
      <div className="flex items-center gap-1.5 mt-3">
        <button
          onClick={() => onEdit(site)}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={() => onToggleHidden(site)}
          title={site.hidden ? "Republish" : "Unpublish"}
          className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
            site.hidden ? "bg-emerald-600/80 text-white hover:bg-emerald-500" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          {site.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        {!site.hidden && (
          <button
            onClick={() => onToggleGallery(site)}
            title={inGallery ? "Remove from the public gallery" : "Show in the public gallery"}
            className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              inGallery ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${inGallery ? "fill-current" : ""}`} />
          </button>
        )}
        {!site.hidden && (
          <button
            onClick={() => {
              clearFresh();
              onMessages(site);
            }}
            title={fresh ? "New messages from your site's forms" : "Messages from your site's forms"}
            aria-label="Messages from your site's forms"
            className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 transition-colors"
          >
            <InboxIcon className="w-3.5 h-3.5" />
            {fresh && <span className="ml-1 w-2 h-2 rounded-full bg-sky-400" aria-label="new" />}
          </button>
        )}
        {!site.hidden && (
          <a
            href={siteUrl(site.name) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            title="View live"
            className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {!site.hidden && siteUrl(site.name) && (
          <button
            type="button"
            onClick={() => onQr(siteUrl(site.name))}
            title="QR code to open it on a phone"
            aria-label="QR code to open it on a phone"
            className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(site)}
          title="Delete"
          className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-red-900/50 text-red-300 text-xs hover:bg-red-900/70 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function DesignerDashboard() {
  const shell = useAppShell();
  const { sidebarOpen, setSidebarOpen, openProfile, avatarInitial, lightMode, toggleLight, navigate, effPlan, currentUser, conv, credits, isAdmin } = shell;
  const [sites, setSites] = useState([]);
  const [qrUrl, setQrUrl] = useState("");
  const [messagesFor, setMessagesFor] = useState(null); // site name whose form messages are open
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [selectedAi, setSelectedAi] = useState("ai");
  const [err, setErr] = useState("");
  const [gallery, setGallery] = useState(() => new Set());
  // Sites an admin took down (see functions/page-status.js), so owners can tell.
  const [takenDown, setTakenDown] = useState(() => new Set());
  const textareaRef = useRef(null);

  const opusAllowed = hasProFeatures(effPlan);
  const fableAllowed = hasSpace(effPlan);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PublishedSite.list("-updated_date", 200);
      setSites((list || []).filter((s) => currentUser?.role === "admin" || s.created_by_id === currentUser?.id));
    } catch (e) {
      setErr(e?.message || "Could not load your websites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [currentUser?.id]);

  // Which sites are in the public gallery (/showcase); see functions/showcase.js.
  const showGallery = (list) => setGallery(new Set((list || []).map((x) => x.name)));
  useEffect(() => {
    base44.functions.invoke("showcase", { action: "list" }).then((r) => showGallery(r.data?.sites)).catch(() => {});
  }, []);

  const setInGallery = async (s, on, title) => {
    const r = await base44.functions.invoke("showcase", { action: "set", name: s.name, on, ...(title ? { title } : {}) });
    if (r.data?.error) throw new Error(r.data.error);
    showGallery(r.data?.sites);
  };

  const toggleGallery = async (s) => {
    setErr("");
    try {
      if (gallery.has(s.name)) return await setInGallery(s, false);
      const title = await askText("Show it in the public gallery as (optional title, up to 60 characters):", { maxLength: 60 });
      if (title === null) return; // cancelled
      await setInGallery(s, true, title.trim().slice(0, 60));
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Could not update the gallery");
    }
  };

  useEffect(() => {
    if (!sites.length) return;
    let alive = true;
    Promise.all(
      sites.map((s) =>
        base44.functions
          .invoke("page-status", { kind: "site", name: s.name })
          .then((r) => (r.data?.blocked ? s.name : null))
          .catch(() => null)
      )
    ).then((names) => alive && setTakenDown(new Set(names.filter(Boolean))));
    return () => {
      alive = false;
    };
  }, [sites]);

  const lim = siteLimit(effPlan);
  const atLimit = sites.length >= lim;

  const createSite = (text) => {
    resetDesignerProject();
    navigate("/chat/designer/build", { state: text ? { initialPrompt: text } : {} });
  };

  // "New website": start from a ZIP of an existing site, or from scratch with the AI.
  const [newOpen, setNewOpen] = useState(false);
  const [zipErr, setZipErr] = useState("");
  const zipRef = useRef(null);
  const fromZip = async (f) => {
    setZipErr("");
    try {
      const site = await zipToSite(f);
      loadDesignerHtmlIntoProject(site.name, site.html);
      navigate("/chat/designer/build");
    } catch (e) {
      setZipErr(e?.message || "Couldn't open that ZIP.");
    }
  };

  const handleCreate = () => {
    const text = prompt.trim();
    createSite(text || undefined);
  };

  const editSite = async (s) => {
    let html = s.html || "";
    if (/^https?:\/\//.test(html)) {
      html = await base44.functions
        .invoke("get-site-html", { name: s.name })
        .then((r) => r.data?.html || "")
        .catch(() => "");
    }
    loadDesignerHtmlIntoProject(s.name, html);
    navigate("/chat/designer/build");
  };

  // Opens a ready-made page in the builder; no AI call, so it costs no credits.
  const openTemplate = (t) => {
    loadDesignerHtmlIntoProject(`my-${t.id}`, t.html);
    navigate("/chat/designer/build");
  };

  // Arriving from the public Templates page (after signing up) with ?template=<id>: open it
  // once, replacing this entry so Back doesn't open it again over their edits.
  useEffect(() => {
    const t = SITE_TEMPLATES.find((x) => x.id === new URLSearchParams(window.location.search).get("template"));
    if (!t) return;
    loadDesignerHtmlIntoProject(`my-${t.id}`, t.html);
    navigate("/chat/designer/build", { replace: true });
     
  }, []);

  const toggleHidden = async (s) => {
    try {
      await base44.entities.PublishedSite.update(s.id, { hidden: !s.hidden });
      if (!s.hidden && gallery.has(s.name)) await setInGallery(s, false).catch(() => {});
      load();
    } catch (e) {
      setErr(e?.message);
    }
  };

  const removeSite = async (s) => {
    if (!await askConfirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    try {
      if (gallery.has(s.name)) await setInGallery(s, false).catch(() => {});
      await base44.entities.PublishedSite.delete(s.id);
      load();
    } catch (e) {
      setErr(e?.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100 overflow-hidden relative">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px]" />

      {sidebarOpen && <Sidebar />}

      {/* Top bar */}
      <header className="relative z-20 h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-700/50 bg-slate-900/70 backdrop-blur-xl">
        <button onClick={() => setSidebarOpen((o) => !o)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors" title="Menu" aria-label="Menu: chats and tools">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">Website Designer</span>
        </div>
        <div className="flex-1" />
        <ThemeToggle light={lightMode} onToggle={toggleLight} />
        <button
          onClick={() => navigate("/chat/shop")}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-700 to-orange-700 text-[#fff] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" /> Upgrade
        </button>
        <button
          onClick={() => openProfile("main")}
          className="keep-color w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white"
          title="Account" aria-label="Your profile and settings"
        >
          {avatarInitial}
        </button>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto sidebar-scroll">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {/* Hero / create */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">What do you want to build?</h1>
            <p className="text-slate-400 mt-2 text-sm sm:text-base">Describe a website and Nebulux AI builds it live.</p>
          </div>

          <div className="max-w-2xl mx-auto bg-slate-900/70 border border-slate-700/50 focus-within:border-indigo-500/60 rounded-2xl p-3 sm:p-4 shadow-2xl transition-colors">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="A landing page for a coffee brand, with a menu and contact form..."
              rows={3}
              className="w-full bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 text-sm sm:text-base"
            />
            <div className="flex items-center justify-between mt-2">
              <AiChooser value={selectedAi} onChange={setSelectedAi} plan={effPlan} allowFable={true} />
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-sky-700 to-indigo-600 text-[#fff] text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-4 h-4" /> Create
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-2 mt-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/50 text-slate-300 text-xs hover:bg-slate-700/70 hover:text-white transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Starter templates */}
          <section className="max-w-2xl mx-auto mt-10">
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Or start from a template</h2>
            <p className="text-xs text-slate-500 mb-3">Free to open — change anything by chatting with the AI.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SITE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTemplate(t)}
                  className="text-left rounded-xl bg-slate-900/60 border border-slate-700/50 p-2 hover:border-indigo-500/50 transition-colors"
                >
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-800">
                    <SitePreviewThumb html={t.html} />
                  </div>
                  <p className="text-sm text-white font-medium mt-2 px-1">{t.title}</p>
                  <p className="text-xs text-slate-500 px-1 pb-1">{t.blurb}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Usage */}
          <div className="max-w-2xl mx-auto mt-8 flex items-center justify-between gap-3 px-1">
            <p className="text-xs text-slate-500">
              <span className="text-slate-300 font-medium">{sites.length}/{lim}</span> websites published on your{" "}
              <span className="capitalize text-slate-300">{effPlan}</span> plan
            </p>
            {atLimit && (
              <button onClick={() => navigate("/chat/shop")} className="text-xs text-amber-400 hover:text-amber-300 font-medium">
                Upgrade for more →
              </button>
            )}
          </div>

          {/* Your websites */}
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-300">Your websites</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tap <Star className="inline w-3 h-3 -mt-0.5" /> to show a site in the{" "}
                  <a href="/showcase" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">public gallery</a>.
                </p>
              </div>
              <button
                onClick={() => { setZipErr(""); setNewOpen(true); }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New website
              </button>
              {newOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setNewOpen(false)}>
                  <div className="w-full max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-semibold text-white">Create a new website</h3>
                      <button onClick={() => setNewOpen(false)} className="p-1 text-slate-400 hover:text-white" title="Close"><X className="w-4 h-4" /></button>
                    </div>
                    <p className="text-sm text-slate-400 mb-5">How do you want to start?</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <button onClick={() => zipRef.current?.click()} className="text-left rounded-xl border border-slate-700/60 bg-slate-800/60 hover:border-sky-500/60 hover:bg-slate-800 p-4 transition-colors">
                        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/15 text-sky-300 mb-3"><FileArchive className="w-5 h-5" /></span>
                        <p className="font-semibold text-white">Upload a ZIP</p>
                        <p className="text-xs text-slate-400 mt-1">Bring a website you already have (index.html with its CSS, scripts and pictures).</p>
                      </button>
                      <button onClick={() => { setNewOpen(false); createSite(); }} className="text-left rounded-xl border border-slate-700/60 bg-slate-800/60 hover:border-violet-500/60 hover:bg-slate-800 p-4 transition-colors">
                        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/15 text-violet-300 mb-3"><Sparkles className="w-5 h-5" /></span>
                        <p className="font-semibold text-white">Create from scratch with AI</p>
                        <p className="text-xs text-slate-400 mt-1">Describe it and the AI builds it. You can still upload a ZIP later.</p>
                      </button>
                    </div>
                    {zipErr && <p className="text-sm text-red-300 mt-3">{zipErr}</p>}
                    <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) fromZip(f); }} />
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : sites.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-700/60 rounded-2xl">
                <p className="text-slate-400 text-sm">You haven't published any websites yet.</p>
                <p className="text-slate-600 text-xs mt-1">Describe one above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.map((s) => (
                  <SiteCard
                    key={s.id}
                    site={s}
                    onEdit={editSite}
                    onToggleHidden={toggleHidden}
                    onDelete={removeSite}
                    inGallery={gallery.has(s.name)}
                    takenDown={takenDown.has(s.name)}
                    onToggleGallery={toggleGallery}
                    onMessages={(x) => setMessagesFor(x.name)}
                    onQr={setQrUrl}
                  />
                ))}
              </div>
            )}
            {err && <p className="text-sm text-red-400 mt-4">{err}</p>}
            {messagesFor && <SiteMessages site={messagesFor} onClose={() => setMessagesFor(null)} />}
            <QrDialog url={qrUrl} title="Scan to open the site" onClose={() => setQrUrl("")} />
          </section>
        </div>
      </main>
    </div>
  );
}
