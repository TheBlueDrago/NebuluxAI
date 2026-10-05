import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useAppShell } from "@/components/AppShellContext";
import ClaudeSidebar from "@/components/ClaudeSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatBox from "@/components/ChatBox";
import CodePage from "@/components/CodePage";
import PlanNotice from "@/components/chat/PlanNotice";

export function WorkspaceShell() {
  const shell = useAppShell();
  const loc = useLocation();
  const isMobile = useIsMobile();
  const { sidebarOpen, setSidebarOpen } = shell;
  // Laid out like Claude: a full-height sidebar on the left (it folds down to a strip of icons),
  // and the page fills the rest. On phones the sidebar slides over the page from the menu button.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("nx-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("nx-sidebar-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="relative z-10 h-[100dvh] flex nebula-bg">
      {!isMobile && <ClaudeSidebar shell={shell} collapsed={collapsed} onToggle={toggle} path={loc.pathname} />}
      {isMobile && (
        <>
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-30 p-2 rounded-lg text-[var(--cl-muted)] hover:bg-[var(--cl-card)]"
            aria-label="Menu: chats and tools"
          >
            <Menu className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {sidebarOpen && (
              <>
                <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} />
                <motion.div className="fixed inset-y-0 left-0 z-50" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                  <ClaudeSidebar shell={shell} mobile onClose={() => setSidebarOpen(false)} path={loc.pathname} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
      <main className="flex-1 min-w-0 h-full flex flex-col items-center overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function ChatWorkspace() {
  const shell = useAppShell();
  const { conv, credits, effPlan, avatarInitial } = shell;
  return (
    // Stacked: the chat sits in a row next to the sidebar, and the note goes above the chat.
    <div className="w-full h-full flex flex-col items-center">
      <PlanNotice />
      <ChatBox
      claude
      conversation={conv.activeConversation}
      createConversation={conv.createConversation}
      addMessage={conv.addMessage}
      removeMessage={conv.removeMessage}
      renameConversation={conv.renameConversation}
      plan={effPlan}
      exhausted={{ ai: credits.aiExhausted, code: credits.aiCodeExhausted, opus5: credits.galaxy5Exhausted, fable: credits.space5Exhausted }}
      remaining={{ ai: credits.aiRemaining, code: credits.aiCodeRemaining, opus5: credits.galaxy5Remaining, fable: credits.space5Remaining }}
      spend={{ ai: credits.spendAI, code: credits.spendAICode, opus5: credits.spendGalaxy5, fable: credits.spendSpace5 }}
      userInitial={avatarInitial}
      />
    </div>
  );
}

export function CodeWorkspace() {
  const shell = useAppShell();
  // Opened by address without Pro or higher: back to the chat, with the upgrade popup.
  React.useEffect(() => {
    if (shell.codeAllowed === false && shell.credits?.plan) {
      shell.setUpgradeOpen(true);
      shell.navigate("/chat", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell.codeAllowed, shell.credits?.plan]);
  if (shell.codeAllowed === false) return null;
  const { credits, avatarInitial } = shell;
  return <CodePage userInitial={avatarInitial} />;
}