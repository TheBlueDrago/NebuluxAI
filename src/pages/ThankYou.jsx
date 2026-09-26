import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { siteUrl } from "@/lib/blackholeDomain";
import MotionPrefs from "@/components/MotionPrefs";
import usePageTitle from "@/hooks/usePageTitle";
import { addNotification } from "@/lib/notifications";

// After paying. Plans and credit packs come back here from create-checkout; purchases on a
// site someone made come back with ?site=<name> from site-checkout (older checkouts without
// it get the wording that covers both).
export default function ThankYouPage() {
  return (
    <MotionPrefs>
      <ThankYou />
    </MotionPrefs>
  );
}

function ThankYou() {
  usePageTitle("Thank you");
  React.useEffect(() => {
    addNotification({ kind: "purchase", text: "Thanks for your purchase! Your plan or credits are being added.", link: "/chat/plans" });
  }, []);
  const [params] = useSearchParams();
  const siteHome = siteUrl(params.get("site") || "");
  const help = (
    <>
      Not there after 10 minutes?{" "}
      <Link to="/contact?topic=billing" className="text-emerald-300 underline hover:text-emerald-200">
        Tell us
      </Link>{" "}
      and we'll sort it out.
    </>
  );
  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-white text-center">Thanks for your purchase!</h1>
      {siteHome ? (
        <p className="text-slate-400 mt-3 text-center max-w-md">
          Your payment to <span className="text-slate-200 [overflow-wrap:anywhere]">{siteHome.replace("https://", "")}</span> is being confirmed. The site's owner
          is the seller and will deliver what you bought. If something's wrong, contact them first; if the site looks like a scam,{" "}
          <Link to={`/report?${new URLSearchParams({ kind: "site", name: params.get("site") || "" })}`} className="text-emerald-300 underline hover:text-emerald-200">
            report it
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-slate-400 mt-3 text-center max-w-md">We're confirming your payment.</p>
          <p className="text-slate-400 mt-2 text-center max-w-md text-sm">
            Bought a plan or credits? They'll be ready shortly, in Settings → Subscriptions → Your purchases. {help}
          </p>
          <p className="text-slate-400 mt-2 text-center max-w-md text-sm">
            Bought something on a site made with Nebulux AI? The site's owner is the seller and will deliver it.
          </p>
        </>
      )}
      {siteHome ? (
        <a
          href={siteHome}
          className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-[#fff] font-medium shadow-lg shadow-emerald-500/30 hover:opacity-90 transition-opacity"
        >
          Back to the site
        </a>
      ) : (
        <Link
          to="/chat"
          className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-[#fff] font-medium shadow-lg shadow-emerald-500/30 hover:opacity-90 transition-opacity"
        >
          Back to Nebulux AI
        </Link>
      )}
    </motion.div>
  );
}