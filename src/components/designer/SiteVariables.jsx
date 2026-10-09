import React, { useEffect, useState } from "react";
import { KeyRound, Type, Trash2, Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { askConfirm } from "@/lib/dialogs";

// Website Designer → Dashboard → Variables (functions/site-vars.js, cloudflare-lib/sitevars.js).
// Text: {{NAME}} on the page shows the value. Secret: stays on our server; the page uses it
// through NebuluxFetch, e.g. an API key in a header, so visitors never see it.
export default function SiteVariables({ site }) {
  const [vars, setVars] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", type: "text", value: "" });
  const [peek, setPeek] = useState(false);
  const call = (body) => base44.functions.invoke("site-vars", { site, ...body }).then((r) => { setVars(r.data?.vars || []); setErr(""); }).catch((e) => setErr(e?.response?.data?.error || "Something went wrong."));
  useEffect(() => { call({}); }, [site]);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    await call({ action: "set", ...form });
    setBusy(false);
    setForm((f) => ({ ...f, name: "", value: "" }));
  };
  const remove = async (name) => {
    if (await askConfirm(`Delete ${name}? Pages using it will stop working until you add it again.`)) call({ action: "delete", name });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-semibold text-white">Variables</p>
        <p className="text-[13px] text-slate-400 mt-0.5">Values your website uses without putting them in its code. Publish the site first.</p>
      </div>

      <form onSubmit={add} className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 space-y-3">
        <div className="flex gap-2">
          {[["text", "Text", Type], ["secret", "Secret", KeyRound]].map(([t, label, Icon]) => (
            <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] ${form.type === t ? "border-sky-500/70 bg-sky-500/10 text-white" : "border-slate-700 text-slate-400 hover:text-white"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }))} placeholder={form.type === "secret" ? "API_KEY" : "PHONE_NUMBER"} maxLength={40}
            className="w-44 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[13px] text-slate-100 font-mono outline-none focus:border-sky-500" />
          <div className="relative flex-1 min-w-[180px]">
            <input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} type={form.type === "secret" && !peek ? "password" : "text"} placeholder="Value" autoComplete="off"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-9 text-[13px] text-slate-100 outline-none focus:border-sky-500" />
            {form.type === "secret" && <button type="button" onClick={() => setPeek((p) => !p)} className="absolute right-2 top-2 text-slate-500 hover:text-white">{peek ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
          </div>
          <button disabled={busy || !form.name} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-2 text-[13px] font-medium text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save
          </button>
        </div>
        <p className="text-[12px] text-slate-500">
          {form.type === "secret"
            ? "Secrets are never shown again or sent to visitors. Use them in requests: NebuluxFetch(\"https://api.example.com/x\", { headers: { Authorization: \"Bearer {{API_KEY}}\" } })"
            : "Write {{NAME}} anywhere on the page and visitors see the value. Scripts can also read window.NebuluxVars.NAME."}
        </p>
      </form>

      {err && <p className="text-[13px] text-amber-300">{err}</p>}
      {vars === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      ) : vars.length === 0 ? (
        <p className="text-[13px] text-slate-400">No variables yet.</p>
      ) : (
        <div className="rounded-xl border border-slate-700/60 divide-y divide-slate-800 overflow-hidden">
          {vars.map((v) => (
            <div key={v.name} className="flex items-center gap-3 bg-slate-900/70 px-4 py-2.5">
              {v.type === "secret" ? <KeyRound className="w-4 h-4 text-amber-300" /> : <Type className="w-4 h-4 text-sky-300" />}
              <span className="font-mono text-[13px] text-white">{v.name}</span>
              <span className="flex-1 min-w-0 truncate text-[13px] text-slate-400">{v.type === "secret" ? "•••••••• (secret)" : v.value}</span>
              <button onClick={() => setForm({ name: v.name, type: v.type, value: v.type === "secret" ? "" : v.value })} className="text-[12px] text-slate-400 hover:text-white">Edit</button>
              <button onClick={() => remove(v.name)} className="text-slate-500 hover:text-red-300" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
