import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Gamepad2, LayoutTemplate, Mail, MessageCircle, BookOpen, Sparkles } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const LINKS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat with the AI", icon: MessageCircle },
  { to: "/guides", label: "Guides", icon: BookOpen },
  { to: "/arcade", label: "Play games", icon: Gamepad2 },
  { to: "/templates", label: "Website templates", icon: LayoutTemplate },
  { to: "/whats-new", label: "What's new", icon: Sparkles },
  { to: "/contact", label: "Contact us", icon: Mail },
];

// Any address the app doesn't know: say so plainly and offer the main places to go.
export default function PageNotFound() {
  const { pathname } = useLocation();
  // The server answers every address with the app, so tell search engines this one isn't a page.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <PublicLayout title="Page not found">
      <section className="text-center py-20 sm:py-28">
        <p className="text-7xl sm:text-8xl font-bold bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">404</p>
        <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-white">This page doesn't exist</h1>
        <p className="mt-3 text-slate-400 break-all">
          Nothing lives at <span className="text-slate-200">{pathname}</span>. The link may be old or mistyped.
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4 hover:border-indigo-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
              <Icon className="w-6 h-6 text-indigo-300 mx-auto" />
              <span className="mt-2 block text-sm text-white">{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
