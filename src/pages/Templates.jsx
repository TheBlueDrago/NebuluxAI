import React, { useCallback } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { SITE_TEMPLATES } from "@/lib/siteTemplates";
import { loadDesignerHtmlIntoProject } from "@/lib/designerStore";
import PublicLayout from "@/components/PublicLayout";
import SiteThumb from "@/components/SiteThumb";
import TemplatePreview from "@/components/TemplatePreview";
import { GUIDES } from "../../cloudflare-lib/guides.js";

// The how-to guide that starts from a template, if there is one (its button opens that template).
const guideFor = (id) => GUIDES.find((g) => g.cta.to.endsWith("template%3D" + id));

// Public list of the Website Designer's starter templates. "Use this template" opens it in
// the designer; people without an account sign up first and land there with it open
// (DesignerDashboard reads ?template=). "Preview" opens a working full-screen copy at
// ?preview=<id>, a link people can share; Back closes it.
export default function Templates() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const previewing = SITE_TEMPLATES.find((t) => t.id === params.get("preview"));

  const use = (t) => {
    if (isAuthenticated) {
      loadDesignerHtmlIntoProject(`my-${t.id}`, t.html);
      navigate("/chat/designer/build");
    } else {
      navigate("/register?returnTo=" + encodeURIComponent(`/chat/designer?template=${t.id}`));
    }
  };

  const preview = (t) => setParams({ preview: t.id }, { state: { fromList: true }, preventScrollReset: true });
  const fromList = !!location.state?.fromList;
  const close = useCallback(
    () => (fromList ? navigate(-1) : setParams({}, { replace: true, preventScrollReset: true })),
    [fromList, navigate, setParams]
  );

  return (
    <PublicLayout title={previewing ? `${previewing.title} template` : "Free website templates"}>
      <section className="text-center pt-8 pb-10">
        <h1 className="text-3xl sm:text-5xl font-bold text-white">Free website templates</h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">
          Pick one, then change anything by telling the AI what you want: words, colors, pages, a shop. Publish it free at
          <span className="text-slate-200"> yourname.nebuluxai.com</span>.
        </p>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {SITE_TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3">
            <button
              onClick={() => preview(t)}
              aria-label={`Preview ${t.title}`}
              className="group relative block w-full aspect-[16/10] rounded-xl overflow-hidden bg-slate-800"
            >
              <SiteThumb html={t.html} />
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover:bg-slate-950/40 transition-colors">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-sm font-medium">
                  <Eye className="w-4 h-4" /> Preview
                </span>
              </span>
            </button>
            <div className="flex items-center justify-between gap-3 mt-3 px-1">
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{t.title}</h2>
                <p className="text-xs text-slate-400">{t.blurb}</p>
                {guideFor(t.id) && (
                  <Link to={`/guides/${guideFor(t.id).slug}`} className="tap-area text-xs text-indigo-300 hover:underline">
                    How-to guide
                  </Link>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => preview(t)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button
                  onClick={() => use(t)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-sm font-semibold hover:opacity-90"
                >
                  Use it <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-slate-500 text-sm mt-10">
        Want something else? Describe any website in a sentence and the AI builds it from scratch.
      </p>
      {previewing && <TemplatePreview template={previewing} onClose={close} onUse={use} />}
    </PublicLayout>
  );
}
