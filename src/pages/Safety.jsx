import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CreditCard, Lock, ShieldCheck, Flag, Baby, KeyRound, Mail, ArrowRight, Check, Store, Users } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { CONTACT_EMAIL } from "@/lib/company";

// Trust & safety: how payments, accounts and published pages are protected, in plain words.
// Everything here describes what the app really does; keep it in step with the code
// (payments: base44/functions/create-checkout and payments-webhook; credits:
// cloudflare-lib/credits.js; publishing checks: cloudflare-lib/published.js, scan.js,
// phishing.js; page isolation: cloudflare-lib/pageserve.js and src/lib/previewShim.js).
const SECTIONS = [
  {
    icon: CreditCard,
    title: "Paying is safe",
    points: [
      "Checkout is run by our payment provider on its own secure page. We never see or store your card number.",
      "Prices are worked out on our server, not in your browser, so nobody can change what something costs.",
      "A payment only counts once the payment provider's signed message confirms it.",
      "Plans are monthly. If you stop paying you go back to the Free plan and keep your account. Credit packs are one-time, with no subscription.",
    ],
  },
  {
    icon: Lock,
    title: "Your account and credits",
    points: [
      "Your credits and plan are counted on our server, so they can't be changed or reset from a browser.",
      "New passwords that are easy to guess, like the ones on attackers' lists, can't be used.",
      "After too many wrong passwords or sign-up codes, signing in to that account pauses for a few minutes, so nobody can keep guessing.",
      "Admin tools, like giving someone a plan or credits, only work for our team, and that's checked on the server every time.",
      "You can delete your account, and every site and game in it, whenever you like (Settings → Delete account).",
      "Your email address is never shown on your published sites or in the gallery.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Published sites and games are walled off",
    points: [
      "Every published site lives at its own web address, so it can't read your Nebulux AI account.",
      "Previews in the app run in a locked-down frame that can't reach your account either.",
      "Pages with a form that sends passwords or card numbers to another website are refused when they're published, and when they're served.",
      "Buy buttons on sites people make always go through the same secure checkout. Sites can't collect card numbers themselves.",
    ],
  },
  {
    icon: Store,
    title: "Buying and selling on sites people make",
    points: [
      "Buy buttons on a site always open the same secure checkout, where you see the seller's site, the price and any tax before you pay.",
      "Only a site's real owner can set its prices and be paid for its sales.",
      "Sellers are paid after a waiting period, so card disputes can come in first, and a sale that looks like fraud is held while we check it.",
      "The seller is responsible for delivering what they sell and for refunds. If something's wrong, report the site.",
    ],
  },
  {
    icon: Baby,
    title: "Safe for young makers",
    points: [
      "Our AI is instructed, from our server, to keep what it writes suitable for kids and not to build scam or password-stealing pages. Publishing checks catch what gets through.",
      "Pages are checked for adult content, scams, hidden code and other harmful things before they go live.",
      "Every published page has a Report link, and reports are reviewed by a person.",
      "Pages that break the rules are taken down, and their owner can't put them back up.",
    ],
  },
];

// For a parent or teacher deciding whether a young person can use Nebulux AI. Each point
// matches the app: the 13+ rule (Terms, sign-up), paying (create-checkout; plans are $1 and
// $5 a month), the purchase list and data download (Settings), deletion, and the filters.
const PARENTS = [
  "Nebulux AI is for ages 13 and up. Anyone under 18 needs a parent or guardian's permission, especially before buying anything.",
  "It's free to use. Paid plans are monthly and credit packs are one-time, and every purchase goes through a secure checkout that shows the price first.",
  "Every purchase is listed in Settings → Subscriptions. To cancel a plan or ask about a charge, contact us and pick \"Plans, credits or payments\".",
  "The AI is told to keep what it writes suitable for young people, published pages are checked before they go live.",
  "The chat asks before sending anything that looks like a phone number, home address, password or card number, and a flag under every AI reply lets you report one that isn't right.",
  "Chats are saved on the device; our servers keep only the start of the last few questions, to spot misuse. You can download a copy of an account's data, or delete the account and everything in it, from Settings.",
];

// Safety work people can see, newest first. Only list what's live.
const RECENT = {
  month: "September 2026",
  items: [
    "If someone tells the AI they're thinking of hurting themselves or are being hurt, it answers with care and points them to real help: a trusted adult, 988 in the US, or emergency services.",
    "Forms on published sites now reach the site's owner, and password and card-number fields are never sent, so a site can't be used to collect them.",
    "Every new account confirms its email with a code before it can use anything, so nobody can sign up with someone else's address.",
    "Accounts that break the rules can be removed for good: their email can't be used to sign up again.",
    "Only a few new accounts can be made from one network, which stops people making lots of fake accounts.",
    "Signing out and signing in always stay on nebuluxai.com.",
    "Your GitHub connection stays in your own browser and is only ever sent to GitHub.",
    "Paste code with an API key or access token in it, and the chat asks first, so your accounts stay yours.",
    "You can report an AI reply that's harmful or wrong with the flag under it.",
    "Signing out puts your chats away: the next person on that computer starts with none, and yours come back when you sign in again.",
    "Sign-in is protected against password guessing: after too many wrong tries, that account pauses for a few minutes.",
    "New passwords that are easy to guess can't be used, and you can show your password while typing it.",
    "On shared and school computers: signing in without \"Remember me\" signs you out and clears your chats when the browser closes, and Settings → Security can sign out and clear the browser any time.",
    "Pages asking for a crypto wallet's secret recovery phrase can't be published.",
    "The chat asks before you send something that looks like a card number, password, phone number or home address.",
    "You can report a page for bullying someone or sharing their private information.",
    "You can download a copy of your account's data from Settings.",
  ],
};

const TIPS = [
  "We will never ask for your password, by email, phone or chat.",
  "Only type your password on nebuluxai.com. Check the address first.",
  "Use a password you don't use anywhere else.",
  "If a site made with Nebulux AI asks for a password or card number, don't enter it, and report it.",
];

export default function Safety() {
  // Links like /safety#parents: open at that section, also when arriving from inside the app.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
    return () => clearTimeout(t);
  }, [hash]);
  return (
    <PublicLayout title="Trust & safety">
      <section className="pt-10 sm:pt-16 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Trust & safety</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-white leading-tight">How we keep you, your money and your work safe</h1>
        <p className="mt-5 text-slate-400 text-lg">
          Lots of people who use Nebulux AI are students and first-time makers. Here, in plain words, is what protects your account, your payments and the
          things you publish.
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
        {SECTIONS.map(({ icon: Icon, title, points }) => (
          <div key={title} className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
            <Icon className="w-7 h-7 text-emerald-300" />
            <h2 className="mt-3 text-xl font-semibold text-white">{title}</h2>
            <ul className="mt-3 space-y-2.5">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-slate-300 text-sm">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section id="parents" className="mt-12 rounded-3xl bg-slate-900/50 border border-slate-800 p-6 sm:p-8 scroll-mt-20">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-sky-300" />
          <h2 className="text-xl font-semibold text-white">For parents and teachers</h2>
        </div>
        <ul className="mt-4 space-y-3">
          {PARENTS.map((t) => (
            <li key={t} className="flex items-start gap-2 text-slate-300 text-sm">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-sky-300" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/contact?topic=billing" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-sky-200">
            Ask about a payment <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
          <Link to="/contact?topic=parent" className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-sky-200">
            Contact us as a parent or teacher <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-3xl bg-amber-500/10 border border-amber-400/30 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-amber-300" />
          <h2 className="text-xl font-semibold text-white">Staying safe yourself</h2>
        </div>
        <ul className="mt-4 grid sm:grid-cols-2 gap-3">
          {TIPS.map((t) => (
            <li key={t} className="flex items-start gap-2 text-slate-200 text-sm">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Recently added</h2>
        <p className="mt-1 text-sm text-slate-400">{RECENT.month}</p>
        <ul className="mt-4 grid sm:grid-cols-2 gap-3">
          {RECENT.items.map((t) => (
            <li key={t} className="flex items-start gap-2 text-slate-300 text-sm">
              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 grid md:grid-cols-2 gap-5">
        <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
          <Flag className="w-7 h-7 text-rose-300" />
          <h2 className="mt-3 text-xl font-semibold text-white">Seen something wrong?</h2>
          <p className="mt-2 text-slate-400 text-sm">Report a site or game that looks like a scam, bullies someone, copies someone else, or isn't OK for kids.</p>
          <Link to="/report" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-rose-200">
            Report a page <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div id="security" className="scroll-mt-20 rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
          <Mail className="w-7 h-7 text-indigo-300" />
          <h2 className="mt-3 text-xl font-semibold text-white">Found a security problem?</h2>
          <p className="mt-2 text-slate-400 text-sm">
            If you think you've found a way to get into accounts, credits or payments, please tell us privately first so we can fix it. We read every message.
          </p>
          <Link to="/contact?topic=security" className="mt-4 mr-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-indigo-200">
            Send a private message <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Security%20report`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-indigo-200 break-all">
            {CONTACT_EMAIL} <ArrowRight className="w-4 h-4 shrink-0" />
          </a>
        </div>
      </section>

      <p className="mt-10 text-sm text-slate-500">
        More detail is in our <Link to="/terms" className="underline hover:text-slate-300">Terms</Link> and{" "}
        <Link to="/privacy" className="underline hover:text-slate-300">Privacy Policy</Link>.
      </p>
    </PublicLayout>
  );
}
