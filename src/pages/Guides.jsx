import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { GUIDES } from "../../cloudflare-lib/guides.js";

// Guides about using the AI itself, about connecting other apps; the rest are about building websites and games.
const AI_HELP = new Set(["ai-study-mode", "make-flashcards-with-ai", "ai-homework-help", "write-better-with-ai", "learn-to-code-with-ai", "resume-and-cover-letter-with-ai", "ai-for-small-business"]);
const APPS = new Set(["zoom"]);
const GROUPS = [
  { title: "Get help from the AI", guides: GUIDES.filter((g) => AI_HELP.has(g.slug)) },
  { title: "Connect your apps", guides: GUIDES.filter((g) => APPS.has(g.slug)) },
  { title: "Build websites and games", guides: GUIDES.filter((g) => !AI_HELP.has(g.slug) && !APPS.has(g.slug)) },
];

// How-to guides: short, practical articles that answer what people search for ("how to make
// a website for free") and lead into the product. The words live in cloudflare-lib/guides.js.
export default function Guides() {
  return (
    <PublicLayout title="Guides">
      <section className="text-center pt-8 pb-10">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-indigo-300">
          <BookOpen className="w-4 h-4" /> Guides
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-bold text-white">Learn to make things with AI</h1>
        <p className="mt-3 text-slate-400 max-w-xl mx-auto">Short, step-by-step guides to getting the most out of AI: homework, writing, code, websites and games. No experience needed.</p>
      </section>
      {GROUPS.filter((grp) => grp.guides.length).map((grp) => (
        <section key={grp.title} className="max-w-4xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">{grp.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {grp.guides.map((g) => (
              <Link
                key={g.slug}
                to={`/guides/${g.slug}`}
                className="group flex flex-col rounded-2xl bg-slate-900/60 border border-slate-700/50 p-6 hover:border-indigo-500/50 transition-colors"
              >
                <h3 className="text-xl font-semibold text-white group-hover:text-indigo-200">{g.title}</h3>
                <p className="mt-2 text-slate-400 flex-1">{g.description}</p>
                <span className="mt-4 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-4 h-4" /> {g.minutes} min read
                  </span>
                  <span className="inline-flex items-center gap-1 text-indigo-300 font-medium">
                    Read <ArrowRight className="w-4 h-4" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </PublicLayout>
  );
}
