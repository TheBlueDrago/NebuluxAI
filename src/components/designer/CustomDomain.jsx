import React, { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Loader2, X, RefreshCw, Copy, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppShell } from "@/components/AppShellContext";
import { hasProFeatures } from "@/lib/plans";

// Connect your own domain (www.mybakery.com) to your published website: Pro and up, not the
// free trial week. The server side is functions/.../custom-domain.js.
// No button of its own: it opens from the Publish box (openKey).
export default function CustomDomain({ siteName, plan, onUpgrade, openKey = 0, initialHost = "" }) {
  const shell = useAppShell();
  const trial = shell?.credits?.planSource === "trial";
  const allowed = hasProFeatures(plan) && !trial;
  const [open, setOpen] = useState(false);
  // Opened from the Publish box right after publishing, with the domain they typed there.
  useEffect(() => {
    if (openKey) setOpen(true);
  }, [openKey]);
  return (
    open && <DomainDialog key={openKey} siteName={siteName} allowed={allowed} trial={trial} onUpgrade={onUpgrade} initialHost={initialHost} onClose={() => setOpen(false)} />
  );
}


// Where each domain seller keeps its DNS settings, so people know exactly where to go.
const SELLERS = {
  godaddy: { name: "GoDaddy", where: "Sign in to GoDaddy, go to My Products, find your domain and click DNS (Manage DNS). Click Add New Record" },
  namecheap: { name: "Namecheap", where: "Sign in to Namecheap, open Domain List, click Manage next to your domain, then the Advanced DNS tab. Click Add New Record" },
  porkbun: { name: "Porkbun", where: "Sign in to Porkbun, open Domain Management, and click DNS under your domain" },
  cloudflare: { name: "Cloudflare", where: "Sign in to Cloudflare, pick your domain, open DNS, then Records, and click Add record. Set Proxy status to DNS only (grey cloud)" },
  squarespace: { name: "Squarespace (Google Domains)", where: "Sign in to Squarespace, open Domains, pick your domain, then DNS, then DNS Settings. Add a custom record" },
  ionos: { name: "IONOS", where: "Sign in to IONOS, open Domains & SSL, click the gear next to your domain, then DNS, and Add record" },
  hostinger: { name: "Hostinger", where: "Sign in to Hostinger, open Domains, click Manage next to your domain, then DNS / Nameservers" },
  wix: { name: "Wix", where: "Sign in to Wix, open Domains, click the ... next to your domain, then Manage DNS Records" },
  other: { name: "Somewhere else", where: "Sign in where you bought the domain and look for DNS settings (sometimes called DNS Records, Zone Editor or Advanced DNS)" },
};
const call = (body) =>
  base44.functions.invoke("custom-domain", body).then(
    (r) => r.data,
    (e) => {
      throw new Error(e?.response?.data?.error || "Something went wrong. Try again.");
    }
  );

function CopyText({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      })}
      className="ml-1 inline-flex items-center rounded p-1 text-slate-400 hover:text-white"
      aria-label="Copy"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DomainDialog({ siteName, allowed, trial, onUpgrade, initialHost, onClose }) {
  const [info, setInfo] = useState(null);
  const [host, setHost] = useState(initialHost || "");
  const [seller, setSeller] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const autoAdd = useRef(initialHost || "");
  const load = useCallback(() => {
    if (!allowed || !siteName) return;
    setErr("");
    setBusy(true);
    call({ action: "get", site: siteName })
      .then((r) => {
        // Came from the Publish box with a domain: connect it straight away (once).
        const h = autoAdd.current;
        autoAdd.current = "";
        if (!r.domain && h) return call({ action: "add", site: siteName, hostname: h });
        return r;
      })
      .then(setInfo)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [allowed, siteName]);
  useEffect(load, [load]);

  const run = (body) => {
    setErr("");
    setBusy(true);
    call({ ...body, site: siteName })
      .then((r) => {
        setInfo(r);
        if (r.error) setErr(r.error); // e.g. the TXT record isn't there yet
      })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  };

  const d = info?.domain;
  const root = d ? d.split(".").slice(-2).join(".") : "";
  const sub = d ? d.split(".").slice(0, -2).join(".") : "";
  // Sellers want the name without the main domain ("_nebulux-verify.www", not the full name).
  const rel = (name) => (name.endsWith(`.${root}`) ? name.slice(0, -(root.length + 1)) : name);
  const verifying = info?.status === "verify";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 text-sm text-slate-200 shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-300" /> Your own domain
        </h2>
        <p className="mt-1 text-slate-400">Show this website at an address you own, like www.mybakery.com, with a secure https:// connection.</p>

        {!allowed ? (
          <div className="mt-4 rounded-xl bg-indigo-500/10 border border-indigo-400/30 p-4">
            <p>{trial ? "Custom domains are for paid plans. Your free week of Pro doesn't include them." : "Custom domains come with Pro and higher plans."}</p>
            <button onClick={onUpgrade} className="mt-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-semibold text-[#fff]">
              See plans
            </button>
          </div>
        ) : !siteName ? (
          <p className="mt-4 text-amber-200">Publish your website first, then come back to connect a domain.</p>
        ) : !info && busy ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-300" />
          </div>
        ) : !d ? (
          <div className="mt-4 space-y-3">
            <p className="text-slate-300">You need a domain first (from a seller like Namecheap, GoDaddy, Porkbun or Cloudflare). Then type it here:</p>
            <div className="flex gap-2">
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="www.mybakery.com"
                className="flex-1 min-w-0 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white outline-none focus:border-indigo-400"
              />
              <button disabled={busy || !host.trim()} onClick={() => run({ action: "add", hostname: host })} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 font-semibold text-[#fff] disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Tip: use www.yourdomain.com. It works with every domain seller.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white break-all">{d}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.live ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                {info.live ? "Live" : verifying ? "Prove it's yours" : info.status === "securing" ? "Almost ready" : "Waiting for your DNS"}
              </span>
            </div>
            {info.live ? (
              <p>
                Your website is live at{" "}
                <a href={`https://${d}`} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">
                  https://{d}
                </a>
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-slate-300">Where did you buy your domain?</span>
                  <select value={seller} onChange={(e) => setSeller(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white outline-none">
                    <option value="">Pick one…</option>
                    {Object.entries(SELLERS).map(([k, s]) => (
                      <option key={k} value={k}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-slate-300">
                  {seller ? SELLERS[seller].where : "At the company you bought the domain from, open its DNS settings"}, then add {verifying ? "these two records" : "this record"}:
                </p>
                {verifying && (
                  <div className="rounded-lg bg-slate-800 border border-amber-400/30 p-3 font-mono text-xs space-y-1">
                    <p className="font-sans text-amber-200 font-semibold">1. Prove the domain is yours</p>
                    <p>Type: <b>TXT</b></p>
                    <p>Name / Host: <b className="break-all">{rel(info.verify.name)}</b><CopyText text={rel(info.verify.name)} /></p>
                    <p>Value: <b className="break-all">{info.verify.value}</b><CopyText text={info.verify.value} /></p>
                  </div>
                )}
                <div className="rounded-lg bg-slate-800 border border-slate-700 p-3 font-mono text-xs space-y-1">
                  {verifying && <p className="font-sans text-slate-300 font-semibold">2. Point it at your website</p>}
                  <p>Type: <b>CNAME</b></p>
                  <p>Name / Host: <b>{sub || "@"}</b><CopyText text={sub || "@"} /></p>
                  <p>Value / Target: <b>{info.target}</b><CopyText text={info.target} /></p>
                </div>
                {info.apex && <p className="text-xs text-amber-200">This is a main domain (no www). Some sellers don't allow a CNAME there. If yours doesn't, remove it and use www.{d} instead.</p>}
                {verifying && <p className="text-xs text-slate-400">Only the owner of a domain can add records to it, so this proves it's yours. Once both are added, press Verify.</p>}
                {info.txt && (
                  <div className="rounded-lg bg-slate-800 border border-slate-700 p-3 font-mono text-xs space-y-1">
                    <p className="font-sans text-slate-300">And this one, to prove the domain is yours:</p>
                    <p>Type: <b>TXT</b></p>
                    <p>Name / Host: <b className="break-all">{info.txt.name}</b><CopyText text={info.txt.name} /></p>
                    <p>Value: <b className="break-all">{info.txt.value}</b><CopyText text={info.txt.value} /></p>
                  </div>
                )}
                <p className="text-xs text-slate-400">It can take from a few minutes to a few hours to start working. Press Check again any time.</p>
              </>
            )}
            <div className="flex gap-2 pt-1">
              {verifying ? (
                <button disabled={busy} onClick={() => run({ action: "verify" })} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-[#fff]">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Verify
                </button>
              ) : (
                <button disabled={busy} onClick={load} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-700">
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Check again
                </button>
              )}
              <button disabled={busy} onClick={() => run({ action: "remove" })} className="rounded-lg px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                Remove domain
              </button>
            </div>
          </div>
        )}
        {err && <p className="mt-3 text-red-400">{err}</p>}
      </div>
    </div>
  );
}
