import React from "react";

// The opening splash, one continuous motion with no pauses: a star swells and explodes (flash,
// shock ring, sparks), the blast blooms into the actual Nebulux nebula (the logo picture,
// huge, soft-edged and turning), which keeps turning as it shrinks and sharpens into the
// logo while the name rises and the stars keep drifting. Pure CSS; about 4 seconds.
const SPARKS = Array.from({ length: 24 }, (_, i) => ({ a: (i * 360) / 24 + (i % 2 ? 6 : -4), d: 160 + (i % 5) * 45, s: 1.5 + (i % 3) }));

const css = `
@keyframes nx-drift{from{transform:scale(1) rotate(0)}to{transform:scale(1.18) rotate(6deg)}}
@keyframes nx-star{0%{transform:scale(.2);opacity:0}30%{opacity:1}80%{transform:scale(1.1);opacity:1}100%{transform:scale(3);opacity:0}}
@keyframes nx-flash{0%{opacity:0}35%{opacity:.85}100%{opacity:0}}
@keyframes nx-ring{0%{transform:translate(-50%,-50%) scale(.05);opacity:1;border-width:8px}100%{transform:translate(-50%,-50%) scale(7);opacity:0;border-width:1px}}
@keyframes nx-spark{0%{transform:rotate(var(--a)) translateX(0) scale(1);opacity:1}100%{transform:rotate(var(--a)) translateX(var(--d)) scale(.2);opacity:0}}
/* one smooth path: blow up, then keep shrinking and turning into place (no hold) */
@keyframes nx-bloom{
  0%{transform:scale(.12) rotate(-160deg);animation-timing-function:cubic-bezier(.15,.75,.35,1)}
  24%{transform:scale(6.2) rotate(-95deg);animation-timing-function:cubic-bezier(.55,0,.25,1)}
  100%{transform:scale(1) rotate(0deg)}}
@keyframes nx-soft{0%{opacity:0;filter:blur(10px) brightness(2.4) saturate(1.6)}10%{opacity:1;filter:blur(3px) brightness(1.9) saturate(1.6)}70%{opacity:1;filter:blur(0) brightness(1.5) saturate(1.45)}100%{opacity:0;filter:brightness(1.25) saturate(1.3)}}
@keyframes nx-crisp{0%,62%{opacity:0}100%{opacity:1}}
@keyframes nx-halo{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
@keyframes nx-breathe{0%,100%{transform:translate(-50%,-50%) scale(1) rotate(0)}50%{transform:translate(-50%,-50%) scale(1.1) rotate(20deg)}}
@keyframes nx-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes nx-up{from{transform:translateY(22px);opacity:0;filter:blur(8px);letter-spacing:.12em}to{transform:none;opacity:1;filter:none;letter-spacing:-.025em}}
@keyframes nx-up2{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
.nx-drift{animation:nx-drift 5s linear both}
.nx-star{animation:nx-star .7s ease-in both}
.nx-flash{animation:nx-flash .5s ease-out .6s both}
.nx-ring{animation:nx-ring 1.1s cubic-bezier(.2,.7,.3,1) .62s both}
.nx-spark{animation:nx-spark 1.1s cubic-bezier(.1,.7,.3,1) .62s both}
.nx-bloom{animation:nx-bloom 2.7s .62s both}
.nx-soft{animation:nx-soft 2.7s ease-in-out .62s both;-webkit-mask-image:radial-gradient(circle,#000 42%,transparent 70%);mask-image:radial-gradient(circle,#000 42%,transparent 70%)}
.nx-crisp{animation:nx-crisp 2.7s ease-in .62s both}
.nx-float{animation:nx-float 3s ease-in-out 3.3s infinite}
.nx-halo{animation:nx-halo 1.4s cubic-bezier(.2,.8,.2,1) 1.9s both,nx-breathe 4s ease-in-out 3.3s infinite}
.nx-up{animation:nx-up .8s cubic-bezier(.2,.8,.2,1) both}
.nx-up2{animation:nx-up2 .7s cubic-bezier(.2,.8,.2,1) both}
`;

export default function Intro() {
  return (
    <div className="min-h-screen bg-[#03020a] overflow-hidden relative flex items-center justify-center px-6">
      <style>{css}</style>
      {/* background stars, slowly drifting the whole time */}
      <div className="nx-drift absolute inset-[-10%]" aria-hidden="true">
        {Array.from({ length: 70 }, (_, i) => (
          <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 61) % 100}%`, width: i % 6 ? 1 : 2, height: i % 6 ? 1 : 2, opacity: 0.2 + (i % 4) * 0.15 }} />
        ))}
      </div>

      {/* white flash over everything */}
      <div className="nx-flash absolute inset-0 bg-white pointer-events-none z-20" aria-hidden="true" />

      <div className="relative z-10 text-center -mt-[8vh]">
        <div className="relative flex justify-center mb-7">
          {/* glow the nebula leaves behind the logo */}
          <div className="nx-halo absolute left-1/2 top-1/2 w-[340px] h-[340px] rounded-full pointer-events-none" aria-hidden="true" style={{ background: "radial-gradient(circle, rgba(236,72,153,.45) 0%, rgba(147,51,234,.35) 35%, rgba(59,130,246,.12) 55%, transparent 70%)", filter: "blur(26px)" }} />
          <div className="nx-float relative">
            {/* the nebula: the logo picture blown up, turning, shrinking into the logo */}
            <div className="nx-bloom relative w-28 h-28">
              <img src="/logo.png" alt="" draggable="false" className="nx-soft absolute inset-0 w-full h-full object-cover select-none" />
              <img src="/logo.png" alt="" draggable="false" className="nx-crisp absolute inset-0 w-full h-full object-cover rounded-[22%] select-none" style={{ boxShadow: "0 0 50px 8px rgba(192,132,252,.45)", filter: "brightness(1.25) saturate(1.3)" }} />
            </div>
          </div>
          {/* the explosion, centered on the logo */}
          <div className="absolute left-1/2 top-1/2 w-0 h-0 z-10" aria-hidden="true">
            <div className="nx-ring absolute left-0 top-0 w-24 h-24 rounded-full border-solid" style={{ borderColor: "rgba(233,213,255,.9)" }} />
            {SPARKS.map((p, i) => (
              <span key={i} className="nx-spark absolute left-0 top-0 rounded-full bg-white" style={{ width: p.s * 2, height: p.s * 2, margin: -p.s, "--a": `${p.a}deg`, "--d": `${p.d}px`, boxShadow: "0 0 8px 2px rgba(233,213,255,.9)" }} />
            ))}
            <div className="nx-star absolute -left-3 -top-3 w-6 h-6 rounded-full bg-white" style={{ boxShadow: "0 0 30px 12px #fff, 0 0 90px 34px rgba(216,180,254,.75)" }} />
          </div>
        </div>
        <h1 className="nx-up text-6xl sm:text-7xl md:text-8xl font-bold" style={{ animationDelay: "2.35s" }}>
          <span className="bg-gradient-to-r from-[#ffffff] via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">Nebulux AI</span>
        </h1>
        <p className="nx-up2 mt-6 text-slate-400 text-lg sm:text-xl font-light tracking-wide" style={{ animationDelay: "2.75s" }}>
          Endless possibilities, intelligently realized.
        </p>
      </div>
    </div>
  );
}
