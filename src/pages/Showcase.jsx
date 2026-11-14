import React, { useEffect, useState } from "react";
import { Loader2, ExternalLink, Flag, Play, Gamepad2, ArrowRight, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SiteThumb from "@/components/SiteThumb";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { loadDesignerHtmlIntoProject } from "@/lib/designerStore";
import PublicLayout, { START_FREE } from "@/components/PublicLayout";
import { SITE_TEMPLATES } from "@/lib/siteTemplates";
import { siteUrl } from "@/lib/blackholeDomain";
import { gameThumb } from "@/lib/gameThumbs";
import { BEST_GAMES, ORBIT_USES, ORBIT_URL, SITES_URL, orbitLink } from "@/lib/examples";
import Reviews from "@/components/Reviews";

// The examples gallery: the best games (each plays with no account), websites people built with
// Nebulux AI (owners opt in from the Website Designer) and what people use Nebulux Orbit for.
// Doubles as a landing page for visitors who aren't signed up.
export default function Showcase() {
  const [sites, setSites] = useState(null);
  const [error, setError] = useState("");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [remixing, setRemixing] = useState("");
  // Remix: a copy of a gallery site opens in the Website Designer (the original stays as it is).
  const remix = async (s) => {
    if (!isAuthenticated) return navigate("/register?returnTo=" + encodeURIComponent("/showcase"));
    setRemixing(s.name);
    try {
      const r = await base44.functions.invoke("get-site-html", { name: s.name });
      if (!r.data?.html) throw new Error("no page");
      loadDesignerHtmlIntoProject(("my-" + s.name).slice(0, 40), r.data.html);
      navigate("/chat/designer/build");
    } catch {
      setError("Couldn't open that site to remix. Try again in a minute.");
    }
    setRemixing("");
  };

  useEffect(() => {
    base44.functions
      .invoke("showcase", { action: "list" })
      .then((r) => setSites(r.data?.sites || []))
      .catch(() => setError("Couldn't load the gallery. Try again in a minute."));
  }, []);

  return (
    <PublicLayout title="Gallery">
      <div className="text-center py-10 sm:py-14">
        <h1 className="text-3xl sm:text-5xl font-bold text-white">Made with Nebulux AI</h1>
        <p className="text-slate-400 mt-3 max-w-xl mx-auto">
          The best games, websites and Orbit uses. Everything here opens with one tap, and none of it needs an account.
        </p>
        <nav aria-label="Jump to" className="mt-5 flex flex-wrap justify-center gap-2">
          {[["#games", "Games"], ["#sites", "Websites"], ["#orbit", "Orbit uses"]].map(([to, label]) => (
            <a key={to} href={to} className="tap-area px-4 py-2.5 rounded-full text-sm bg-slate-900/60 border border-slate-700/60 text-slate-200 hover:text-white hover:border-indigo-400/60">{label}</a>
          ))}
        </nav>
      </div>

      <section id="games" className="scroll-mt-24">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Best games</h2>
          <Link to="/arcade" className="tap-area shrink-0 text-sm text-indigo-300 hover:text-indigo-200">All games</Link>
        </div>
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {BEST_GAMES.map((g) => (
            <Link key={g.name} to={`/play/${g.name}`} className="group rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3 hover:border-fuchsia-500/50 transition-colors">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
                {gameThumb(g.name) ? <img src={gameThumb(g.name)} alt="" loading="lazy" width="400" height="300" className="absolute inset-0 w-full h-full object-cover" /> : <Gamepad2 className="w-10 h-10 text-white/90" aria-hidden />}
              </div>
              <p className="mt-2 text-sm font-medium text-white truncate">{g.title}</p>
              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">{g.text}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-300"><Play className="w-3.5 h-3.5" /> Play</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="sites" className="scroll-mt-24 mt-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Websites people built</h2>
        <p className="text-slate-400 mt-2 mb-5 max-w-xl">
          Real websites people described in a sentence and published in minutes. Describe yours and it's live at
          <span className="text-slate-200"> yourname.nebuluxai.com</span>. Want one built for you instead?{" "}
          <a href={SITES_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200">See Nebulux Sites</a>.
        </p>

      {error ? (
        <p className="text-center text-red-400 text-sm">{error}</p>
      ) : !sites ? (
        <div className="flex justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : sites.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-lg text-white font-semibold">The gallery is brand new: your site could be the first one here.</p>
          <p className="mt-2 text-slate-400">Build a site, publish it, then tap the star on it in the Website Designer to add it to the gallery.</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5 text-left">
            {SITE_TEMPLATES.slice(0, 4).map((t) => (
              <Link key={t.id} to="/templates" className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3 hover:border-indigo-500/50 transition-colors">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-800">
                  <SiteThumb html={t.html} />
                </div>
                <p className="mt-3 px-1 text-sm font-medium text-white">{t.title} template</p>
              </Link>
            ))}
          </div>
          <Link to={START_FREE} className="mt-8 inline-flex items-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200">
            Get started for free
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sites.map((s) => (
            <div key={s.name} className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3 hover:border-indigo-500/50 transition-colors">
              <a href={siteUrl(s.name) || "/showcase"} target="_blank" rel="noopener noreferrer" className="group block">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-800">
                  <SiteThumb name={s.name} />
                </div>
                <div className="flex items-center gap-2 mt-3 px-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{s.title || s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{s.name}.nebuluxai.com</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
                </div>
              </a>
              {/* Made by people, not us: anyone can flag one that breaks the rules. */}
              <Link
                to={`/report?${new URLSearchParams({ kind: "site", name: s.name })}`}
                className="mt-2 ml-1 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300"
                aria-label={`Report ${s.title || s.name}`}
              >
                <Flag className="w-3 h-3" /> Report
              </Link>
              <Reviews kind="site" item={s.name} title={s.title || s.name} className="mt-2 ml-3 text-[11px] !text-slate-400 hover:!text-slate-200" />
              {s.remix !== false && <button type="button" onClick={() => remix(s)} disabled={remixing === s.name} className="tap-area mt-2 ml-3 inline-flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 disabled:opacity-60" aria-label={`Remix ${s.title || s.name}`}>
                {remixing === s.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Remix
              </button>}
            </div>
          ))}
        </div>
      )}
      </section>

      <section id="orbit" className="scroll-mt-24 mt-16 mb-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">What people use Orbit for</h2>
          <a href={ORBIT_URL} target="_blank" rel="noopener noreferrer" className="tap-area shrink-0 text-sm text-indigo-300 hover:text-indigo-200">Open Orbit</a>
        </div>
        <p className="text-slate-400 mt-2 max-w-xl">Nebulux Orbit is your personal AI: it plans, remembers and keeps your tasks on track. Tap one to try it with the words already typed.</p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ORBIT_USES.map((u) => (
            <a key={u.title} href={orbitLink(u.ask)} target="_blank" rel="noopener noreferrer" className="group rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4 hover:border-indigo-500/50 transition-colors">
              <p className="font-semibold text-white">{u.title}</p>
              <p className="mt-1 text-sm text-slate-400">{u.text}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-300">Try it <ArrowRight className="w-3.5 h-3.5" /></span>
            </a>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
