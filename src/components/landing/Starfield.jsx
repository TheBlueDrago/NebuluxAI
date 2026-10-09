import React, { useEffect, useRef } from "react";

// The slow, twinkling starfield and glow behind the home page (matches Nebulux Sites).
export default function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const x = c.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let S = [], W = 0, H = 0, raf = 0;
    const size = () => {
      const d = window.devicePixelRatio || 1;
      W = c.width = innerWidth * d;
      H = c.height = innerHeight * d;
      S = Array.from({ length: Math.min(240, (innerWidth * innerHeight) / 5200) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 * d + 0.2, t: Math.random() * 6, s: Math.random() * 0.12 + 0.02 }));
    };
    const draw = (now) => {
      x.clearRect(0, 0, W, H);
      for (const p of S) {
        x.fillStyle = `rgba(220,210,255,${0.32 + Math.sin(now / 950 + p.t) * 0.28})`;
        x.beginPath();
        x.arc(p.x, p.y, p.r, 0, 7);
        x.fill();
        if (!still) { p.y -= p.s; if (p.y < 0) p.y = H; }
      }
      raf = requestAnimationFrame(draw);
    };
    size();
    addEventListener("resize", size);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);
  return (
    <>
      <canvas ref={ref} aria-hidden="true" className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
      <div aria-hidden="true" className="nx-aurora" />
    </>
  );
}
