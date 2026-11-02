import React, { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Shuffle } from "lucide-react";
import { parseFlashcards } from "@/lib/flashcards";

// Flip-through cards made from a ```flashcards block in an AI reply (lib/flashcards.js).
export default function Flashcards({ text }) {
  const [cards, setCards] = useState(() => parseFlashcards(text));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => new Set());
  if (!cards.length) return <pre className="bg-black/40 border border-slate-700/60 rounded-lg p-3 text-[12.5px] whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</pre>;

  const go = (d) => {
    setFlipped(false);
    setI((n) => (n + d + cards.length) % cards.length);
  };
  const card = cards[i];
  return (
    <div className="my-2 rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
        <span>
          Card {i + 1} of {cards.length} · {known.size} known
        </span>
        <button
          type="button"
          onClick={() => {
            setCards((c) => [...c].sort(() => Math.random() - 0.5));
            setI(0);
            setFlipped(false);
            setKnown(new Set());
          }}
          className="inline-flex items-center gap-1 hover:text-white"
          aria-label="Shuffle the cards"
        >
          <Shuffle className="w-3.5 h-3.5" /> Shuffle
        </button>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className={`w-full min-h-[120px] rounded-xl px-4 py-5 text-center transition-colors ${flipped ? "bg-emerald-500/10 border border-emerald-500/40" : "bg-indigo-500/10 border border-indigo-500/40"}`}
      >
        <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">{flipped ? "Answer" : "Question"}</span>
        <span className="block text-base text-white">{flipped ? card.a : card.q}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
          <RotateCw className="w-3 h-3" /> Tap to flip
        </span>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous card" className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setKnown((k) => {
              const n = new Set(k);
              if (n.has(i)) n.delete(i);
              else n.add(i);
              return n;
            });
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${known.has(i) ? "bg-emerald-600 text-[#fff]" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
        >
          {known.has(i) ? "✓ I know this" : "I know this"}
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next card" className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
