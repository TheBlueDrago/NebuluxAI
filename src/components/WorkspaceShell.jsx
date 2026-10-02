import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAppShell } from "@/components/AppShellContext";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import ChatBox from "@/components/ChatBox";
import CodePage from "@/components/CodePage";
import PlanNotice from "@/components/chat/PlanNotice";

export function WorkspaceShell() {
  const shell = useAppShell();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen, lightMode, toggleLight, avatarInitial, openProfile, conv, credits, isAdmin } = shell;

  return (
    <motion.div
      className="relative z-10 min-h-screen flex flex-col items-center justify-center pt-4 sm:pt-10 pb-24 sm:pb-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      <button
        onClick={() => setSidebarOpen((o) => !o)}
        className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 sm:top-5 sm:left-5 z-30 p-2 sm:p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50 text-slate-200 hover:bg-slate-700/70 transition-colors"
        title="Menu"
        aria-label="Menu: chats and tools"
        aria-expanded={sidebarOpen}
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <div className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 sm:top-5 sm:right-5 z-30 flex items-center gap-2">
        <ThemeToggle light={lightMode} onToggle={toggleLight} />
        <button
          onClick={() => openProfile("main")}
          className="keep-color w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/20"
          title="Profile"
          aria-label="Your profile and settings"
        >
          {avatarInitial}
        </button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sm:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center w-full min-h-[60vh] sm:min-h-[524px]">
        <AnimatePresence>
          {sidebarOpen && (
            <Sidebar
              conversations={conv.conversations}
              activeId={conv.activeId}
              onSelect={(id) => { conv.selectConversation(id); navigate("/chat"); }}
              onRename={conv.renameConversation}
              onDelete={conv.deleteConversation}
              onRefresh={conv.reload}
              onGoHome={shell.goHome}
              onGoCode={shell.goCode}
              onNewChat={shell.newChat}
              onGoSubscriptions={shell.goPlans}
              onGoDesigner={shell.goDesigner}
              onGoGames={shell.goGames}
              onGoMonitor={shell.goMonitor}
              isAdmin={isAdmin}
              credits={credits}
              gapAfter={20}
            />
          )}
        </AnimatePresence>
        <Outlet />
      </div>
    </motion.div>
  );
}

export function ChatWorkspace() {
  const shell = useAppShell();
  const { conv, credits, effPlan, avatarInitial } = shell;
  return (
    // Stacked: the chat sits in a row next to the sidebar, and the note goes above the chat.
    <div className="w-full max-w-3xl flex flex-col items-center">
      <PlanNotice />
      <ChatBox
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
  const { credits, avatarInitial } = shell;
  return <CodePage aiCodeExhausted={credits.aiCodeExhausted} aiCodeRemaining={credits.aiCodeRemaining} onSpendAICode={credits.spendAICode} userInitial={avatarInitial} />;
}