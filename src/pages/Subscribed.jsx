import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import usePageTitle from "@/hooks/usePageTitle";
import { addNotification } from "@/lib/notifications";
import { safeReturnTo } from "@/lib/authReturnTo";
import { shouldOfferTour } from "@/lib/welcomeTour";
import { PUBLIC_PLANS } from "@/lib/publicPlans";
import { MONTHLY, yearlyTotal, yearlyPerMonth } from "../../cloudflare-lib/planPrices.js";

// After subscribing to Pro or Team. This page doesn't give the plan: Stripe's signed webhook does
// (cloudflare-lib/stripe.js). After a moment people go back to the page they were on, or, if they
// bought straight after signing up, to the home page, where the welcome tour opens.
const SECONDS = 8;

const CSS = `
.nxs{position:relative;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px 22px;background:#07060f;color:#f6f2ff;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.nxs-sky,.nxs-glow,.nxs canvas{position:fixed;pointer-events:none}
.nxs-sky,.nxs canvas{inset:0}
.nxs-sky{background:radial-gradient(60% 50% at 18% 12%,rgba(176,107,255,.34),transparent 70%),radial-gradient(52% 46% at 86% 20%,rgba(255,107,208,.24),transparent 70%),radial-gradient(70% 60% at 62% 104%,rgba(90,140,255,.30),transparent 70%)}
.nxs-glow{width:620px;height:620px;left:50%;top:50%;margin:-330px 0 0 -310px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,130,255,.28),rgba(120,110,255,.10) 60%,transparent);filter:blur(10px);animation:nxs-breathe 7s ease-in-out infinite}
@keyframes nxs-breathe{50%{transform:scale(1.1);opacity:.75}}
.nxs-card{position:relative;width:100%;max-width:520px;padding:32px 36px 26px;text-align:center;border-radius:26px;background:linear-gradient(180deg,rgba(38,30,66,.82),rgba(18,15,36,.86));border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(18px);animation:nxs-rise .7s cubic-bezier(.2,.9,.25,1) both}
@keyframes nxs-rise{from{opacity:0;transform:translateY(26px) scale(.97)}}
.nxs-badge{position:relative;width:104px;height:104px;margin:0 auto 18px}
.nxs-badge img{position:absolute;inset:9px;width:86px;height:86px;border-radius:50%;object-fit:cover;box-shadow:0 0 44px rgba(190,120,255,.65)}
.nxs-ring{position:absolute;inset:0;transform:rotate(-90deg)}
.nxs-ring circle{fill:none;stroke:url(#nxs-rg);stroke-width:3;stroke-linecap:round;stroke-dasharray:308;stroke-dashoffset:308;animation:nxs-draw 1s .15s ease-out forwards}
@keyframes nxs-draw{to{stroke-dashoffset:0}}
.nxs-tick{position:absolute;right:0;bottom:2px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#6dffb0,#27c98a);border:3px solid #1a1530;animation:nxs-pop .45s .85s cubic-bezier(.3,1.7,.5,1) both}
@keyframes nxs-pop{from{transform:scale(0)}}
.nxs-eye{margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#d7b8ff}
.nxs h1{margin:0;padding-bottom:.1em;font-size:clamp(30px,6.6vw,40px);line-height:1.2;font-weight:750;letter-spacing:-.02em;background:linear-gradient(100deg,#fff 20%,#e9c6ff 60%,#a9dcff);-webkit-background-clip:text;background-clip:text;color:transparent}
.nxs-lead{margin:6px auto 0;max-width:360px;font-size:16px;line-height:1.5;color:#b9b0d4}
.nxs-plan{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:22px 0 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);text-align:left}
.nxs-plan b{font-size:15px;font-weight:650}
.nxs-amt{text-align:right}
.nxs-amt span{font-size:18px;font-weight:650;white-space:nowrap}
.nxs-amt i{font-style:normal;font-weight:500;font-size:12.5px;color:#b9b0d4}
.nxs-amt small{display:block;margin-top:2px;font-size:12.5px;color:#b9b0d4}
.nxs ul{list-style:none;margin:12px 0 0;padding:0;text-align:left}
.nxs li{display:flex;gap:11px;align-items:flex-start;padding:5px 2px;font-size:14.5px;line-height:1.4;color:#e6e0f7}
.nxs li svg{flex:none;margin-top:2px}
.nxs-go{display:block;margin-top:18px;padding:15px 18px;border-radius:13px;font-size:16px;font-weight:650;color:#fff;text-decoration:none;background:linear-gradient(100deg,#8a5cff,#d05cf0 60%,#ff6bd0);box-shadow:0 12px 34px rgba(170,90,255,.45);transition:transform .15s,box-shadow .15s,filter .15s}
.nxs-go:hover{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 16px 42px rgba(170,90,255,.6)}
.nxs-go:focus-visible{outline:2px solid #fff;outline-offset:3px}
.nxs-soon{margin:12px 0 0;font-size:13.5px;color:#b9b0d4}
.nxs-soon b{color:#f6f2ff;font-weight:650}
.nxs-soon button{padding:0;border:0;background:none;color:#d7b8ff;font:inherit;cursor:pointer}
.nxs-soon button:hover{text-decoration:underline}
.nxs-help{margin:14px 0 0;font-size:13.5px;color:#b9b0d4}
.nxs-help a{color:#d7b8ff;text-decoration:none}
.nxs-help a:hover{text-decoration:underline}
.nxs footer{position:relative;margin-top:16px;font-size:12.5px;color:#8f87ab}
@media (max-width:460px){.nxs-card{padding:32px 22px 24px;border-radius:22px}}
@media (prefers-reduced-motion:reduce){.nxs *{animation:none!important;transition:none!important}.nxs-ring circle{stroke-dashoffset:0}}
`;

function Stars() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, x = c.getContext("2d"), D = Math.min(2, window.devicePixelRatio || 1), still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, last = performance.now();
    const size = () => { W = window.innerWidth; H = window.innerHeight; c.width = W * D; c.height = H * D; x.setTransform(D, 0, 0, D, 0, 0); };
    size();
    window.addEventListener("resize", size);
    const stars = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.3, s: Math.random() * 1.4 + 0.4 }));
    const cols = ["#b06bff", "#ff6bd0", "#6ad0ff", "#ffffff", "#ffd27a"];
    const bits = still ? [] : Array.from({ length: 90 }, (_, j) => { const a = Math.random() * 6.28, v = 220 + Math.random() * 520; return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: Math.random() * 2.4 + 1.2, c: cols[j % cols.length], t: 0, life: 1.3 + Math.random() * 1.1 }; });
    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000;
      last = now;
      x.clearRect(0, 0, W, H);
      for (const s of stars) { x.globalAlpha = still ? 0.6 : 0.35 + Math.sin(t * s.s + s.p) * 0.3 + 0.3; x.fillStyle = "#fff"; x.beginPath(); x.arc(s.x * W, s.y * H, s.r, 0, 6.3); x.fill(); }
      const cx = W / 2, cy = H / 2 - 120;
      for (let k = bits.length - 1; k >= 0; k--) { const b = bits[k]; b.t += dt; if (b.t > b.life) { bits.splice(k, 1); continue; } b.vx *= 1 - 1.5 * dt; b.vy = b.vy * (1 - 1.5 * dt) + 150 * dt; b.x += b.vx * dt; b.y += b.vy * dt; x.globalAlpha = Math.max(0, 1 - b.t / b.life); x.fillStyle = b.c; x.beginPath(); x.arc(cx + b.x, cy + b.y, b.r, 0, 6.3); x.fill(); }
      x.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

const Tick = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="#b06bff" fillOpacity=".22" /><path d="M5 9.4l2.7 2.7L13 6.6" stroke="#d7b8ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const USAGE_PERKS = ["Keeps every AI going after your 5-hour limit runs out", "They don't extend your weekly limit", "Set how much they can spend a day in Settings, Usage"];

export default function Subscribed({ plan, usage }) {
  const title = plan ? "Thanks for subscribing" : "Thanks for your purchase";
  usePageTitle(title);
  const { user, isLoadingAuth } = useAuth();
  const q = new URLSearchParams(window.location.search);
  const yearly = q.get("billing") === "yearly", sessionId = q.get("session_id") || "";
  const info = PUBLIC_PLANS.find((p) => p.id === plan), name = plan ? info.name : "Usage credits", monthly = plan ? MONTHLY[plan] : 0, perks = plan ? info.features : USAGE_PERKS;
  const [status, setStatus] = useState("paid");
  const [left, setLeft] = useState(SECONDS);
  const [stay, setStay] = useState(false);

  // Bought right after getting in: the home page, then the tour. Everyone else: back where they were.
  const from = safeReturnTo("from");
  const home = !from || from === "/" || (user && shouldOfferTour(user));
  const next = home ? "/chat" : from;

  useEffect(() => {
    addNotification({ kind: "purchase", text: plan ? `Thanks for subscribing! Your ${name} plan is being added.` : `Thanks for your purchase! Your $${usage} of usage credits is being added.`, link: "/chat/plans" });
  }, [name, plan, usage]);
  // A bank payment takes a few days: say so instead of "ready".
  useEffect(() => {
    if (!sessionId || !user) return;
    base44.functions.invoke("checkout-status", { sessionId }).then((r) => r.data?.status === "processing" && setStatus("processing"), () => {});
  }, [sessionId, user]);
  useEffect(() => {
    if (stay || isLoadingAuth) return undefined;
    if (left <= 0) {
      window.location.replace(next);
      return undefined;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, stay, isLoadingAuth, next]);

  const lead = status === "processing" ? `Your bank is confirming the payment, which usually takes a few days. ${plan ? `Your ${name} plan starts` : "Your usage credits are added"} as soon as it clears.` : !plan ? "Your usage credits are ready. They'll keep you going when you hit your 5-hour limit." : plan === "team" ? "Your Team plan is ready. Build with up to 2 friends or coworkers." : "Your Pro plan is ready. Higher limits and all 4 AI models are yours.";
  return (
    <div className="nxs">
      <style>{CSS}</style>
      <div className="nxs-sky" />
      <div className="nxs-glow" />
      <Stars />
      <main className="nxs-card">
        <div className="nxs-badge">
          <svg className="nxs-ring" viewBox="0 0 104 104" width="104" height="104" aria-hidden="true">
            <defs><linearGradient id="nxs-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6ad0ff" /><stop offset=".5" stopColor="#b06bff" /><stop offset="1" stopColor="#ff6bd0" /></linearGradient></defs>
            <circle cx="52" cy="52" r="49" />
          </svg>
          <img src="/icon-192.png" alt="Nebulux AI" />
          <div className="nxs-tick"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" stroke="#0b2a1c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        </div>
        <p className="nxs-eye">Nebulux AI {name}</p>
        <h1>{title}</h1>
        <p className="nxs-lead">{lead}</p>
        <div className="nxs-plan">
          <b>{plan ? `${name} plan` : name}</b>
          <div className="nxs-amt">
            {plan ? <span>${yearly ? yearlyPerMonth(monthly) : monthly} <i>per month</i></span> : <span>${usage}</span>}
            <small>{!plan ? "One-time payment" : yearly ? `$${yearlyTotal(monthly)} billed yearly` : "Billed monthly"}</small>
          </div>
        </div>
        <ul>{perks.map((f) => <li key={f}><Tick /><span>{f}</span></li>)}</ul>
        <a className="nxs-go" href={next}>{home ? "Go to your home page" : "Back to where you were"}</a>
        {!stay && (
          <p className="nxs-soon">Taking you to {home ? "your home page" : "where you were"} in <b>{left}</b>s &middot; <button type="button" onClick={() => setStay(true)}>Stay here</button></p>
        )}
        <p className="nxs-help">Questions? Email <a href="mailto:support@nebuluxai.com">support@nebuluxai.com</a></p>
      </main>
      <footer>&copy; Nebulux LLC</footer>
    </div>
  );
}
