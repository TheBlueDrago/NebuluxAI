import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Mail, Phone } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import BlackholeIcon from "@/components/BlackholeIcon";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_LINK } from "@/lib/company";

export const START_FREE = "/register?returnTo=" + encodeURIComponent("/chat");
const LOGIN = "/login?returnTo=" + encodeURIComponent("/chat");

const LINKS = [
  { to: "/arcade", label: "Arcade" },
  { to: "/templates", label: "Templates" },
  { to: "/guides", label: "Guides" },
  { to: "/pricing", label: "Pricing" },
  { to: "/business", label: "For business" },
  { to: "/about", label: "About us" },
];

const FOOTER = [
  {
    title: "Make",
    links: [
      ["/templates", "Website templates"],
      ["/arcade", "Games"],
      ["/showcase", "Gallery"],
      ["/pricing", "Pricing"],
    ],
  },
  {
    title: "Company",
    links: [
      ["/about", "About us"],
      ["/contact", "Contact us"],
      ["/business", "For business"],
      ["/enterprise", "Enterprise"],
      ["/contact?topic=partnership", "Partners & investors"],
    ],
  },
  {
    title: "Help & legal",
    links: [
      ["/guides", "Guides"],
      ["/ideas", "Things to ask AI"],
      ["/whats-new", "What's new"],
      ["/#faq", "Questions"],
      ["/safety", "Trust & safety"],
      ["/report", "Report a page"],
      ["/terms", "Terms"],
      ["/privacy", "Privacy"],
      ["/status", "Status"],
    ],
  },
];

// Header, footer and background shared by the public pages (welcome, arcade, templates,
// pricing, gallery, business, about, contact), so visitors can move between them and
// always find "Get started for free".
export default function PublicLayout({ title, children }) {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  // The public pages are always dark. The app's light mode puts a "light" class on <html>
  // that flips the whole palette; it can still be there after leaving the app for a page
  // like About us, so set it aside while one of these pages is showing.
  useEffect(() => {
    const el = document.documentElement;
    const wasLight = el.classList.contains("light");
    el.classList.remove("light");
    return () => {
      if (wasLight) el.classList.add("light");
    };
  }, []);

  useEffect(() => {
    if (!title) return;
    document.title = `${title} · Nebulux AI`;
    return () => {
      document.title = "Nebulux AI";
    };
  }, [title]);

  const navLink = ({ isActive }) => `whitespace-nowrap hover:text-white ${isActive ? "text-white" : "text-slate-400"}`;
  const cta = isAuthenticated ? (
    <Link to="/chat" className="px-4 py-2 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200">Open app</Link>
  ) : (
    <Link to={START_FREE} className="px-4 py-2 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200 whitespace-nowrap">
      Get started for free
    </Link>
  );

  return (
    // overflow-x-clip (not hidden): nothing can be scrolled sideways, and the sticky header keeps working.
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#000000] text-slate-100 overflow-x-clip relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[100px]" />
      </div>

      {/* For keyboard users: jump past the menu to the page itself. Hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-indigo-600 focus:text-[#fff] focus:font-medium"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-[#020617]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight shrink-0">
            <span className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
              <BlackholeIcon className="w-full h-full" />
            </span>
            Nebulux AI
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={navLink}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2 text-sm">
            {!isAuthenticated && <Link to={LOGIN} className="px-3 py-2 text-slate-300 hover:text-white">Log in</Link>}
            {cta}
          </div>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden p-2 -mr-2 rounded-lg text-slate-200 hover:bg-white/10"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-white/5 bg-[#020617]/95 px-4 pb-6">
            <nav className="flex flex-col py-2">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => `py-3 text-lg border-b border-white/5 ${isActive ? "text-white" : "text-slate-300"}`}>
                  {l.label}
                </NavLink>
              ))}
              <NavLink to="/contact" className="py-3 text-lg text-slate-300">Contact us</NavLink>
            </nav>
            <div className="flex flex-col gap-3 mt-2">
              {isAuthenticated ? (
                <Link to="/chat" className="py-3 rounded-full bg-white text-slate-900 font-semibold text-center">Open app</Link>
              ) : (
                <>
                  <Link to={START_FREE} className="py-3 rounded-full bg-white text-slate-900 font-semibold text-center">Get started for free</Link>
                  <Link to={LOGIN} className="py-3 rounded-full border border-slate-600 text-slate-200 font-semibold text-center">Log in</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" tabIndex={-1} className="relative z-10 max-w-6xl mx-auto px-4 pb-16 outline-none">{children}</main>

      <footer className="relative z-10 border-t border-slate-800/80 bg-black/30">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="font-semibold text-white">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map(([to, label]) => (
                  <li key={to}>
                    <Link to={to} className="text-slate-400 hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 md:col-span-1">
            <p className="font-semibold text-white">Contact us</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2 text-slate-400 hover:text-white break-all">
                  <Mail className="w-4 h-4 shrink-0" /> {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={CONTACT_PHONE_LINK} className="inline-flex items-center gap-2 text-slate-400 hover:text-white">
                  <Phone className="w-4 h-4 shrink-0" /> {CONTACT_PHONE}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <BlackholeIcon className="w-4 h-4" /> © {new Date().getFullYear()} Nebulux AI
          </span>
          <span>Made for creators, students and small businesses.</span>
        </div>
      </footer>
    </div>
  );
}
