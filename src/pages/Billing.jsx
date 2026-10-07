import React, { useState, useEffect } from "react";
import PaymentsNotice from "@/components/PaymentsNotice";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck, Users, Zap, Gift, Lock, CalendarClock } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { paymentError } from "@/lib/paymentError";
import { CREDIT_PACKS, PACK_SIZES, packsForTier } from "../../cloudflare-lib/creditPacks.js";
import { TIER_NAMES, TIERS } from "../../cloudflare-lib/planTotals.js";
import { discountedPrice } from "../../cloudflare-lib/discounts.js";
import { savedDiscount, saveDiscount, promoPctFor } from "@/lib/promoDiscount";
import MotionPrefs from "@/components/MotionPrefs";
import usePageTitle from "@/hooks/usePageTitle";

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
// The pack of `size` credits for another AI.
const packId = (tier, size) => packsForTier(tier).find(([, p]) => p.credits === size)?.[0];

// A one-time credit pack laid out like a plan (prices are checked again by create-checkout).
function packPlan(id) {
  const p = CREDIT_PACKS[id];
  const amount = Number(p.price);
  return {
    name: `${p.credits} ${TIER_NAMES[p.tier]} credits`,
    amount,
    price: `${money(amount)} one-time`,
    gradient: "from-amber-500 to-orange-500",
    glow: "bg-amber-600/15",
    features: [
      "One-time purchase, no subscription",
      "Added to your account as soon as the payment goes through",
      "They don't reset at the end of the month: they stay until you use them",
      "Used before your monthly credits",
    ],
    button: `Buy — ${money(amount)}`,
    icon: Zap,
    pack: true,
  };
}

export default function BillingPage() {
  return (
    <MotionPrefs>
      <Billing />
    </MotionPrefs>
  );
}

function Billing() {
  usePageTitle("Checkout");
  const navigate = useNavigate();
  const location = useLocation();
  const requested = location.state?.productId ?? "pro";
  // Credit packs: which AI and size, switchable here.
  const [chosenPack, setChosenPack] = useState(CREDIT_PACKS[requested] ? requested : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  // The new-member discount, if this account has it right now (checkout applies it itself).
  const [offerPct, setOfferPct] = useState(0);
  // A discount promo code (from the Shop or typed here). Checkout checks it again on the server.
  const [promo, setPromo] = useState(savedDiscount);
  const [promoInput, setPromoInput] = useState(() => savedDiscount()?.code || "");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState("");
  useEffect(() => {
    base44.functions
      .invoke("credits")
      .then((r) => {
        const o = r.data?.offer;
        // The new-member discount covers plans and credit packs; using it on either ends it.
        setOfferPct(o?.discountAvailable ? (CREDIT_PACKS[requested] ? o.packDiscountPct || 20 : o.discountPct) : 0);
      })
      .catch(() => {});
  }, [requested]);

  const PLANS = {
    team: {
      name: "Team Plan",
      amount: 20,
      price: "$20 / month",
      gradient: "from-sky-500 to-indigo-500",
      glow: "bg-sky-600/15",
      features: ["4 AI's (incl. Space and Nebula)", "150 Nebulux AI credits / month", "100 Galaxy credits / month (shared)", "100 Space credits / month", "100 Nebula credits / month", "Add up to 2 people — shared credits"],
      button: "Subscribe — $20/mo",
      icon: Users,
    },
    pro: {
      name: "Pro Plan",
      amount: 15,
      price: "$15 / month",
      gradient: "from-emerald-500 to-teal-500",
      glow: "bg-emerald-600/15",
      features: ["4 AI's (incl. Space and Nebula)", "100 Nebulux AI credits / month", "50 Galaxy credits / month", "50 Space credits / month", "50 Nebula credits / month"],
      button: "Subscribe — $15/mo",
      icon: ShieldCheck,
    },
  };
  // Only plans and credit packs can be bought here; anything else (e.g. the old Secret) is Pro.
  const productId = chosenPack || (PLANS[requested] ? requested : "pro");
  const plan = PLANS[productId] || packPlan(productId);
  // The bigger of the new-member offer and the promo code (they don't stack).
  const promoPct = promoPctFor(promo, productId);
  const usingPromo = promoPct > offerPct;
  const pct = Math.max(offerPct, promoPct);
  const finalPrice = money(discountedPrice(plan.amount, pct));

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || promoBusy) return;
    setPromoErr("");
    setPromoBusy(true);
    try {
      const r = await base44.functions.invoke("promo-discount", { code, productId });
      const d = { code: r.data.code, pct: r.data.pct, target: r.data.target, label: r.data.label };
      saveDiscount(d);
      setPromo(d);
    } catch (e) {
      setPromoErr(e?.response?.data?.error || e?.message || "Could not check that code.");
    } finally {
      setPromoBusy(false);
    }
  };
  const removePromo = () => {
    saveDiscount(null);
    setPromo(null);
    setPromoInput("");
    setPromoErr("");
  };

  const startCheckout = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("create-checkout", { productId, ...(usingPromo ? { promoCode: promo.code } : {}) });
      const redirectUrl = res.data?.redirectUrl;
      if (!redirectUrl) throw new Error("No checkout URL");
      window.location.href = redirectUrl;
    } catch (e) {
      setError(paymentError(e));
      setLoading(false);
    }
  };

  const Icon = plan.icon;

  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] ${plan.glow} rounded-full blur-[120px] pointer-events-none`} />

      <button
        onClick={() => navigate("/chat")}
        className="fixed top-5 left-5 z-30 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50 text-slate-200 hover:bg-slate-700/70 transition-colors"
        title="Back"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
        <span className="bg-gradient-to-r from-white via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
          Billing
        </span>
      </h1>
      <p className="text-slate-400 mt-3 text-center">{plan.pack ? "Buy credits" : `Upgrade to ${productId === "team" ? "Team" : "Pro"}`}</p>
      <PaymentsNotice className="mt-4" />

      <div className="mt-10 w-full max-w-md bg-slate-900/70 backdrop-blur-xl border border-slate-700/40 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            <p className="text-slate-400 text-sm">
              {pct ? (
                <>
                  <s className="opacity-60">{plan.price}</s> {finalPrice} {plan.pack ? "one-time" : "/ month"} ·{" "}
                  {usingPromo ? `${promo.code}: ${pct}% off` : `${pct}% off`}
                  {plan.pack ? "" : ", yours for as long as you stay subscribed"}
                </>
              ) : (
                plan.price
              )}
            </p>
          </div>
        </div>

        {plan.pack && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TIERS.map((t) => {
                const on = CREDIT_PACKS[productId].tier === t;
                return (
                  <button
                    key={t}
                    onClick={() => setChosenPack(packId(t, CREDIT_PACKS[productId].credits))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      on ? "bg-amber-500/20 border-amber-400/60 text-amber-200" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {TIER_NAMES[t]}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PACK_SIZES.map((n) => {
                const id = packId(CREDIT_PACKS[productId].tier, n);
                const on = id === productId;
                return (
                  <button
                    key={n}
                    onClick={() => setChosenPack(id)}
                    className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                      on ? "bg-amber-500/20 border-amber-400/60" : "border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    <span className="block text-lg font-bold text-white">{n}</span>
                    <span className="block text-xs text-slate-400">{money(Number(CREDIT_PACKS[id].price))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ul className="mt-5 space-y-2.5 text-slate-200 text-sm">
          {plan.features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>

        <div className="mt-5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPromo();
              }}
              placeholder="Promo code"
              className="flex-1 min-w-0 bg-slate-800/70 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none uppercase tracking-wide"
            />
            {promo && promo.code === promoInput.trim() ? (
              <button onClick={removePromo} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-medium hover:bg-slate-700">
                Remove
              </button>
            ) : (
              <button
                onClick={applyPromo}
                disabled={promoBusy || !promoInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {promoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Apply
              </button>
            )}
          </div>
          {promoErr && <p className="mt-1.5 text-xs text-red-400">{promoErr}</p>}
          {promo && !promoErr && (
            <p className={`mt-1.5 text-xs ${promoPct ? "text-emerald-300" : "text-amber-300"}`}>
              {!promoPct
                ? `${promo.code} is only for: ${promo.label.toLowerCase()}.`
                : usingPromo
                  ? `${promo.code}: ${promo.pct}% off.`
                  : `Your new-member offer (${offerPct}% off) is bigger than ${promo.code}, so it's used instead.`}
            </p>
          )}
        </div>

        <p className="mt-5 pt-4 border-t border-slate-700/40 text-xs text-slate-400 leading-relaxed">
          Each AI reply uses credits: 1 for every 10,000 characters it writes (a normal answer is 1), times the effort level you pick. Longer builds and higher effort use more.
        </p>

        {error && <p className="mt-4 text-sm text-red-400 text-center">{error}</p>}

        <label className="mt-5 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-slate-600 bg-slate-800 accent-indigo-500 shrink-0"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            I agree to the <Link to="/terms" className="underline hover:text-white">Terms</Link> and understand that{" "}
            {plan.pack ? "this is a one-time payment" : "this plan is billed every month until I stop it"}. I'm allowed to make this
            purchase (if I'm under 18, a parent or guardian said yes).
          </span>
        </label>

        <button
          onClick={startCheckout}
          disabled={loading || !agreed}
          className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br ${plan.gradient} text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : !pct ? plan.button : plan.pack ? `Buy — ${finalPrice}` : `Subscribe — ${finalPrice}/mo`}
        </button>
        {/* Why paying here is safe (everything here is what the payment code does; see /safety). */}
        <ul className="mt-4 space-y-1.5 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            You pay on our payment provider's secure page. We never see or store your card number.
          </li>
          <li className="flex items-start gap-2">
            <CalendarClock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            {plan.pack
              ? "One payment, no subscription. The credits don't reset at the end of the month."
              : "Billed monthly. If you stop paying you go back to the Free plan and keep your account."}
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            The price is set on our server, and you see the final amount, including any tax for where you live, before you pay. Prices are in US dollars.
          </li>
        </ul>
        <p className="mt-3 text-center text-xs text-slate-500">
          <Link to="/safety" className="underline hover:text-slate-300">How we keep payments safe</Link> ·{" "}
          <Link to="/terms" className="underline hover:text-slate-300">Terms</Link> ·{" "}
          <Link to="/privacy" className="underline hover:text-slate-300">Privacy</Link>
        </p>
      </div>
    </motion.div>
  );
}