import React from "react";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import MotionPrefs from "@/components/MotionPrefs";

const AI_LABELS = { ai: "Nebulux AI", aiCode: "Galaxy", galaxy5: "Space", space5: "Nebula" };

export default function PromoSuccessPage() {
  return (
    <MotionPrefs>
      <PromoSuccess />
    </MotionPrefs>
  );
}

function PromoSuccess() {
  const location = useLocation();
  const aiModel = location.state?.aiModel ?? "ai";
  const credits = location.state?.credits ?? 0;
  const label = AI_LABELS[aiModel] ?? "Nebulux AI";
  // Opened directly (not right after redeeming a code): there's nothing to celebrate, so
  // don't show "+0 credits".
  if (!(credits > 0)) return <Navigate to="/chat" replace />;

  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: "easeInOut" } }}
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
        <Gift className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold text-white text-center">Credits added!</h1>
      <p className="text-slate-300 mt-3 text-center max-w-md">
        You got <span className="text-emerald-300 font-semibold">+{credits} {label}</span> credits. They're
        added to your balance and stay until you use them.
      </p>
      <Link
        to="/chat"
        className="mt-8 inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-[#fff] font-medium shadow-lg shadow-emerald-500/30 hover:opacity-90 transition-opacity"
      >
        Start chatting
      </Link>
    </motion.div>
  );
}