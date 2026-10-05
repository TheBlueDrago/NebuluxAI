import React from "react";

// The picture in the "Upgrade to use Nebulux Code" popup: someone at a glowing monitor full of
// green code, in a dark room. Drawn here (no image file); the code lines scroll slowly.
export default function CodeArt({ className = "" }) {
  const lines = [
    [8, 40], [16, 62], [16, 48], [24, 70], [24, 36], [16, 54], [8, 30], [16, 66], [24, 44], [16, 58], [8, 50], [16, 38],
  ];
  return (
    <svg viewBox="0 0 320 190" className={className} role="img" aria-label="A person writing code on a glowing computer">
      <defs>
        <radialGradient id="ca-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity=".35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ca-room" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120d2b" />
          <stop offset="100%" stopColor="#05040f" />
        </linearGradient>
        <clipPath id="ca-screen">
          <rect x="92" y="26" width="136" height="86" rx="4" />
        </clipPath>
        <style>{`@keyframes ca-scroll{from{transform:translateY(0)}to{transform:translateY(-48px)}}@keyframes ca-blink{50%{opacity:0}}.ca-code{animation:ca-scroll 6s linear infinite}.ca-cursor{animation:ca-blink 1s steps(1) infinite}@media (prefers-reduced-motion:reduce){.ca-code,.ca-cursor{animation:none}}`}</style>
      </defs>
      <rect width="320" height="190" rx="14" fill="url(#ca-room)" />
      {/* stars */}
      {[[20, 20], [60, 14], [280, 24], [300, 60], [36, 70], [262, 12]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.1" fill="#c6bfeb" opacity=".7" />
      ))}
      <ellipse cx="160" cy="80" rx="140" ry="90" fill="url(#ca-glow)" />
      {/* monitor */}
      <rect x="86" y="20" width="148" height="98" rx="8" fill="#1b1638" stroke="#2d2654" strokeWidth="2" />
      <rect x="92" y="26" width="136" height="86" rx="4" fill="#03140a" />
      <g clipPath="url(#ca-screen)">
        <g className="ca-code">
          {[...lines, ...lines].map(([indent, w], i) => (
            <rect key={i} x={98 + indent} y={32 + i * 8} width={w} height="3" rx="1.5" fill={i % 5 === 2 ? "#a3e635" : i % 4 === 1 ? "#38bdf8" : "#22c55e"} opacity={0.85} />
          ))}
        </g>
        <rect className="ca-cursor" x="104" y="100" width="6" height="6" fill="#4ade80" />
      </g>
      <rect x="150" y="118" width="20" height="14" fill="#1b1638" />
      <rect x="128" y="130" width="64" height="6" rx="3" fill="#2d2654" />
      {/* desk + keyboard */}
      <rect x="20" y="150" width="280" height="8" rx="4" fill="#2d2654" />
      <rect x="112" y="142" width="96" height="8" rx="3" fill="#3b3470" />
      {/* person, seen from behind, with headphones */}
      <path d="M118 190 C118 160 132 146 160 146 C188 146 202 160 202 190 Z" fill="#0b0920" />
      <circle cx="160" cy="128" r="17" fill="#0b0920" />
      <path d="M143 128 A17 17 0 0 1 177 128" fill="none" stroke="#c86cf2" strokeWidth="3" />
      <rect x="139" y="124" width="6" height="11" rx="2.5" fill="#c86cf2" />
      <rect x="175" y="124" width="6" height="11" rx="2.5" fill="#c86cf2" />
      {/* hands on the keyboard */}
      <ellipse cx="140" cy="146" rx="8" ry="4" fill="#0b0920" />
      <ellipse cx="180" cy="146" rx="8" ry="4" fill="#0b0920" />
    </svg>
  );
}
