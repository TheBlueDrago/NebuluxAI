import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import usePageTitle from "@/hooks/usePageTitle";

// nebuluxai.com/status: whether Nebulux AI is working, for anyone to check (functions/.../status.js).
const STATES = {
  ok: [CheckCircle2, "text-emerald-400", "All systems working", "The AI is answering normally."],
  slow: [AlertTriangle, "text-amber-400", "The AI is busy", "Some answers are slow or need a retry. It usually clears up within an hour."],
  down: [XCircle, "text-red-400", "The AI is having trouble", "Most answers are failing right now. We're on it; please try again later."],
  unknown: [HelpCircle, "text-slate-400", "No data yet today", "Nobody has asked the AI anything yet today."],
};
const dayColor = (d) => {
  const all = d.ok + d.problems;
  if (!all) return "bg-slate-700";
  const bad = d.problems / all;
  return bad >= 0.6 ? "bg-red-500" : bad >= 0.2 ? "bg-amber-400" : "bg-emerald-500";
};

export default function Status() {
  usePageTitle("Status");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const load = () => base44.functions.invoke("status", {}).then((r) => (setData(r.data), setErr(false))).catch(() => setErr(true));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  const [Icon, color, title, text] = STATES[data?.state] || STATES.unknown;
  // The last 14 days, oldest first, with empty days filled in.
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push((data?.days || []).find((d) => d.day === day) || { day, ok: 0, problems: 0 });
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> Nebulux AI</Link>
        <h1 className="text-3xl font-bold text-white mt-6">Status</h1>
        {!data && !err && <div className="py-16 text-center"><Loader2 className="inline w-6 h-6 animate-spin text-slate-500" /></div>}
        {err && !data && <p className="mt-6 text-slate-400">Couldn't check right now. If this page loads, the website itself is up.</p>}
        {data && (
          <>
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex items-start gap-4">
              <Icon className={`w-8 h-8 shrink-0 ${color}`} />
              <div>
                <p className="text-lg font-semibold text-white">{title}</p>
                <p className="text-sm text-slate-400 mt-0.5">{text}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3 text-sm">
              <p className="flex items-center justify-between"><span>Website</span><span className="text-emerald-400 font-medium">Working</span></p>
              <p className="flex items-center justify-between"><span>AI answers</span><span className={`${color} font-medium`}>{title === "All systems working" ? "Working" : title.replace("The AI is ", "")}</span></p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-sm font-medium text-white mb-3">AI answers, last 14 days</p>
              <div className="flex gap-1" aria-label="Last 14 days">
                {days.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.ok + d.problems ? Math.round((d.ok / (d.ok + d.problems)) * 100) + "% worked" : "no data"}`} className={`h-9 flex-1 rounded ${dayColor(d)}`} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2"><span>14 days ago</span><span>Today</span></div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{data.checkedAt ? `Checked ${new Date(data.checkedAt).toLocaleTimeString()} · ` : ""}Updates every minute. Still having trouble? <Link to="/contact" className="underline">Contact us</Link>.</p>
          </>
        )}
      </div>
    </div>
  );
}
