import React from "react";
import { AnimatePresence } from "framer-motion";
import { useAppShell } from "@/components/AppShellContext";
import Sidebar from "@/components/Sidebar";
import WebsiteDesigner from "@/components/WebsiteDesigner";

export default function DesignerWorkspace() {
  const shell = useAppShell();
  const { sidebarOpen, setSidebarOpen, openProfile, conv, credits, lightMode, toggleLight, effPlan, isAdmin } = shell;

  return (
    <div className="relative z-10 h-screen pb-14 sm:pb-0">
      {sidebarOpen && <Sidebar />}
      <WebsiteDesigner
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onOpenProfile={() => openProfile("main")}
        onUpgrade={() => shell.navigate("/chat/shop")}
        lightMode={lightMode}
        onToggleLight={toggleLight}
        plan={effPlan}
        aiExhausted={credits.aiExhausted}
        aiCodeExhausted={credits.aiCodeExhausted}
        onSpendAI={credits.spendAI}
        onSpendAICode={credits.spendAICode}
        galaxy5Exhausted={credits.galaxy5Exhausted}
        onSpendGalaxy5={credits.spendGalaxy5}
        space5Exhausted={credits.space5Exhausted}
        onSpendSpace5={credits.spendSpace5}
        remaining={{ ai: credits.aiRemaining, code: credits.aiCodeRemaining, opus5: credits.galaxy5Remaining, fable: credits.space5Remaining }}
      />
    </div>
  );
}