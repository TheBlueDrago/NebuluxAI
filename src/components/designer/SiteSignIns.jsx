import React, { useEffect, useState } from "react";
import { Loader2, Trash2, Copy, Check, Lock, KeyRound, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { askConfirm, showNotice } from "@/lib/dialogs";
import { useAppShell } from "@/components/AppShellContext";

// Dashboard → Sign in: everyone who signed in to the published site with Google, and (Pro and
// up) the site's own Google sign-in screen instead of the Nebulux AI one.
// Server: functions/.../site-auth.js, cloudflare-lib/siteauth.js.
const CALLBACK = "https://nebuluxai.com/site-auth/callback";
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export default function SiteSignIns({ site }) {
  const shell = useAppShell();
  const [users, setUsers] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);

  const call = async (body, tag) => {
    setBusy(tag);
    setErr("");
    try {
      return (await base44.functions.invoke("site-auth", { site, ...body })).data;
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't load this. Please try again.");
      return null;
    } finally {
      setBusy("");
    }
  };
  useEffect(() => {
    call({ action: "users" }, "load").then((d) => setUsers(d?.users || []));
    call({ action: "config" }, "cfg").then((d) => d && (setCfg(d), setId(d.clientId || "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  const remove = async (email) => {
    if (!(await askConfirm(`Remove ${email} from this list? They can still sign in again.`))) return;
    const d = await call({ action: "remove", email }, "rm");
    if (d) setUsers(d.users || []);
  };
  const saveOwn = async () => {
    if (!cfg?.canOwn) {
      shell?.setUpgradeOpen({ title: "Upgrade to use your own sign-in screen", text: "With Pro or higher, the Google sign-in on your site shows your own app's name and logo instead of Nebulux AI." });
      return;
    }
    const d = await call({ action: "set-config", clientId: id, clientSecret: secret }, "save");
    if (d) { setCfg(d); setSecret(""); showNotice("Saved. Your site's Google sign-in now shows your own screen."); }
  };
  const clearOwn = async () => {
    if (!(await askConfirm("Go back to the Nebulux AI sign-in screen?"))) return;
    const d = await call({ action: "clear-config" }, "clear");
    if (d) { setCfg(d); setId(""); }
  };
  const csv = () => {
    const rows = [["Email", "Name", "First sign-in", "Last sign-in", "Sign-ins"], ...(users || []).map((u) => [u.email, u.name, u.first_at, u.last_at, u.count])];
    const text = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `${site}-sign-ins.csv`;
    a.click();
  };

  const field = "w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13.5px] outline-none focus:border-indigo-500 text-white";
  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="text-[19px] font-semibold text-white">Sign in</h2>
        <p className="text-[13px] text-slate-400 mt-0.5">People who signed in to your published site with Google. To add a sign-in button, ask the AI: "add Google sign-in".</p>
      </div>
      {err && <p className="text-[13px] text-amber-300">{err}</p>}

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <p className="text-[14px] font-semibold text-white">{users ? `${users.length} ${users.length === 1 ? "person" : "people"}` : "People"}</p>
          <button onClick={csv} disabled={!users?.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-[13px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"><Download className="w-4 h-4" /> Download</button>
        </div>
        {!users ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : users.length === 0 ? (
          <p className="p-4 text-[13px] text-slate-400">No one has signed in yet.</p>
        ) : (
          <div className="divide-y divide-slate-800 max-h-[50vh] overflow-y-auto">
            {users.map((u) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-2.5">
                {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">{(u.name || u.email)[0].toUpperCase()}</span>}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-slate-100 truncate">{u.name || u.email}</p>
                  <p className="text-[12px] text-slate-400 truncate">{u.email} · last {when(u.last_at)} · {u.count} sign-in{u.count === 1 ? "" : "s"}</p>
                </div>
                <button onClick={() => remove(u.email)} title="Remove from the list" aria-label={`Remove ${u.email}`} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-white flex items-center gap-2"><KeyRound className="w-4 h-4" /> Your own Google sign-in screen {!cfg?.canOwn && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 rounded-full px-2 py-0.5"><Lock className="w-3 h-3" /> Pro</span>}</p>
            <p className="text-[12.5px] text-slate-400 mt-0.5">{cfg?.own ? "On: visitors see your app's name and logo on Google's screen." : "Off: visitors see \"Nebulux AI\" on Google's screen."}</p>
          </div>
          {cfg?.own && <button onClick={clearOwn} className="rounded-lg border border-slate-600 px-3 py-1.5 text-[13px] text-slate-200 hover:bg-slate-800">Turn off</button>}
        </div>
        <ol className="mt-3 list-decimal pl-5 space-y-1 text-[12.5px] text-slate-300">
          <li>In Google Cloud Console, open <b>APIs &amp; Services → OAuth consent screen</b> and set your app's name and logo.</li>
          <li>Under <b>Credentials</b>, create an <b>OAuth client ID</b> (type: Web application).</li>
          <li>
            Add this as an <b>Authorized redirect URI</b>:
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-slate-950 border border-slate-700 px-1.5 py-0.5 font-mono text-[11.5px] text-indigo-200">
              {CALLBACK}
              <button onClick={async () => { try { await navigator.clipboard.writeText(CALLBACK); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* fine */ } }} aria-label="Copy the redirect address" className="text-slate-400 hover:text-white">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}</button>
            </span>
          </li>
          <li>Paste the client ID and client secret here.</li>
        </ol>
        <div className="mt-3 grid gap-2">
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="123456-abc.apps.googleusercontent.com" className={field} />
          <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" placeholder={cfg?.own ? "Client secret (saved; paste a new one to change it)" : "Client secret"} className={field} />
          <div className="flex justify-end">
            <button onClick={saveOwn} disabled={busy === "save" || (cfg?.canOwn && (!id || !secret))} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40">{busy === "save" ? "Saving…" : cfg?.canOwn ? "Save" : "Upgrade to use this"}</button>
          </div>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-2">The secret stays on Nebulux's servers and is never shown again.</p>
      </div>
    </div>
  );
}
