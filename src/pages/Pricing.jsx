import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PricingCards from "@/components/landing/PricingCards";
import CreditPacksTable from "@/components/landing/CreditPacksTable";

const QUESTIONS = [
  ["What are credits?", "Credits are what the AI uses up when it works for you. Bigger jobs, like building a whole website, use more than a quick question. Every plan gets a fresh allowance each month, and you can buy one-time packs any time."],
  ["What are Code, Galaxy and Space?", "Extra AI models on Pro and Team: Nebulux Code for programming, and Galaxy and Space for more detailed websites and writing. Each has its own credits."],
  ["Is paying safe?", "Yes. You pay on our payment provider's secure checkout page, so we never see or store your card number, and prices are set on our server, not in your browser. Plans are monthly and credit packs are one-time."],
  ["Can I cancel?", "Yes. Plans are monthly, and if you stop paying you go back to the Free plan and keep your account."],
  ["How does the Team plan work?", "The person who buys it can add up to 2 more people by email. Everyone draws from the same pool of credits, so the whole team shares one bill."],
  ["Do you take a cut when I sell things?", "Yes, 5% of each sale made through Buy buttons on your site, to pay for checkout and hosting. Selling is being upgraded right now."],
];

// Public pricing: the same Free / Pro / Team cards as the welcome page, with answers.
export default function Pricing() {
  return (
    <PublicLayout title="Pricing">
      <section className="text-center pt-10 pb-12">
        <h1 className="text-4xl sm:text-6xl font-bold text-white">Simple prices</h1>
        <p className="mt-4 text-slate-400 text-lg max-w-xl mx-auto">Start free. Pro is $15 a month, Team is $20 a month for up to 3 people, and credit packs start at $0.99 with no subscription.</p>
      </section>
      <PricingCards />
      <section id="packs" className="mt-10 max-w-3xl mx-auto scroll-mt-24">
        <CreditPacksTable />
      </section>
      <section className="mt-20 max-w-3xl mx-auto">
        <h2 className="text-center text-3xl font-bold text-white">Pricing questions</h2>
        <div className="mt-8 divide-y divide-slate-800 border-y border-slate-800">
          {QUESTIONS.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-lg font-medium text-white">
                {q}
                <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-slate-400">{a}</p>
            </details>
          ))}
        </div>
        <p className="text-center mt-8 text-slate-400">
          Something else? <Link to="/contact?topic=billing" className="text-indigo-300 hover:text-indigo-200">Contact us</Link>
          {" · "}
          <Link to="/safety" className="text-indigo-300 hover:text-indigo-200">How we keep you safe</Link>
        </p>
      </section>
    </PublicLayout>
  );
}
