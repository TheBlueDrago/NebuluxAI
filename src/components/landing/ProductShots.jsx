import React from "react";
import { ShieldCheck, Check, Flag, Sparkles, ShoppingBag, Users, Building2, BadgeCheck } from "lucide-react";
import SiteThumb from "@/components/SiteThumb";
import BlackholeIcon from "@/components/BlackholeIcon";
import { SITE_TEMPLATES } from "@/lib/siteTemplates";

// Pictures for the public pages, drawn from the product itself (a real template rendered
// in a browser window, the chat, a game on a phone) so they load instantly and stay sharp.

const template = (id) => (SITE_TEMPLATES.find((t) => t.id === id) || SITE_TEMPLATES[0]).html;

export function BrowserFrame({ address, children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-slate-900 border border-slate-700/70 shadow-2xl shadow-indigo-950/60 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="flex-1 min-w-0 truncate text-center text-[11px] text-slate-400 bg-slate-900/80 rounded-md px-2 py-0.5">{address}</span>
      </div>
      {children}
    </div>
  );
}

export function SiteShot({ id = "restaurant", address = "olive-and-ember.nebuluxai.com", className = "" }) {
  return (
    <BrowserFrame address={address} className={className}>
      <div className="relative aspect-[16/10] bg-white">
        <SiteThumb html={template(id)} />
      </div>
    </BrowserFrame>
  );
}

function Bubble({ me, children }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-[13px] leading-snug ${
          me ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatShot({ className = "" }) {
  return (
    <div className={`rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl shadow-indigo-950/60 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <span className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
          <BlackholeIcon className="w-full h-full" />
        </span>
        <span className="text-sm font-semibold text-white">Nebulux AI</span>
        <span className="ml-auto text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">online</span>
      </div>
      <Bubble me>Can you explain photosynthesis simply?</Bubble>
      <Bubble>
        Plants make their own food from sunlight 🌞. Their leaves take in light, water and air, and turn them into sugar, and they breathe out the
        oxygen we need.
      </Bubble>
      <Bubble me>Now make me a quiz about it!</Bubble>
      <Bubble>
        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-300" /> Here's a 5-question quiz…</span>
      </Bubble>
    </div>
  );
}

// A little neon jump game on a phone.
export function GameShot({ className = "" }) {
  return (
    <div className={`mx-auto w-[220px] rounded-[2.2rem] bg-slate-950 border-[6px] border-slate-700 shadow-2xl shadow-fuchsia-950/50 overflow-hidden ${className}`}>
      <div className="h-5 flex justify-center items-center">
        <span className="w-16 h-1.5 rounded-full bg-slate-700" />
      </div>
      <svg viewBox="0 0 200 330" className="block w-full" role="img" aria-label="A neon jumping game on a phone">
        <defs>
          <linearGradient id="gs-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05060f" />
            <stop offset="1" stopColor="#111633" />
          </linearGradient>
          <linearGradient id="gs-cube" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="1" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <rect width="200" height="330" fill="url(#gs-bg)" />
        {[20, 60, 100, 140, 180].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="330" stroke="#94a3b8" strokeOpacity=".07" />
        ))}
        {[[30, 40], [150, 70], [90, 25], [170, 140], [40, 120]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#c7d2fe" opacity=".7" />
        ))}
        <text x="14" y="30" fill="#a5b4fc" fontSize="11" fontWeight="700" fontFamily="system-ui">Ignition</text>
        <text x="186" y="30" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="system-ui">Attempt 3</text>
        <rect x="0" y="6" width="200" height="3" fill="#ffffff" opacity=".08" />
        <rect x="0" y="6" width="120" height="3" fill="#f472b6" />
        <line x1="0" y1="250" x2="200" y2="250" stroke="#818cf8" strokeWidth="3" />
        <line x1="0" y1="250" x2="200" y2="250" stroke="#818cf8" strokeWidth="8" opacity=".25" />
        <path d="M112 250 L124 226 L136 250 Z M136 250 L148 226 L160 250 Z" fill="#fb7185" />
        <rect x="170" y="140" width="5" height="115" rx="2" fill="#22d3ee" opacity=".9" />
        <g transform="rotate(20 70 200)">
          <rect x="56" y="186" width="28" height="28" rx="4" fill="url(#gs-cube)" />
        </g>
        <path d="M40 232 q15 -40 30 -32" stroke="#f472b6" strokeOpacity=".5" strokeWidth="2" fill="none" strokeDasharray="3 4" />
        <text x="100" y="300" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="system-ui">Tap to jump</text>
      </svg>
    </div>
  );
}

export function ShopShot({ className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <div className="rounded-2xl bg-white text-slate-900 shadow-2xl shadow-indigo-950/60 p-4 w-full max-w-xs mx-auto">
        <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200 flex items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-orange-500" />
        </div>
        <p className="mt-3 font-semibold">Handmade candle</p>
        <p className="text-sm text-slate-500">Vanilla &amp; cedar, 8 oz</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold">$14.00</span>
          <span className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Buy now</span>
        </div>
      </div>
      <div className="absolute -bottom-4 -right-2 sm:right-4 flex items-center gap-2 rounded-xl bg-slate-900 border border-emerald-400/40 px-3 py-2 shadow-xl">
        <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></span>
        <span className="text-xs text-slate-100">New order · $14.00</span>
      </div>
    </div>
  );
}

export function TeamShot({ className = "" }) {
  const people = [
    ["M", "from-sky-500 to-indigo-500", "Maya", "Editing the menu page"],
    ["J", "from-fuchsia-500 to-rose-500", "Jordan", "Adding photos"],
    ["S", "from-emerald-500 to-teal-500", "Sam", "Writing the About page"],
  ];
  return (
    <div className={`rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl shadow-indigo-950/60 p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-sky-300" />
        <span className="text-sm font-semibold text-white">Team · Café website</span>
      </div>
      <div className="mt-4 space-y-3">
        {people.map(([initial, color, name, doing]) => (
          <div key={name} className="flex items-center gap-3">
            <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-sm font-bold text-white`}>{initial}</span>
            <span className="min-w-0">
              <span className="block text-sm text-slate-100">{name}</span>
              <span className="block text-xs text-slate-500 truncate">{doing}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Shared credits</span>
          <span>112 / 150 left</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full w-3/4 bg-gradient-to-r from-sky-400 to-indigo-500" />
        </div>
      </div>
    </div>
  );
}

export function EnterpriseShot({ className = "" }) {
  const seats = [
    ["A", "from-violet-500 to-indigo-500"],
    ["B", "from-sky-500 to-cyan-500"],
    ["C", "from-fuchsia-500 to-rose-500"],
    ["D", "from-emerald-500 to-teal-500"],
    ["E", "from-amber-500 to-orange-500"],
    ["F", "from-indigo-500 to-sky-500"],
  ];
  return (
    <div className={`rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl shadow-indigo-950/60 p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/40 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-violet-300" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            Northside Dental LLC <BadgeCheck className="w-4 h-4 text-sky-400" />
          </span>
          <span className="block text-xs text-slate-500">Verified organization · 24 seats · shared credits</span>
        </span>
      </div>
      <div className="mt-4 flex -space-x-2">
        {seats.map(([l, c]) => (
          <span key={l} className={`w-9 h-9 rounded-full ring-2 ring-slate-900 bg-gradient-to-br ${c} flex items-center justify-center text-xs font-bold text-white`}>{l}</span>
        ))}
        <span className="w-9 h-9 rounded-full ring-2 ring-slate-900 bg-slate-700 flex items-center justify-center text-[11px] font-semibold text-slate-200">+18</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {[["Nebulux AI", "100"], ["Galaxy", "75"], ["Space", "50"], ["Nebula", "25"]].map(([n, v]) => (
          <span key={n} className="rounded-lg bg-slate-800/70 border border-slate-700/50 px-3 py-2 text-slate-400">
            {n} <b className="block text-white text-sm">{v} / seat</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SafetyShot({ className = "" }) {
  const checks = ["No adult content", "No scams or fake login forms", "No harmful code", "Emails kept private"];
  return (
    <div className={`rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl shadow-indigo-950/60 p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-emerald-300" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Safety check passed</span>
          <span className="block text-xs text-slate-500">Checked before it went live</span>
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {checks.map((c) => (
          <li key={c} className="flex items-center gap-2 text-sm text-slate-200">
            <Check className="w-4 h-4 text-emerald-400" /> {c}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <Flag className="w-3.5 h-3.5" /> Every page has a Report button
      </p>
    </div>
  );
}

// The hero picture: a real template in a browser, with the chat and a game floating over it.
export function HeroCollage() {
  return (
    <div className="relative mx-auto max-w-2xl pb-10 sm:pb-16">
      <SiteShot id="landing" address="my-startup.nebuluxai.com" />
      <div className="absolute -left-3 sm:-left-10 -bottom-2 sm:bottom-0 w-[58%] sm:w-[46%] rounded-2xl bg-slate-900/95 border border-slate-700/70 shadow-2xl p-3 space-y-2">
        <Bubble me>Make a landing page for my app, with pricing</Bubble>
        <Bubble>Done! It's live. Want a darker theme?</Bubble>
      </div>
      <div className="hidden sm:block absolute -right-8 -bottom-6 w-[150px]">
        <GameShot className="!w-[150px] !border-4 !rounded-[1.6rem]" />
      </div>
    </div>
  );
}
