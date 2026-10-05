import React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAppShell } from "@/components/AppShellContext";
import ClaudeSidebar from "@/components/ClaudeSidebar";

// The sidebar sliding in over the page (phones, and the Website Designer, Games and other full-page
// tools): the same Claude-style sidebar as the chat, with a dark shade behind it. Tapping the shade,
// the X, or any link closes it. Rendered straight into the page body, so nothing around it can trap
// it or keep it from closing.
export default function Sidebar() {
  const shell = useAppShell();
  const loc = useLocation();
  const close = () => shell.setSidebarOpen(false);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <motion.div key="nx-shade" className="fixed inset-0 z-[60] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={close} aria-hidden="true" />
      <motion.div key="nx-drawer" className="fixed inset-y-0 left-0 z-[61] max-w-[88vw]" initial={{ x: -300 }} animate={{ x: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <ClaudeSidebar shell={shell} mobile onClose={close} path={loc.pathname} />
      </motion.div>
    </>,
    document.body
  );
}
