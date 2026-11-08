import React, { useState, useEffect } from "react";
import PaymentsNotice from "@/components/PaymentsNotice";
import { PUBLIC_PLANS, YEARLY_OFF } from "@/lib/publicPlans";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck, Users, Gift, Lock, CalendarClock } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { paymentError } from "@/lib/paymentError";
import { startCheckout as goToCheckout } from "@/lib/startCheckout";
import { discountedPrice } from "../../cloudflare-lib/discounts.js";
import { savedDiscount, saveDiscount, promoPctFor } from "@/lib/promoDiscount";
import MotionPrefs from "@/components/MotionPrefs";
import usePageTitle from "@/hooks/usePageTitle";

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
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
        // The new-member discount covers plans; using it ends it.
        setOfferPct(o?.discountAvailable ? o.discountPct : 0);
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
      features: ["4 AI's (incl. Space and Nebula)", "Higher usage limits than Pro, shared by every AI", "Add up to 2 people"],
      button: "Subscribe — $20/mo",
      icon: Users,
    },
    pro: {
      name: "Pro Plan",
      amount: 15,
      price: "$15 / month",
      gradient: "from-emerald-500 to-teal-500",
      glow: "bg-emerald-600/15",
      features: ["4 AI's (incl. Space and Nebula)", "Higher usage limits than Free, shared by every AI"],
      button: "Subscribe — $15/mo",
      icon: ShieldCheck,
    },
  };
  // Only plans can be bought here; anything else (e.g. the old Secret) is Pro.
  const productId = PLANS[requested] ? requested : "pro";
  const plan = PLANS[productId];
  // Monthly or yearly (a small discount, src/lib/publicPlans.js); from the pricing page's switch too.
  const [yearly, setYearly] = useState(() => new URLSearchParams(location.search).get("billing") === "yearly" || location.state?.billing === "yearly");
  const yearPrice = PUBLIC_PLANS.find((x) => x.id === productId)?.yearly;
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
      await goToCheckout(productId, !!(yearPrice && yearly), usingPromo ? promo.code : undefined);
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
      <p className="text-slate-400 mt-3 text-center">{`Upgrade to ${productId === "team" ? "Team" : "Pro"}`}</p>
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
                  <s className="opacity-60">{plan.price}</s> {finalPrice} / month ·{" "}
                  {usingPromo ? `${promo.code}: ${pct}% off` : `${pct}% off`}
                  , yours for as long as you stay subscribed
                </>
              ) : yearPrice && yearly ? (
                <>{yearPrice.perMonth} per month · {yearPrice.price} billed yearly, {YEARLY_OFF}% off</>
              ) : (
                plan.price
              )}
            </p>
          </div>
        </div>
        {yearPrice && (
          <div className="mt-4 inline-flex rounded-full bg-slate-800/80 p-1" role="group" aria-label="Billing">
            {[[false, "Monthly"], [true, `Yearly · ${YEARLY_OFF}% off`]].map(([v, label]) => (
              <button key={label} type="button" onClick={() => setYearly(v)} aria-pressed={yearly === v} className={`tap-area px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${yearly === v ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-5 space-y-2.5 text-slate-200 text-sm">
          {plan.features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>

        <div className="mt-5">
          <div className="flex items-center gap-2">
            <input aria-label="Promo code"
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
          Every AI shares your usage limits, one that resets 5 hours after your first message and a weekly one, like Claude. Longer replies, more thinking and stronger AIs use more.
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
            this plan is billed every {yearPrice && yearly ? "year" : "month"} until I stop it. I'm allowed to make this
            purchase (if I'm under 18, a parent or guardian said yes).
          </span>
        </label>

        <button
          onClick={startCheckout}
          disabled={loading || !agreed}
          className={`mt-5 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br ${plan.gradient} text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : !pct ? plan.button : `Subscribe — ${finalPrice}/mo`}
        </button>
        {/* Why paying here is safe (everything here is what the payment code does; see /safety). */}
        <ul className="mt-4 space-y-1.5 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            You pay on our payment provider's secure page. We never see or store your card number.
          </li>
          <li className="flex items-start gap-2">
            <CalendarClock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            Billed monthly. If you stop paying you go back to the Free plan and keep your account.
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