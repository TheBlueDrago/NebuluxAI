import React, { useEffect, useState } from "react";
import { Mail, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TOPIC = { account: "Account", billing: "Billing", bug: "Bug", ai: "AI reply", security: "Security", parent: "Parent / teacher", idea: "Idea", business: "Business", partnership: "Partnership / investor", other: "Other" };

// Monitor → messages sent from the /contact page (functions/contact.js).
export default function Messages() {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const call = async (body) => {
    setError("");
    try {
      const r = await base44.functions.invoke("contact", body);
      if (r.data?.error) throw new Error(r.data.error);
      const list = r.data?.messages || [];
      // Security reports first, then parents and teachers, then reported AI replies, then the rest.
      const rank = (m) => ({ security: 0, parent: 1, ai: 2 })[m.topic] ?? 3;
      setMessages(list.map((m, i) => [m, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([m]) => m));
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Could not load messages.");
    }
  };

  useEffect(() => {
    call({ action: "list" });
  }, []);

  const done = async (id) => {
    setBusy(id);
    await call({ action: "done", id });
    setBusy("");
  };

  return (
    <div className="w-full max-w-3xl mt-10">
      <p className="text-slate-300 text-sm font-medium mb-3 inline-flex items-center gap-2">
        <Mail className="w-4 h-4 text-indigo-300" /> Messages
        {messages?.length > 0 && <span className="text-[11px] bg-indigo-500/20 text-indigo-300 rounded-full px-2 py-0.5">{messages.length}</span>}
      </p>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!messages ? (
        !error && <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      ) : messages.length === 0 ? (
        <p className="text-slate-500 text-sm">No messages.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2.5 border ${m.topic === "security" ? "bg-rose-500/10 border-rose-400/40" : "bg-slate-800/60 border-slate-700/50"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] bg-slate-700/60 text-slate-300 rounded px-1.5 py-0.5">{TOPIC[m.topic] || m.topic}</span>
                {m.email ? (
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to Nebulux AI")}`} className="text-sm text-sky-300 hover:underline break-all">
                    {m.name ? `${m.name} · ` : ""}{m.email}
                  </a>
                ) : (
                  <span className="text-sm text-slate-400">No email</span>
                )}
                <span className="text-[11px] text-slate-500">{new Date(m.at).toLocaleString()}</span>
                <button
                  onClick={() => done(m.id)}
                  disabled={!!busy}
                  className="ml-auto inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-300 disabled:opacity-50"
                >
                  {busy === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Done
                </button>
              </div>
              <p className="text-sm text-slate-200 mt-1.5 whitespace-pre-wrap break-words">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
