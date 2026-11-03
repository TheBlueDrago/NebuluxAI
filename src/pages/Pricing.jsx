import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import PricingCards from "@/components/landing/PricingCards";
import { SALES_OPEN } from "@/lib/salesOpen";

const QUESTIONS = [
  ["What are the usage limits?", "Like Claude, every AI and chat shares two limits, counted in tokens (about 4 letters each): one that resets 5 hours after your first message, and a weekly one. Free gives you 100,000 tokens every 5 hours and 1,000,000 a week. Your message, the reply and the AI's thinking count; your earlier chat history doesn't. Longer replies, more thinking and stronger AIs use more" + (SALES_OPEN ? ", and paid plans get higher limits." : ". Paid plans with higher limits are coming soon.")],
  ["What are Galaxy, Space and Nebula?", "Extra AI models on Pro and Team: Galaxy for programming, and Space and Nebula for more detailed websites and writing. They share the same usage limits as Nebulux AI but use more of them: Galaxy 1.5 times as much, Space twice and Nebula three times."],
  ["Is paying safe?", "Yes. You pay on our payment provider's secure checkout page, so we never see or store your card number, and prices are set on our server, not in your browser. Plans are monthly and credit packs are one-time."],
  ["Can I cancel?", "Yes. Plans are monthly, or yearly with 10% off (yearly plans keep the same usage limits, just at a lower price). If you stop paying you go back to the Free plan when your month or year ends, and keep your account."],
  ["How does the Team plan work?", "The person who buys it can add up to 2 more people by email. Everyone gets the plan's usage limits, and the whole team shares one bill."],
  ["Do you take a cut when I sell things?", "Yes, 5% of each sale made through Buy buttons on your site, to pay for checkout and hosting. Selling is being upgraded right now."],
];

// Public pricing: the same Free / Pro / Team cards as the welcome page, with answers.
export default function Pricing() {
  return (
    <PublicLayout title="Pricing">
      <section className="text-center pt-10 pb-12">
        <h1 className="text-4xl sm:text-6xl font-bold text-white">Simple prices</h1>
        <p className="mt-4 text-slate-400 text-lg max-w-xl mx-auto">{SALES_OPEN
            ? "Start free. Pro is $15 a month, Team is $20 a month for up to 3 people (or pay yearly and save 10%), and credit packs start at $0.99 with no subscription."
            : "Start free. Paid plans are coming soon: Pro will be $15 a month and Team $20 a month for up to 3 people (or pay yearly and save 10%), and credit packs will start at $0.99 with no subscription."}</p>
      </section>
      <PricingCards />
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
