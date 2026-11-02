import React, { useState } from "react";
import { Check, X, RotateCcw, Trophy } from "lucide-react";
import { parseQuiz } from "@/lib/quiz";

// A tap-to-answer quiz made from a ```quiz block in an AI reply (lib/quiz.js): one question at a
// time, right or wrong with the reason, and the score at the end.
export default function Quiz({ text }) {
  const [qs] = useState(() => parseQuiz(text));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  if (!qs.length) return <pre className="bg-black/40 border border-slate-700/60 rounded-lg p-3 text-[12.5px] whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</pre>;

  const done = i >= qs.length;
  if (done) {
    const pct = Math.round((score / qs.length) * 100);
    return (
      <div className="my-2 rounded-2xl border border-amber-500/40 bg-slate-900/60 p-4 text-center">
        <Trophy className="w-8 h-8 mx-auto text-amber-300" />
        <p className="mt-2 text-lg font-semibold text-white">
          {score} / {qs.length} right
        </p>
        <p className="text-sm text-slate-400">{pct === 100 ? "Perfect score!" : pct >= 60 ? "Nice work!" : "Keep practising, you'll get there."}</p>
        <button
          type="button"
          onClick={() => {
            setI(0);
            setPicked(null);
            setScore(0);
          }}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium hover:bg-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }

  const q = qs[i];
  const answered = picked !== null;
  return (
    <div className="my-2 rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-3">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
        <span>
          Question {i + 1} of {qs.length}
        </span>
        <span>Score: {score}</span>
      </div>
      <p className="text-[15px] text-white font-medium">{q.q}</p>
      <div className="mt-3 space-y-1.5">
        {q.options.map((o, k) => {
          const right = k === q.answer;
          const mine = k === picked;
          const tone = !answered
            ? "border-slate-700 bg-slate-800/70 hover:border-indigo-400"
            : right
              ? "border-emerald-500/70 bg-emerald-500/15"
              : mine
                ? "border-red-500/70 bg-red-500/15"
                : "border-slate-800 bg-slate-800/40 opacity-70";
          return (
            <button
              key={k}
              type="button"
              disabled={answered}
              onClick={() => {
                setPicked(k);
                if (right) setScore((s) => s + 1);
              }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl border text-sm text-slate-100 transition-colors ${tone}`}
            >
              <span className="w-5 text-slate-400 font-semibold">{"ABCDEF"[k]}</span>
              <span className="flex-1">{o}</span>
              {answered && right && <Check className="w-4 h-4 text-emerald-400" />}
              {answered && mine && !right && <X className="w-4 h-4 text-red-400" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3">
          <p className={`text-sm font-semibold ${picked === q.answer ? "text-emerald-300" : "text-red-300"}`}>{picked === q.answer ? "Correct!" : `Not quite: it's ${"ABCDEF"[q.answer]}.`}</p>
          {q.why && <p className="text-sm text-slate-300 mt-0.5">{q.why}</p>}
          <button
            type="button"
            onClick={() => {
              setI((n) => n + 1);
              setPicked(null);
            }}
            className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-[#fff] text-xs font-semibold hover:bg-indigo-500"
          >
            {i + 1 < qs.length ? "Next question" : "See my score"}
          </button>
        </div>
      )}
    </div>
  );
}
