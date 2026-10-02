import React, { useEffect, useState } from "react";
import { ShieldCheck, Flag, ScrollText, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { adminCountries } from "../../../cloudflare-lib/audit.js";

const DAY = 86400000;

// Monitor's first card: the things worth a look every day. Open reports, how many admin
// actions happened in the last day, and the latest one (an action you didn't do means an
// admin account may be in the wrong hands; see the Admin log further down).
export default function SecurityGlance({ unconfirmed, removed, held }) {
  const [reports, setReports] = useState(null);
  // "Buying is paused" notice on the Shop and checkout (functions/site-status.js).
  const [paused, setPaused] = useState(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  useEffect(() => {
    base44.functions.invoke("site-status", {}).then((r) => setPaused(r.data?.paymentsPaused === true)).catch(() => {});
  }, []);
  const togglePaused = async () => {
    setPauseBusy(true);
    try {
      const r = await base44.functions.invoke("site-status", { action: "set", paymentsPaused: !paused });
      setPaused(r.data?.paymentsPaused === true);
    } catch {
      // unchanged
    } finally {
      setPauseBusy(false);
    }
  };
  const [log, setLog] = useState(null);

  useEffect(() => {
    base44.functions.invoke("admin-reports", { action: "count" }).then((r) => setReports(r.data?.open ?? 0)).catch(() => setReports("?"));
    base44.functions.invoke("admin-log", {}).then((r) => setLog(r.data?.entries || [])).catch(() => setLog([]));
  }, []);

  const recent = (log || []).filter((e) => Date.now() - Date.parse(e.at) < DAY);
  const last = (log || [])[0];
  const busy = recent.length >= 20;
  // Admin actions from more than one country (or through Tor) in the last 30 days.
  const countries = adminCountries(log);
  const elsewhere = countries.length > 1 || countries.includes("T1");

  return (
    <div className="w-full max-w-3xl mt-6 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
      <p className="text-slate-200 text-sm font-medium inline-flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-300" /> Security at a glance
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-3">
          <p className="text-xs text-slate-400 inline-flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Open reports</p>
          <p className={`text-lg font-semibold mt-1 ${reports > 0 ? "text-amber-300" : "text-white"}`}>{reports ?? "…"}</p>
        </div>
        <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-3">
          <p className="text-xs text-slate-400 inline-flex items-center gap-1.5"><ScrollText className="w-3.5 h-3.5" /> Admin actions, last 24h</p>
          <p className={`text-lg font-semibold mt-1 ${busy ? "text-amber-300" : "text-white"}`}>{log ? recent.length : "…"}</p>
        </div>
        <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 p-3 min-w-0">
          <p className="text-xs text-slate-400">Latest admin action</p>
          <p className="text-xs text-slate-200 mt-1 break-all">{last ? `${last.what} by ${last.by}` : log ? "None yet" : "…"}</p>
          {last && (
            <p className="text-[11px] text-slate-500">
              {new Date(last.at).toLocaleString()}
              {last.from ? ` · ${last.from}` : ""}
            </p>
          )}
        </div>
      </div>
      {paused !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>
            Shop notice: {paused ? <b className="text-amber-300">buying is paused</b> : <b className="text-white">off</b>}. Turn it on while payments are down.
          </span>
          <button
            onClick={togglePaused}
            disabled={pauseBusy}
            className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {paused ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}
      {unconfirmed !== undefined && (
        <p className="mt-3 text-xs text-slate-400">
          Sign-ups stopped: <b className="text-white">{unconfirmed}</b> never confirmed their email · <b className="text-white">{held}</b> on hold (too many
          accounts on one network) · <b className="text-white">{removed}</b> removed
        </p>
      )}
      {elsewhere && (
        <p className="mt-3 text-xs text-amber-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Admin actions in the last 30 days came from {countries.length > 1 ? `${countries.length} countries (${countries.join(", ")})` : "the Tor network"}. If you
            weren't travelling or using a VPN, someone else may be signed in as an admin: change your password now and check the Admin log.
          </span>
        </p>
      )}
      {busy && (
        <p className="mt-3 text-xs text-amber-300 inline-flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> A lot of admin actions today. If they weren't all you, change your password now and check the Admin log.
        </p>
      )}
    </div>
  );
}
