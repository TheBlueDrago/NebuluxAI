import React, { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import BlackholeIcon from "@/components/BlackholeIcon";

// Sign-up, password reset and similar pages. Always dark and branded like the login page
// and the public pages (the "dark" class switches the form components to their dark colors).
export default function AuthLayout({ title, subtitle, footer, children }) {
  // Light-mode devices get a "light" class on the page for the app (index.html, src/lib/theme.js).
  // These screens are always dark, so it comes off while one is showing (e.g. /chat when signed out).
  useLayoutEffect(() => {
    const root = document.documentElement, bg = document.body.style.background;
    if (!root.classList.contains("light")) return;
    root.classList.remove("light");
    document.body.style.background = "#020617";
    return () => {
      root.classList.add("light");
      document.body.style.background = bg;
    };
  }, []);
  return (
    <div className="dark min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center px-4 py-10 relative overflow-hidden text-foreground">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex w-14 h-14 rounded-2xl overflow-hidden items-center justify-center shadow-lg shadow-indigo-500/30 mb-4"
            aria-label="Nebulux AI home"
          >
            <BlackholeIcon className="w-full h-full" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 p-8">{children}</div>
        {footer && <p className="text-center text-sm text-slate-400 mt-6">{footer}</p>}
      </div>
    </div>
  );
}
