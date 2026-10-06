import React from "react";

// The opening splash: a star brightens and explodes (flash, shock ring, sparks). The blast
// blooms into the actual Nebulux nebula (the logo picture, huge, soft and turning), which then
// pulls in and settles as the logo, with its glow left behind. Then the name rises.
// Pure CSS (no animation library in the first download); about 3.6s.
const SPARKS = Array.from({ length: 22 }, (_, i) => ({ a: (i * 360) / 22 + (i % 2 ? 6 : -4), d: 150 + (i % 5) * 40, s: 1.5 + (i % 3) }));

const css = `
@keyframes nx-star{0%{transform:scale(.2);opacity:0}25%{opacity:1}75%{transform:scale(1);opacity:1}100%{transform:scale(2.6);opacity:0}}
@keyframes nx-flash{0%{opacity:0}35%{opacity:.9}100%{opacity:0}}
@keyframes nx-ring{0%{transform:translate(-50%,-50%) scale(.05);opacity:1;border-width:8px}100%{transform:translate(-50%,-50%) scale(6);opacity:0;border-width:1px}}
@keyframes nx-spark{0%{transform:rotate(var(--a)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--a)) translateX(var(--d)) scale(.2);opacity:0}}
@keyframes nx-nebula{
  0%{transform:scale(.15) rotate(-70deg);opacity:0;filter:blur(14px) brightness(2.2) saturate(1.4);border-radius:50%}
  30%{transform:scale(6.5) rotate(-25deg);opacity:1;filter:blur(5px) brightness(1.35) saturate(1.3);border-radius:50%}
  58%{transform:scale(5.6) rotate(-8deg);opacity:1;filter:blur(3px) brightness(1.25) saturate(1.25);border-radius:50%}
  100%{transform:scale(1) rotate(0);opacity:1;filter:none;border-radius:22%}}
@keyframes nx-halo{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
@keyframes nx-breathe{0%,100%{opacity:1;transform:translate(-50%,-50%) scale(1)}50%{opacity:.75;transform:translate(-50%,-50%) scale(1.08)}}
@keyframes nx-up{from{transform:translateY(16px);opacity:0;filter:blur(6px)}to{transform:none;opacity:1;filter:none}}
.nx-star{animation:nx-star .75s ease-in forwards}
.nx-flash{animation:nx-flash .5s ease-out .65s both}
.nx-ring{animation:nx-ring 1s cubic-bezier(.2,.7,.3,1) .7s both}
.nx-spark{animation:nx-spark 1s cubic-bezier(.1,.7,.3,1) .7s both}
.nx-nebula{animation:nx-nebula 1.9s cubic-bezier(.45,0,.2,1) .72s both;-webkit-mask-image:radial-gradient(circle,#000 45%,transparent 72%);mask-image:radial-gradient(circle,#000 45%,transparent 72%)}
.nx-nebula.done{-webkit-mask-image:none;mask-image:none}
.nx-halo{animation:nx-halo .8s cubic-bezier(.2,.8,.2,1) 2.3s both,nx-breathe 3.5s ease-in-out 3.1s infinite}
.nx-up{animation:nx-up .55s cubic-bezier(.2,.8,.2,1) both}
`;

export default function Intro() {
  // The soft edge only matters while the nebula is big; once it has shrunk, the logo shows square-ish.
  const [settled, setSettled] = React.useState(false);
  return (
    <div className="min-h-screen bg-[#03020a] overflow-hidden relative flex items-center justify-center px-6">
      <style>{css}</style>
      {/* background stars */}
      {Array.from({ length: 50 }, (_, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, width: i % 6 ? 1 : 2, height: i % 6 ? 1 : 2, opacity: 0.2 + (i % 4) * 0.15 }} />
      ))}

      {/* white flash over everything */}
      <div className="nx-flash absolute inset-0 bg-white pointer-events-none z-20" aria-hidden="true" />

      <div className="relative z-10 text-center -mt-[8vh]">
        <div className="relative flex justify-center mb-7">
          {/* glow the nebula leaves behind the logo */}
          <div className="nx-halo absolute left-1/2 top-1/2 w-[320px] h-[320px] rounded-full pointer-events-none" aria-hidden="true" style={{ background: "radial-gradient(circle, rgba(236,72,153,.45) 0%, rgba(147,51,234,.35) 35%, rgba(59,130,246,.12) 55%, transparent 70%)", filter: "blur(26px)" }} />
          {/* the nebula itself: the logo picture, blown up, that shrinks into the logo */}
          <img
            src="/logo-small.jpg"
            alt=""
            draggable="false"
            onAnimationEnd={(e) => e.animationName === "nx-nebula" && setSettled(true)}
            className={`nx-nebula relative w-28 h-28 object-cover select-none ${settled ? "done" : ""}`}
            style={{ boxShadow: settled ? "0 0 50px 8px rgba(192,132,252,.35)" : "none" }}
          />
          {/* the explosion, centered on the logo */}
          <div className="absolute left-1/2 top-1/2 w-0 h-0 z-10" aria-hidden="true">
            <div className="nx-ring absolute left-0 top-0 w-24 h-24 rounded-full border-solid" style={{ borderColor: "rgba(233,213,255,.9)" }} />
            {SPARKS.map((p, i) => (
              <span key={i} className="nx-spark absolute left-0 top-0 rounded-full bg-white" style={{ width: p.s * 2, height: p.s * 2, margin: -p.s, "--a": `${p.a}deg`, "--d": `${p.d}px`, boxShadow: "0 0 8px 2px rgba(233,213,255,.9)" }} />
            ))}
            <div className="nx-star absolute -left-3 -top-3 w-6 h-6 rounded-full bg-white" style={{ boxShadow: "0 0 30px 12px #fff, 0 0 90px 34px rgba(216,180,254,.75)" }} />
          </div>
        </div>
        <h1 className="nx-up text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight" style={{ animationDelay: "2.55s" }}>
          <span className="bg-gradient-to-r from-[#ffffff] via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">Nebulux AI</span>
        </h1>
        <p className="nx-up mt-6 text-slate-400 text-lg sm:text-xl font-light tracking-wide" style={{ animationDelay: "2.8s" }}>
          Endless possibilities, intelligently realized.
        </p>
      </div>
    </div>
  );
}
