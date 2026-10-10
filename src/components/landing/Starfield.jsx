import React, { useEffect, useRef } from "react";

// The slow, twinkling starfield and glow behind the home page (matches Nebulux Sites).
export default function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const x = c.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let S = [], W = 0, H = 0, raf = 0, last = 0, lastW = 0;
    const size = () => {
      // Phones fire resize when the address bar slides in and out: only redo the stars when the width changes.
      if (innerWidth === lastW && S.length) return;
      lastW = innerWidth;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = c.width = innerWidth * d;
      H = c.height = innerHeight * d;
      S = Array.from({ length: Math.min(240, (innerWidth * innerHeight) / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 * d + 0.2, t: Math.random() * 6, s: Math.random() * 0.12 + 0.02 }));
    };
    const draw = (now) => {
      // About 30 frames a second is plenty for slow stars and saves phone batteries.
      if (now - last < 32) { raf = requestAnimationFrame(draw); return; }
      last = now;
      x.clearRect(0, 0, W, H);
      for (const p of S) {
        x.fillStyle = `rgba(220,210,255,${0.32 + Math.sin(now / 950 + p.t) * 0.28})`;
        x.beginPath();
        x.arc(p.x, p.y, p.r, 0, 7);
        x.fill();
        if (!still) { p.y -= p.s * 2; if (p.y < 0) p.y = H; }
      }
      if (!still) raf = requestAnimationFrame(draw); // reduced motion: drawn once, then left alone
    };
    size();
    const onResize = () => { size(); if (still) { last = -1e9; draw(performance.now()); } };
    addEventListener("resize", onResize);
    raf = requestAnimationFrame((t) => { last = -1e9; draw(t); });
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, []);
  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
      <div aria-hidden="true" className="nx-aurora" />
    </>
  );
}
