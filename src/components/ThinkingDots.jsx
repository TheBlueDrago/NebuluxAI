import React from "react";

// Three bouncing dots shown while the AI is working on an answer.
export default function ThinkingDots({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="status" aria-label="Thinking">
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
