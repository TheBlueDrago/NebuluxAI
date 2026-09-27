import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, Heart, Rocket, Mail, Phone, ArrowRight } from "lucide-react";
import PublicLayout, { START_FREE } from "@/components/PublicLayout";
import { ChatShot, SiteShot } from "@/components/landing/ProductShots";
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_LINK } from "@/lib/company";

const VALUES = [
  { icon: Sparkles, title: "Anyone can make things", text: "You shouldn't need to learn to code to put a website or a game on the internet. Describing it should be enough." },
  { icon: ShieldCheck, title: "Safe by default", text: "Lots of our users are young, so pages are checked before they go live, reports are reviewed, and makers' emails stay private." },
  { icon: Heart, title: "Cheap and fair", text: "Free to start, $15 a month for Pro. You can download your code on Pro and Team, and delete your account and everything in it whenever you like." },
  { icon: Rocket, title: "Always improving", text: "New features ship all the time, often straight from ideas people send us." },
];

// About us: what Nebulux AI is, what it stands for, and how to reach the people behind it.
export default function About() {
  return (
    <PublicLayout title="About us">
      <section className="grid lg:grid-cols-2 gap-12 items-center pt-10 sm:pt-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">About us</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-white leading-tight">We help people make things on the internet</h1>
          <p className="mt-5 text-slate-400 text-lg">
            Nebulux AI is an AI helper that anyone can use to chat, build a website or make a game, just by describing what they want. It's an independent
            project, built for students, creators and small businesses.
          </p>
          <p className="mt-4 text-slate-400 text-lg">
            Our goal is simple: if you can explain your idea, you should be able to see it working and share it with the world, in minutes, on any phone or
            computer.
          </p>
        </div>
        <div className="relative pb-10">
          <SiteShot id="portfolio" address="maya-chen.nebuluxai.com" />
          <ChatShot className="absolute -bottom-4 -left-2 sm:-left-8 w-[75%] sm:w-[60%] hidden sm:block" />
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-white text-center">What we believe</h2>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6">
              <Icon className="w-7 h-7 text-indigo-300" />
              <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-1 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-2 gap-5">
        <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-8">
          <h2 className="text-2xl font-bold text-white">Get in touch</h2>
          <p className="mt-2 text-slate-400">Questions, ideas, business or press: we read everything.</p>
          <div className="mt-5 space-y-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-slate-200 hover:text-white break-all">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center"><Mail className="w-5 h-5 text-indigo-300" /></span>
              {CONTACT_EMAIL}
            </a>
            <a href={CONTACT_PHONE_LINK} className="flex items-center gap-3 text-slate-200 hover:text-white">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center"><Phone className="w-5 h-5 text-indigo-300" /></span>
              {CONTACT_PHONE}
            </a>
          </div>
          <Link to="/contact" className="mt-6 inline-flex items-center gap-2 text-indigo-300 font-semibold hover:text-indigo-200">
            Send us a message <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600/30 via-fuchsia-600/20 to-transparent border border-indigo-400/20 p-8 flex flex-col">
          <h2 className="text-2xl font-bold text-white">Partners, investors and acquirers</h2>
          <p className="mt-2 text-slate-300 flex-1">
            Want to work with Nebulux AI, invest in it or buy it? We'd love to talk.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/contact?topic=partnership" className="px-5 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200">Get in touch</Link>
            <Link to={START_FREE} className="px-5 py-3 rounded-full border border-white/30 text-white font-semibold hover:bg-white/10">Try it free</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
