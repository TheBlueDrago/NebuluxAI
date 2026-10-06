import React from "react";
import { MotionConfig } from "framer-motion";

// framer-motion animations follow the device's "reduce motion" setting: things appear without
// sliding or zooming (fades stay). Wraps the pages that use framer-motion; it's kept out of
// App.jsx so the library stays out of the first download (see src/index.css for the CSS ones).
export default function MotionPrefs({ children }) {
  return <MotionConfig reducedMotion={typeof document !== "undefined" && document.documentElement.classList.contains("reduce-motion") ? "always" : "user"}>{children}</MotionConfig>;
}
