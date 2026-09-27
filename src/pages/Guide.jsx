import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { GUIDES, GUIDES_UPDATED, guideBySlug } from "../../cloudflare-lib/guides.js";

const updated = new Date(GUIDES_UPDATED + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// One how-to guide. The server also puts the same text in the page before the app loads
// (functions/guides/[slug].js), so search engines read it either way.
export default function Guide() {
  const { slug } = useParams();
  const g = guideBySlug(slug);

  if (!g) {
    return (
      <PublicLayout title="Guide not found">
        <section className="text-center py-24">
          <h1 className="text-3xl font-bold text-white">We couldn't find that guide</h1>
          <p className="mt-3 text-slate-400">It may have moved. Here are all of them:</p>
          <Link to="/guides" className="inline-flex items-center gap-1 mt-6 text-indigo-300 hover:text-indigo-200">
            All guides <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </PublicLayout>
    );
  }

  const related = (g.related || []).map(guideBySlug).filter(Boolean);
  const more = related.length ? related : GUIDES.filter((x) => x.slug !== g.slug).slice(0, 2);

  return (
    <PublicLayout title={g.title}>
      <article className="max-w-2xl mx-auto pt-6 sm:pt-10">
        <Link to="/guides" className="inline-flex items-center gap-1 text-sm text-indigo-300 hover:text-indigo-200">
          <ArrowLeft className="w-4 h-4" /> All guides
        </Link>
        <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-white leading-tight">{g.title}</h1>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> {g.minutes} min read
          </span>
          <span>Updated {updated}</span>
        </p>
        <p className="mt-6 text-lg text-slate-300 leading-relaxed">{g.intro}</p>

        {g.sections.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="text-2xl font-bold text-white">{s.heading}</h2>
            {(s.paragraphs || []).map((p) => (
              <p key={p} className="mt-3 text-slate-300 leading-relaxed">
                {p}
              </p>
            ))}
            {s.list && (
              <ul className="mt-3 space-y-2">
                {s.list.map((li) => (
                  <li key={li} className="flex gap-3 text-slate-300 leading-relaxed">
                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="mt-14 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-400/30 p-6 sm:p-8 text-center">
          <p className="text-xl font-semibold text-white">Ready to try it?</p>
          <p className="mt-1 text-slate-300">It's free: all 4 AIs, 3 websites and unlimited games.</p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={g.cta.to}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90"
            >
              {g.cta.label} <ArrowRight className="w-4 h-4" />
            </Link>
            {g.more && (
              <Link to={g.more.to} className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-full border border-slate-600 text-slate-200 font-medium hover:bg-white/5">
                {g.more.label}
              </Link>
            )}
          </div>
        </div>

        <section className="mt-14">
          <h2 className="text-lg font-semibold text-white">More guides</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {more.map((x) => (
              <Link key={x.slug} to={`/guides/${x.slug}`} className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4 hover:border-indigo-500/50 transition-colors">
                <span className="block font-medium text-white">{x.title}</span>
                <span className="block mt-1 text-sm text-slate-400">{x.minutes} min read</span>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </PublicLayout>
  );
}
