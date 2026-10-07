import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import CodePreview from "@/components/chat/CodePreview";
import { previewable } from "@/lib/codePreview";
import { prepareMath } from "@/lib/mathText";
import Flashcards from "@/components/chat/Flashcards";
import Quiz from "@/components/chat/Quiz";

// Copies text and briefly shows a tick.
export function CopyButton({ getText, className = "", label = "Copy" }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Clipboard blocked (e.g. insecure context); nothing to do.
    }
  };
  return (
    <button type="button" onClick={copy} title={label} aria-label={label} className={`inline-flex items-center gap-1 ${className}`}>
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// The code block's language ("language-html" → "html") and text, from the <code> inside.
const codeInfo = (children) => {
  const code = React.Children.toArray(children)[0];
  const lang = (/language-([\w-]+)/.exec(code?.props?.className || "") || [])[1] || "";
  const text = React.Children.toArray(code?.props?.children).join("");
  return { lang, text };
};

function CodeBlock({ children, noPreview }) {
  const ref = useRef(null);
  const { lang, text } = codeInfo(children);
  const canPreview = !noPreview && previewable(lang, text);
  if (lang === "flashcards") return <Flashcards text={text} />;
  if (lang === "quiz") return <Quiz text={text} />;
  return (
    <div className="relative group my-2">
      <pre ref={ref} className={`bg-black/40 border border-slate-700/60 rounded-lg p-3 pr-9 ${canPreview ? "pt-10" : ""} overflow-x-auto text-[12.5px] leading-snug`}>
        {children}
      </pre>
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {canPreview && <CodePreview getCode={() => ref.current?.innerText || text} />}
        <CopyButton getText={() => ref.current?.innerText || ""} label="Copy code" className="p-1 rounded-md bg-slate-800/90 text-slate-300 hover:text-white" />
      </div>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  code: ({ className, children }) =>
    className ? <code className={className}>{children}</code> : <code className="px-1 py-0.5 rounded bg-black/30 text-[0.92em]">{children}</code>,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="text-[12.5px] border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-600 [&_td]:border-slate-700 [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_th]:bg-slate-700/40 [&_th]:text-left">
        {children}
      </table>
    </div>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-sky-300 hover:text-sky-200">
      {children}
    </a>
  ),
};

// Math formulas: KaTeX is fetched the first time a reply has math, then kept.
let mathLoaded = null;
const loadMath = () => (mathLoaded ||= import("@/lib/mathPlugins"));

// Someone else's text (a shared chat): code is shown, never run, so nobody can put a fake
// sign-in page in a chat and send it around.
const safeComponents = { ...components, pre: (props) => <CodeBlock {...props} noPreview /> };

// AI replies rendered as Markdown (headings, lists, bold, code, math). Raw HTML in a reply
// is shown as text, never rendered (react-markdown's default). untrusted: no live previews.
export default function Markdown({ text, untrusted = false }) {
  const { text: shown, hasMath } = prepareMath(text);
  const [math, setMath] = useState(null);
  useEffect(() => {
    if (!hasMath || math) return;
    let alive = true;
    loadMath()
      .then((m) => alive && setMath(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [hasMath, math]);
  const useMath = hasMath && math;
  return (
    <div className="break-words [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-2 [&_h1]:mb-1 [&_h2]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-300 [&_hr]:my-3 [&_hr]:border-slate-700">
      <ReactMarkdown
        remarkPlugins={useMath ? [remarkGfm, math.remarkMathPlugin] : [remarkGfm]}
        rehypePlugins={useMath ? [math.rehypeKatexPlugin] : []}
        components={untrusted ? safeComponents : components}
      >
        {useMath ? shown : text || ""}
      </ReactMarkdown>
    </div>
  );
}
