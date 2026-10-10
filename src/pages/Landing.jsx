import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Smartphone, Globe, ShieldCheck, Gamepad2, Play, Check, ChevronDown, Mail, Phone, MessageCircle, GraduationCap, PenLine, Code2, Image, Mic, UserRoundPen, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SiteThumb from "@/components/SiteThumb";
import PublicLayout, { START_FREE } from "@/components/PublicLayout";
import PricingCards from "@/components/landing/PricingCards";
import { HeroCollage, ChatShot, SiteShot, GameShot, ShopShot, TeamShot, SafetyShot, EnterpriseShot } from "@/components/landing/ProductShots";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_LINK } from "@/lib/company";
import { siteUrl } from "@/lib/blackholeDomain";
import { SITE_TEMPLATES } from "@/lib/siteTemplates";
import Starfield from "@/components/landing/Starfield";
import "./landing-lux.css";

const HOME_TEMPLATES = ["business", "event", "restaurant", "resume"].map((id) => SITE_TEMPLATES.find((t) => t.id === id)).filter(Boolean);

const FACTS = [
  { icon: Sparkles, title: "No coding", text: "Just describe it" },
  { icon: Smartphone, title: "Phone or computer", text: "Works everywhere" },
  { icon: Globe, title: "Free web address", text: "Your own link to share" },
  { icon: ShieldCheck, title: "Safety checked", text: "Before anything goes live" },
];

// What the AI itself does (all real features of the chat and Code pages).
const AI_SKILLS = [
  { icon: MessageCircle, title: "Ask anything", text: "Clear answers in seconds, in your own words, about any topic." },
  { icon: GraduationCap, title: "Homework help", text: "Explains things simply and makes quizzes. Study mode guides you step by step so you really learn it." },
  { icon: PenLine, title: "Writing", text: "Stories, essays, emails and posts: drafts it, fixes it, makes it shorter." },
  { icon: Code2, title: "Code", text: "Nebulux Code writes, explains and fixes code in any language." },
  { icon: Image, title: "Pictures", text: "Send up to 3 photos or screenshots and ask about them." },
  { icon: Mic, title: "Talk to it", text: "Tap the microphone and ask out loud, and it answers out loud too." },
  { icon: UserRoundPen, title: "Knows you", text: "Tell it about yourself once and every answer fits you, from your grade to how short you like replies." },
  { icon: Layers, title: "Four AI models", text: "Nebulux AI for everyday help, plus Galaxy, Space and Nebula on Pro." },
];

const FEATURES = [
  {
    eyebrow: "Chat",
    title: "Ask anything. Get real help.",
    text: "Homework, ideas, writing or code: ask in your own words and get a clear answer in seconds.",
    bullets: ["Explains things simply", "Writes, summarizes and makes quizzes", "Send a picture and ask about it"],
    cta: { to: START_FREE, label: "Start chatting" },
    Picture: ChatShot,
  },
  {
    eyebrow: "Websites",
    title: "Describe your website. It's live in minutes.",
    text: "Say what your site is for. The AI writes the pages and the design, and changes anything you ask. Publish it free at yourname.nebuluxai.com.",
    bullets: ["Free templates to start from", "Edit by chatting or by hand", "Messages from your site's forms come straight to you", "Keep your code: ZIP download, or open and push your GitHub repos, on Pro"],
    cta: { to: "/templates", label: "Browse templates" },
    Picture: SiteShot,
  },
  {
    eyebrow: "Games",
    title: "Make a game. Send it to your friends.",
    text: "Describe a game and play it right away. Change the levels, speed or look by chatting, then share the link. Friends play on any phone or computer, no account needed.",
    bullets: ["Touch controls on phones", "Links open straight into the game", "Remix the built-in games"],
    cta: { to: "/arcade", label: "Play in the Arcade" },
    Picture: GameShot,
  },
  {
    eyebrow: "Sell",
    title: "Sell from your own site.",
    text: "Add Buy buttons for your products and get paid, minus a small 5% fee. Payments are being upgraded right now; ask us for early access.",
    bullets: ["Buyers pay on a secure checkout page", "Buyers can't change your prices", "You see every order"],
    cta: { to: "/contact?topic=business", label: "Ask about selling" },
    Picture: ShopShot,
  },
  {
    eyebrow: "Teams",
    title: "Build it together.",
    text: "The Team plan puts up to 3 people on one plan, sharing one pool of AI credits.",
    bullets: ["Invite by email", "Everyone builds with the same credits", "$20 a month for the whole team"],
    cta: { to: "/pricing", label: "See pricing" },
    Picture: TeamShot,
  },
  {
    eyebrow: "Enterprise",
    title: "Bring your whole organization.",
    text: "For registered businesses and organizations: a seat for everyone and one shared pool of credits that grows with every seat. The price depends on how many people you have.",
    bullets: ["Verified organizations only (LLC, corporation, nonprofit…)", "Each seat adds 100 AI, 75 Galaxy, 50 Space and 25 Nebula credits a month to the shared pool", "Add and remove people yourself"],
    cta: { to: "/enterprise", label: "Apply for Enterprise" },
    Picture: EnterpriseShot,
  },
];

// Why here and not another site or building it yourself: every point is a real feature.
const WHY = [
  { icon: Layers, title: "Everything in one place", text: "Other sites do one thing. Here the same AI answers questions, helps with homework, writes, codes, and builds websites and games." },
  { icon: Code2, title: "No coding, no hosting bills", text: "Describe a website or game and it's live in minutes at its own free web address. Building it yourself takes months and costs money." },
  { icon: GraduationCap, title: "Made for learning", text: "Study mode tutors you step by step, math shows like a textbook, and it makes quizzes and reads answers aloud." },
  { icon: ShieldCheck, title: "Safe for kids", text: "Every website and game is checked before it goes live, scams and adult content are blocked, and every page has a Report button." },
  { icon: Sparkles, title: "Free to start, cheap after", text: "The Free plan gives you credits for all 4 AIs every month, 3 websites and unlimited games. Paid plans are coming soon." },
  { icon: Globe, title: "Always getting better", text: "New features almost every week, many from ideas people send us. See What's new." },
];

const STEPS = [
  ["Ask or describe", "Type or say what you need: a question, homework, an essay, some code, or the website or game you want."],
  ["Get it in seconds", "A clear answer you can ask more about, or a working first version of your site or game to try right away."],
  ["Make it yours", "Ask follow-ups or changes until it's right, then keep it, copy it, or publish what you made with a link."],
];

// Built-in games (src/lib/builtInGames.js), listed by name so their code isn't loaded here.
const GAMES = [
  { name: "pulse", title: "Pulse Jump", text: "Jump and fly through 7 neon levels.", color: "from-indigo-500 to-fuchsia-500" },
  { name: "veck", title: "Veck", text: "Fight waves of bots in a zero-gravity arena.", color: "from-fuchsia-500 to-rose-500" },
];

const FAQ = [
  ["Why use Nebulux AI instead of another site?", "Because it does everything in one place: the same AI helps with questions, homework, writing and code, and builds real websites and games for you, with no coding and no hosting bills. It's made for learning (Study mode, quizzes, math that looks like a textbook), everything published is safety-checked, and it's free to start."],
  ["What can the AI help me with?", "Almost anything you'd ask a smart friend: homework explained step by step, practice quizzes, essays, emails and stories, code, questions about a photo you send, and building websites and games. You can type or just talk to it.", ["/guides", "See the guides"]],
  ["Can I use it for school?", "Yes. It's built to help you understand, not just hand you answers: ask it to explain step by step or quiz you. Always follow your teacher's rules about AI.", ["/guides/ai-homework-help", "Using AI for homework the right way"]],
  ["Is Nebulux AI free?", "Yes. The Free plan gives you 100 Nebulux AI, 75 Galaxy, 50 Space and 25 Nebula credits every month, 3 websites and unlimited games. Paid plans (Pro $15 a month and Team $20 a month) are coming soon in a later update."],
  ["Do I need to know how to code?", "No. You describe what you want in your own words. If you do know code, you can edit it by hand, and on Pro you can download it or push it to GitHub."],
  ["Does it work on my phone?", "Yes. Everything works on phones, tablets and computers, and you can install it like an app from your profile."],
  ["What are credits?", "Credits are what the AI uses up when it works for you. Bigger jobs use more. Your plan gives you a fresh allowance every month."],
  ["Is it safe for kids?", "Every site and game is checked before it's published: adult content, scams, fake login forms and harmful code are blocked. Anyone can report a page, and makers' emails are never shown.", ["/safety#parents", "For parents and teachers"]],
  ["Is paying safe?", "Yes. You pay on our payment provider's secure checkout page, so we never see or store your card number, and prices are set on our server. Plans are monthly and credit packs are one-time. See Trust & safety for more.", ["/safety", "Trust & safety"]],
  ["Can I take my site down?", "Yes. You can unpublish or delete your websites and games at any time from your profile."],
];

// "Made with Nebulux AI" badges link here with ?from=site:<name> or game:<name>.
function cameFrom() {
  const m = /^(site|game):([a-z0-9.-]{1,63})$/.exec(new URLSearchParams(window.location.search).get("from") || "");
  return m ? { kind: m[1], name: m[2] } : null;
}

// Fades a section in as it scrolls into view (CSS .bh-reveal in index.css; no animation
// library, so the home page loads faster). Without IntersectionObserver it's just shown.
function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (shown || !ref.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return (
    <div ref={ref} className={`bh-reveal${shown ? " bh-shown" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

function Question({ q, children }) {
  return (
    <details className="group py-4">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-lg font-medium text-white">
        {q}
        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 text-slate-400">{children}</div>
    </details>
  );
}

function FeatureRow({ eyebrow, title, text, bullets, cta, Picture, flip }) {
  return (
    <Reveal className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
      <div className={flip ? "md:order-2" : ""}>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">{eyebrow}</p>
        <h3 className="mt-2 text-2xl sm:text-4xl font-bold text-white leading-tight">{title}</h3>
        <p className="mt-4 text-slate-400 text-base sm:text-lg">{text}</p>
        <ul className="mt-5 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-slate-200">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" /> {b}
            </li>
          ))}
        </ul>
        <Link to={cta.to} className="mt-6 inline-flex items-center gap-2 py-2 -my-2 text-indigo-300 font-semibold hover:text-indigo-200">
          {cta.label} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className={`px-2 ${flip ? "md:order-1" : ""}`}>
        <Picture />
      </div>
    </Reveal>
  );
}

// What visitors see first: a long page explaining what Nebulux AI does, with pictures,
// prices, answers and "Get started for free" all the way down.
function PhoneCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight * 0.8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <Link
      to={START_FREE}
      className={`sm:hidden fixed left-4 right-4 bottom-4 z-40 rounded-2xl bg-white py-4 text-center font-bold text-slate-900 shadow-[0_14px_40px_-10px_rgba(190,140,255,.9)] transition-transform duration-300 ${show ? "translate-y-0" : "translate-y-[140%]"}`}
    >
      Get started for free →
    </Link>
  );
}

export default function Landing() {
  const [from] = useState(cameFrom);
  const [sites, setSites] = useState([]);

  useEffect(() => {
    base44.functions
      .invoke("showcase", { action: "list" })
      .then((r) => setSites((r.data?.sites || []).slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <PublicLayout title="Your AI for answers, writing, code and more">
      <Starfield />
      <div className="nx-lux" onPointerMove={(e) => { const c = e.target.closest?.("[class*='rounded-2xl'][class*='border'],[class*='rounded-3xl'][class*='border']"); if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); } }}>
      {/* Hero */}
      <section className="grid lg:grid-cols-2 gap-12 items-center pt-10 sm:pt-16 pb-12">
        <div
          className="bh-up text-center lg:text-left"
        >
          {from && (
            <p className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {from.kind === "game" ? "The game" : "The site"} &ldquo;{from.name}&rdquo; was made with Nebulux AI
            </p>
          )}
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="bg-gradient-to-r from-[#ffffff] via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
              Your AI for answers, writing, code and more
            </span>
          </h1>
          <p className="mt-5 text-slate-400 text-lg max-w-xl mx-auto lg:mx-0">
            Ask Nebulux AI anything, send it a picture or just talk to it. And when you want to make something, it builds websites and games for you too. Free to start.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
            <Link
              to={START_FREE}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-lg font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90"
            >
              {from ? "Make your own for free" : "Get started for free"} <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#how"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-6 py-3.5 rounded-full border border-slate-600 text-slate-200 font-medium hover:bg-white/5"
            >
              See how it works <ChevronDown className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">Free: all 4 AIs, 3 websites, unlimited games · No credit card needed</p>
        </div>
        <div className="bh-up-late">
          <HeroCollage />
        </div>
      </section>

      {/* Quick facts */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FACTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl bg-slate-900/50 border border-slate-800 p-4 flex items-center gap-3">
            <Icon className="w-6 h-6 text-indigo-300 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{title}</span>
              <span className="block text-xs text-slate-400 break-words">{text}</span>
            </span>
          </div>
        ))}
      </section>

      {/* The 36-second ad: answers, websites, an app, Bedwars, Nebulux Code. Loads only when played. */}
      <section className="mt-20 sm:mt-24" aria-labelledby="nx-demo">
        <div className="text-center mb-6">
          <h2 id="nx-demo" className="text-3xl sm:text-5xl font-bold text-white">See it in action</h2>
          <p className="mt-3 text-slate-400">36 seconds: answers, websites, apps and games, all made with Nebulux AI.</p>
        </div>
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-indigo-500/10 bg-black">
          <video src="/nebulux-ad.mp4" poster="/nebulux-ad-poster.jpg" controls playsInline preload="none" className="w-full aspect-video block" aria-label="Nebulux AI video" />
        </div>
      </section>

      {/* The AI itself */}
      <section className="mt-24 sm:mt-32">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">Meet your AI</h2>
          <p className="mt-4 text-slate-400 text-lg">One helper for school, work and everything you're curious about.</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AI_SKILLS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-slate-900/50 border border-slate-800 p-5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/25 border border-indigo-400/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-indigo-200" />
              </span>
              <p className="mt-3 font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            to={START_FREE}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold hover:opacity-90"
          >
            Start chatting free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/ideas" className="ml-4 inline-flex items-center gap-1 text-sm text-indigo-300 hover:text-indigo-200">
            Things to ask it <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* What it can do */}
      <section className="mt-24 sm:mt-32">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">One place to make anything</h2>
          <p className="mt-4 text-slate-400 text-lg">Chat, websites, games, shops, teams and whole organizations, all with the same AI helper.</p>
        </Reveal>
        <div className="mt-16 space-y-24 sm:space-y-32">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.eyebrow} {...f} flip={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* Why Nebulux AI */}
      <section id="why" className="mt-28 sm:mt-36 scroll-mt-24">
        <Reveal className="text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">Why Nebulux AI?</h2>
          <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto">Why use it instead of another AI site, or building everything yourself.</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {WHY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
              <span className="keep-color w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </span>
              <p className="mt-4 text-lg font-semibold text-white">{title}</p>
              <p className="mt-1 text-slate-400">{title === "Always getting better" ? <>New features almost every week, many from ideas people send us. See <Link to="/whats-new" className="text-indigo-300 underline hover:text-indigo-200">What's new</Link>.</> : text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mt-28 sm:mt-36 scroll-mt-24">
        <Reveal className="text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">How it works</h2>
          <p className="mt-4 text-slate-400 text-lg">Three steps, no experience needed.</p>
        </Reveal>
        <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white font-bold flex items-center justify-center">{i + 1}</span>
              <p className="mt-4 text-lg font-semibold text-white">{title}</p>
              <p className="mt-1 text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Play now */}
      <section className="mt-28 sm:mt-36">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Play one now</h2>
            <p className="mt-2 text-slate-400">Games made with Nebulux AI. No account needed.</p>
          </div>
          <Link to="/arcade" className="shrink-0 text-sm text-indigo-300 hover:text-indigo-200">All games</Link>
        </div>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {GAMES.map((g) => (
            <Link
              key={g.name}
              to={`/play/${g.name}`}
              className="group flex items-center gap-4 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-4 hover:border-fuchsia-500/50 transition-colors"
            >
              <span className={`shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center`}>
                <Gamepad2 className="w-7 h-7 text-white" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-white">{g.title}</span>
                <span className="block text-sm text-slate-400">{g.text}</span>
              </span>
              <Play className="w-5 h-5 text-slate-500 group-hover:text-white shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* Templates: each opens a working preview on the Templates page */}
      <section className="mt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Start from a template</h2>
            <p className="mt-2 text-slate-400">Try one right now, then make it yours by chatting with the AI.</p>
          </div>
          <Link to="/templates" className="shrink-0 text-sm text-indigo-300 hover:text-indigo-200">All templates</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {HOME_TEMPLATES.map((t) => (
            <Link
              key={t.id}
              to={`/templates?preview=${t.id}`}
              className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-2.5 hover:border-indigo-500/50 transition-colors"
            >
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-800">
                <SiteThumb html={t.html} />
              </div>
              <p className="mt-2.5 px-1 text-sm font-medium text-white truncate">{t.title}</p>
              <p className="px-1 text-xs text-slate-400 truncate">{t.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {sites.length > 0 && (
        <section className="mt-20">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Made by people like you</h2>
            <Link to="/showcase" className="shrink-0 text-sm text-indigo-300 hover:text-indigo-200">See all</Link>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sites.map((s) => (
              <a
                key={s.name}
                href={siteUrl(s.name) || "/showcase"}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-3 hover:border-indigo-500/50 transition-colors"
              >
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-800">
                  <SiteThumb name={s.name} />
                </div>
                <p className="mt-3 px-1 text-sm font-medium text-white truncate">{s.title || s.name}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Safety */}
      <section className="mt-28 sm:mt-36">
        <FeatureRow
          eyebrow="Safety"
          title="Safe for everyone, including kids."
          text="Nebulux AI is used by young people, so every website and game is checked before it goes live, and anyone can report a page for us to review."
          bullets={[
            "Adult content, scams and harmful code are blocked",
            "Fake login and card forms aren't allowed",
            "Makers' email addresses are never shown",
            "You pay on a secure checkout page, and we never see your card",
          ]}
          cta={{ to: "/safety", label: "How we keep you safe" }}
          Picture={SafetyShot}
          flip
        />
      </section>

      {/* Pricing */}
      <section className="mt-28 sm:mt-36">
        <Reveal className="text-center mb-10">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">Simple prices</h2>
          <p className="mt-4 text-slate-400 text-lg">Start free. Upgrade only if you want more.</p>
        </Reveal>
        <PricingCards />
        <p className="mt-6 text-center text-slate-400">
          Just need a few more credits? One-time packs start at $0.99, no subscription.{" "}
          <Link to="/pricing#packs" className="text-indigo-300 hover:text-indigo-200">See credit packs</Link>
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="mt-28 sm:mt-36 max-w-3xl mx-auto scroll-mt-24">
        <h2 className="text-center text-3xl sm:text-4xl font-bold text-white">Questions</h2>
        <div className="mt-8 divide-y divide-slate-800 border-y border-slate-800">
          {FAQ.map(([q, a, link]) => (
            <Question key={q} q={q}>
              <p>{a}</p>
              {link && (
                <Link to={link[0]} className="mt-2 inline-block text-indigo-300 hover:text-indigo-200">
                  {link[1]} →
                </Link>
              )}
            </Question>
          ))}
          <Question q="How do I contact you?">
            <div className="space-y-2">
              <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-white break-all">
                <Mail className="w-4 h-4 shrink-0" /> {CONTACT_EMAIL}
              </a>
              <a href={CONTACT_PHONE_LINK} className="flex items-center gap-2 hover:text-white">
                <Phone className="w-4 h-4 shrink-0" /> {CONTACT_PHONE}
              </a>
              <Link to="/contact" className="inline-block text-indigo-300 hover:text-indigo-200">Or send us a message →</Link>
            </div>
          </Question>
        </div>
      </section>

      {/* Final call to action */}
      <section className="mt-28 sm:mt-36">
        <Reveal className="text-center rounded-[2rem] bg-gradient-to-br from-indigo-600/30 via-fuchsia-600/20 to-transparent border border-indigo-400/20 px-6 py-14 sm:py-20">
          <h2 className="text-3xl sm:text-5xl font-bold text-white">Make your first thing today</h2>
          <p className="mt-4 text-slate-300 text-lg max-w-xl mx-auto">A website, a game or just a question. It's free to start and takes a minute to sign up.</p>
          <Link to={START_FREE} className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 text-lg font-semibold hover:bg-slate-200">
            Get started for free <ArrowRight className="w-5 h-5" />
          </Link>
        </Reveal>
      </section>
      </div>
      {/* Phones: once past the top, a "Get started" button stays at the bottom of the screen. */}
      <PhoneCta />
    </PublicLayout>
  );
}
