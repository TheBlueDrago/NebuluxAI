import React from "react";
import BlackholeIcon from "@/components/BlackholeIcon";

// The opening splash: a star brightens and explodes (flash, shock ring, sparks), the blast
// spreads into a swirling nebula, the nebula pulls back in and turns into the Nebulux logo,
// then the name rises. Pure CSS (no animation library in the first download); about 3.6s.
const SPARKS = Array.from({ length: 18 }, (_, i) => ({ a: (i * 360) / 18 + (i % 2 ? 7 : -5), d: 140 + (i % 4) * 45, s: 2 + (i % 3) }));
const CLOUDS = [
  ["#7c3aed", -60, -30, 340],
  ["#db2777", 70, 20, 300],
  ["#2563eb", -20, 60, 320],
  ["#c026d3", 40, -60, 260],
  ["#0ea5e9", -80, 40, 220],
];

const css = `
.nx-intro{--t:1s}
@keyframes nx-star{0%{transform:scale(.2);opacity:0}25%{opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(2.4);opacity:0}}
@keyframes nx-flash{0%{opacity:0}40%{opacity:.95}100%{opacity:0}}
@keyframes nx-ring{0%{transform:translate(-50%,-50%) scale(.05);opacity:1;border-width:10px}100%{transform:translate(-50%,-50%) scale(5);opacity:0;border-width:1px}}
@keyframes nx-spark{0%{transform:rotate(var(--a)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--a)) translateX(var(--d)) scale(.3);opacity:0}}
@keyframes nx-cloud{0%{transform:translate(-50%,-50%) translate(0,0) scale(.1) rotate(0);opacity:0}
  35%{opacity:.85}
  65%{transform:translate(-50%,-50%) translate(var(--x),var(--y)) scale(1) rotate(40deg);opacity:.8}
  100%{transform:translate(-50%,-50%) translate(0,0) scale(.12) rotate(120deg);opacity:0}}
@keyframes nx-swirl{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(90deg)}}
@keyframes nx-logo{0%{transform:scale(.2) rotate(-40deg);opacity:0;filter:blur(8px) brightness(2)}60%{opacity:1;filter:blur(0) brightness(1.4)}100%{transform:scale(1) rotate(0);opacity:1;filter:none}}
@keyframes nx-glow{0%,100%{box-shadow:0 0 40px 6px rgba(167,139,250,.35)}50%{box-shadow:0 0 70px 14px rgba(236,72,153,.35)}}
@keyframes nx-up{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
.nx-star{animation:nx-star .8s ease-in forwards}
.nx-flash{animation:nx-flash .6s ease-out .7s both}
.nx-ring{animation:nx-ring 1.1s cubic-bezier(.2,.7,.3,1) .75s both}
.nx-spark{animation:nx-spark 1.1s cubic-bezier(.1,.7,.3,1) .75s both}
.nx-swirl{animation:nx-swirl 2s linear .8s both}
.nx-cloud{animation:nx-cloud 1.7s cubic-bezier(.4,0,.3,1) .8s both}
.nx-logo{animation:nx-logo .7s cubic-bezier(.2,.8,.2,1.2) 2.2s both,nx-glow 2.4s ease-in-out 2.9s infinite}
.nx-up{animation:nx-up .6s ease-out both}
`;

export default function Intro() {
  return (
    <div className="nx-intro min-h-screen bg-[#03020a] overflow-hidden relative flex items-center justify-center px-6">
      <style>{css}</style>
      {/* background stars */}
      {Array.from({ length: 40 }, (_, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, width: i % 5 ? 1 : 2, height: i % 5 ? 1 : 2, opacity: 0.25 + (i % 4) * 0.15 }} />
      ))}

      {/* white flash over everything */}
      <div className="nx-flash absolute inset-0 bg-white pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 text-center -mt-[8vh]">
        <div className="relative flex justify-center mb-6">
          {/* the blast, centered on the logo spot */}
          <div className="absolute left-1/2 top-1/2 w-0 h-0" aria-hidden="true">
            {/* nebula clouds: spread out, swirl, then pull back in */}
            <div className="nx-swirl absolute left-0 top-0 w-0 h-0">
              {CLOUDS.map(([c, x, y, size], i) => (
                <div key={i} className="nx-cloud absolute left-0 top-0 rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle, ${c} 0%, ${c}66 35%, transparent 70%)`, filter: "blur(18px)", "--x": `${x}px`, "--y": `${y}px`, animationDelay: `${0.8 + i * 0.05}s` }} />
              ))}
            </div>
            {/* shock ring */}
            <div className="nx-ring absolute left-0 top-0 w-24 h-24 rounded-full border-white/80 border-solid" style={{ borderColor: "rgba(216,180,254,.9)" }} />
            {/* sparks */}
            {SPARKS.map((p, i) => (
              <span key={i} className="nx-spark absolute left-0 top-0 rounded-full bg-white" style={{ width: p.s * 2, height: p.s * 2, margin: -p.s, "--a": `${p.a}deg`, "--d": `${p.d}px`, boxShadow: "0 0 8px 2px rgba(196,181,253,.9)" }} />
            ))}
            {/* the star */}
            <div className="nx-star absolute -left-3 -top-3 w-6 h-6 rounded-full bg-white" style={{ boxShadow: "0 0 30px 12px #fff, 0 0 80px 30px rgba(167,139,250,.8)" }} />
          </div>
              <div className="nx-logo relative w-24 h-24 rounded-[22%] overflow-hidden">
            <BlackholeIcon className="w-full h-full" />
          </div>
        </div>
        <h1 className="nx-up text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight" style={{ animationDelay: "2.7s" }}>
          <span className="bg-gradient-to-r from-[#ffffff] via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">Nebulux AI</span>
        </h1>
        <p className="nx-up mt-6 text-slate-400 text-lg sm:text-xl font-light tracking-wide" style={{ animationDelay: "3s" }}>
          Endless possibilities, intelligently realized.
        </p>
      </div>
    </div>
  );
}
