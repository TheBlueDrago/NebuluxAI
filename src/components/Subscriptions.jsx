import React, { useState } from "react";
import PaymentsNotice from "@/components/PaymentsNotice";
import { motion } from "framer-motion";
import { Check, ArrowRight, Loader2, Gift, Lock } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CreditPacks from "@/components/shop/CreditPacks";
import { savedDiscount, saveDiscount, promoPctFor } from "@/lib/promoDiscount";
import { discountedPrice } from "../../cloudflare-lib/discounts.js";

function FreeCard({ onFree }) {
  const features = ["50 Nebulux AI credits"];
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-2 border-indigo-500/60 rounded-3xl p-6 shadow-2xl shadow-indigo-500/10 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Free</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
          Current
        </span>
      </div>
      <div className="h-px bg-slate-700/60 my-4" />
      <ul className="space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-slate-200 text-sm">
            <Check className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-slate-700/40">
        <p className="text-xs text-slate-400 leading-relaxed">
          Each AI reply uses credits: 1 for every 10,000 characters it writes (a normal answer is 1), times the effort level you pick. Longer builds and higher effort use more.
        </p>
      </div>
      <button
        onClick={onFree}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-[#fff] font-medium hover:bg-indigo-700 transition-colors"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// A price chip, with the new-member discount or a promo code when one applies ("$1/mo" -> "$1 $0.70/mo").
// $15, $10.50: cents only when there are some.
const usd = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
function PriceTag({ amount, pct }) {
  if (!pct) return <>${usd(amount)}/mo</>;
  return (
    <>
      <s className="opacity-60 mr-1">${usd(amount)}</s>${discountedPrice(amount, pct).toFixed(2)}/mo
    </>
  );
}

function Plan2Card({ onPro, pct }) {
  const features = ["4 AI's (incl. Galaxy and Space in Website Designer)", "50 Nebulux Code credits", "100 Nebulux AI credits", "50 Galaxy credits", "50 Space credits", "Push to GitHub (no 2-way sync)", "Download a ZIP of your website or game in the designers"];
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-2 border-emerald-500/60 rounded-3xl p-6 shadow-2xl shadow-emerald-500/10 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Pro</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <PriceTag amount={10} pct={pct} />
        </span>
      </div>
      <div className="h-px bg-slate-700/60 my-4" />
      <ul className="space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-slate-200 text-sm">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-slate-700/40">
        <p className="text-xs text-slate-400 leading-relaxed">
          Each AI reply uses credits: 1 for every 10,000 characters it writes (a normal answer is 1), times the effort level you pick. Longer builds and higher effort use more.
        </p>
      </div>
      <button
        onClick={onPro}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-700 text-[#fff] font-medium hover:opacity-90 transition-opacity"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function TeamCard({ onTeam, pct }) {
  const features = [
    "4 AI's (incl. Galaxy and Space in Website Designer)",
    "100 Nebulux Code credits",
    "150 Nebulux AI credits",
    "100 Galaxy credits",
    "100 Space credits",
    "Add up to 2 people — everyone shares the credits",
    "Push to GitHub (no 2-way sync)",
    "Download a ZIP of your website or game in the designers",
  ];
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-2 border-sky-500/60 rounded-3xl p-6 shadow-2xl shadow-sky-500/10 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Team</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
          <PriceTag amount={15} pct={pct} />
        </span>
      </div>
      <div className="h-px bg-slate-700/60 my-4" />
      <ul className="space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-slate-200 text-sm">
            <Check className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-slate-700/40">
        <p className="text-xs text-slate-400 leading-relaxed">
          Invite up to 2 people to your plan (3 with you). You all draw from the same pool — if someone wastes
          100 credits, the whole team's credits go down.
        </p>
      </div>
      <button
        onClick={onTeam}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-sky-700 to-indigo-600 text-[#fff] font-medium hover:opacity-90 transition-opacity"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function EnterpriseCard({ onEnterprise }) {
  const features = [
    "For registered organizations (LLC, corporation, nonprofit…)",
    "As many seats as you need",
    "Everyone shares one pool of credits: each seat adds 100 Nebulux AI, 75 Code, 50 Galaxy and 25 Space a month",
    "All 4 AI's, ZIP download and GitHub push",
    "10 published websites and 10 new games a month",
  ];
  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-2 border-violet-500/60 rounded-3xl p-6 shadow-2xl shadow-violet-500/10 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Enterprise</h3>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">Custom</span>
      </div>
      <div className="h-px bg-slate-700/60 my-4" />
      <ul className="space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-slate-200 text-sm">
            <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-slate-700/40">
        <p className="text-xs text-slate-400 leading-relaxed">Price and credits depend on how many people use it. Tell us about your organization and we'll send a quote.</p>
      </div>
      <button
        onClick={onEnterprise}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white font-medium hover:opacity-90 transition-opacity"
      >
        Contact sales
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// A heading for each part of the shop.
function SectionTitle({ title, sub }) {
  return (
    <div className="text-center">
      <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
      {sub && <p className="text-slate-400 mt-2 text-sm">{sub}</p>}
    </div>
  );
}

// The Shop: plans at the top, then one-time credit packs for every AI, then promo codes.
// offer: the signed-in user's new-member offer (from the credit status), if any.
// onBuyPack(productId): open Billing on a credit pack.
export default function Subscriptions({ onFree, onPro, onTeam, onBuyPack, offer }) {
  const pct = offer?.discountAvailable ? offer.discountPct : 0;
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState("");
  // A discount code entered here: prices below show it, and Billing applies it at checkout.
  const [discount, setDiscount] = useState(savedDiscount);
  const planPct = (id) => Math.max(pct, promoPctFor(discount, id));

  const doRedeem = async () => {
    const code = promoInput.trim();
    if (!code || promoBusy) return;
    setPromoError("");
    setPromoBusy(true);
    try {
      const res = await base44.functions.invoke("redeem-promo", { code });
      if (res.data?.kind === "discount") {
        const d = { code: res.data.code, pct: res.data.pct, target: res.data.target, label: res.data.label };
        saveDiscount(d);
        setDiscount(d);
        setPromoInput("");
        return;
      }
      navigate("/promo-success", { state: { aiModel: res.data?.aiModel, credits: res.data?.credits } });
    } catch (e) {
      setPromoError(e?.response?.data?.error || e?.message || "Could not redeem code.");
    } finally {
      setPromoBusy(false);
    }
  };

  const redeem = () => {
    if (!promoInput.trim() || promoBusy) return;
    doRedeem();
  };

  return (
    <motion.div
      key="shop"
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
        <span className="bh-wordmark bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">Shop</span>
      </h1>
      <p className="text-slate-400 mt-3 text-center">Plans, credits and promo codes</p>
      <PaymentsNotice className="mt-4" />
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-400" /> Secure checkout, we never see your card
        </span>
        <span>Plans are monthly</span>
        <span>Credit packs are one-time</span>
        <span>Prices in US dollars</span>
        <Link to="/safety" className="underline hover:text-slate-200">Trust &amp; safety</Link>
      </p>

      <div className="mt-10">
        <SectionTitle title="Plans" sub="Monthly credits for every AI, plus more features" />
      </div>
      {pct > 0 && (
        <p className="mt-4 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-100 text-sm text-center">
          New-member offer: {pct}% off any plan, and you keep that price as long as you stay subscribed.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-8 max-w-7xl w-full">
        <FreeCard onFree={onFree} />
        <Plan2Card onPro={onPro} pct={planPct("pro")} />
        <TeamCard onTeam={onTeam} pct={planPct("team")} />
        <EnterpriseCard onEnterprise={() => navigate("/enterprise")} />
      </div>

      <div className="mt-10 w-full max-w-md mx-auto">
        <button
          onClick={onFree}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Credits */}
      <div className="mt-16 w-full max-w-4xl mx-auto">
        <SectionTitle title="Credits" sub="Rather not subscribe? Buy 10 to 50 credits for any AI, whatever your plan." />
        <div className="mt-8">
          <CreditPacks discount={discount} onBuy={onBuyPack || ((id) => navigate("/billing", { state: { productId: id } }))} />
        </div>
      </div>

      {/* Promo codes */}
      <div className="mt-16 mb-6 w-full max-w-md mx-auto">
        <SectionTitle title="Promo codes" sub="Have a promo code? Redeem it for free credits or money off." />
        <div className="mt-6" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") redeem();
            }}
            placeholder="Enter promo code"
            className="flex-1 min-w-0 bg-slate-800/70 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition-colors uppercase tracking-wide"
          />
          <button
            onClick={redeem}
            disabled={promoBusy || !promoInput.trim()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-700 text-[#fff] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {promoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Redeem
          </button>
        </div>
        {promoError && <p className="text-center text-sm text-red-400 mt-2">{promoError}</p>}
        {discount && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
            <Gift className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
            <p className="flex-1">
              <span className="font-semibold">{discount.code}</span>: {discount.pct}% off {discount.label.toLowerCase()}. The prices above
              show it, and it's taken off at checkout.
            </p>
            <button
              onClick={() => {
                saveDiscount(null);
                setDiscount(null);
              }}
              className="text-xs text-emerald-300 hover:text-white"
            >
              Remove
            </button>
          </div>
        )}
      </div>

    </motion.div>
  );
}