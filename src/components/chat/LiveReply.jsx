import React from "react";
import BlackholeIcon from "@/components/BlackholeIcon";

const CODE_START = /```|<<<FIND|<!doctype html|<html[\s>]/i;

// A designer reply while it's still streaming: the AI's explanation as it's written,
// then a progress line once it starts writing code (the code itself goes to the preview).
export default function LiveReply({ text, accent = "text-sky-300", label = "Writing the code" }) {
  const i = text.search(CODE_START);
  const intro = (i >= 0 ? text.slice(0, i) : text).trim();
  const codeKb = i >= 0 ? Math.max(1, Math.round((text.length - i) / 1024)) : 0;
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800 text-slate-100 border border-slate-700/50 text-sm space-y-2">
        {intro && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{intro}</p>}
        {i >= 0 && (
          <p className={`flex items-center gap-2 font-medium ${accent}`}>
            <BlackholeIcon className="w-4 h-4 animate-spin" />
            {label}… {codeKb} KB
          </p>
        )}
      </div>
    </div>
  );
}
