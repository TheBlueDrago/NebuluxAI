import React from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAppShell } from "@/components/AppShellContext";
import ClaudeSidebar from "@/components/ClaudeSidebar";

// The sidebar on the Website Designer, Games and other full-page tools: the same Claude-style
// sidebar as the chat, sliding in from the left over the page (it opens from the page's menu button).
export default function Sidebar() {
  const shell = useAppShell();
  const loc = useLocation();
  const close = () => shell.setSidebarOpen(false);
  return (
    <>
      <motion.div className="fixed inset-0 z-[60] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
      <motion.div className="fixed inset-y-0 left-0 z-[61]" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <ClaudeSidebar shell={shell} mobile onClose={close} path={loc.pathname} />
      </motion.div>
    </>
  );
}
