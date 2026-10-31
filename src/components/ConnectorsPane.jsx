import React, { useEffect, useState } from "react";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";
import { connectCall, rememberApps, CATS } from "@/lib/connectors";
import { showNotice, askConfirm } from "@/lib/dialogs";

// Settings → Connectors: every app Nebulux can work with, grouped like the rest of Settings.
// Connect sends the person to the app's own permission page and back; a connected app shows who it's
// connected as and, opened, what Nebulux sees there. Apps the owner hasn't finished setting up show
// "Coming soon" and start working as soon as they are (functions/v1/connect).
const Logo = ({ k, size = 28 }) => (
  <span className="shrink-0 grid place-items-center rounded-lg border border-[var(--cl-border)]" style={{ width: size + 8, height: size + 8, background: "#fff" }}>
    <img src={`/logos/${k}.svg`} alt="" style={{ width: size - 6, height: size - 6 }} />
  </span>
);
const Pill = ({ children, onClick, strong }) => (
  <button onClick={onClick} className={`rounded-lg px-3 py-1.5 text-[13.5px] shrink-0 ${strong ? "bg-[var(--cl-text)] text-[var(--cl-bg)] font-medium" : "border border-[var(--cl-border)] text-[var(--cl-text)] hover:bg-[var(--cl-hover)]"}`}>{children}</button>
);
// What to ask in a chat once an app is connected. Each one uses words the chat listens for
// (ASK in cloudflare-lib/apps.js, src/lib/appIntent.js), so it really reads or sends.
const TRY = {
  gmail: ["What are my unread emails about?"], calendar: ["What's on my calendar this week?"], drive: ["What's new in my Google Drive?"],
  tasks: ["What's on my Google Tasks list?"], youtube: ["Which YouTube channels do I follow?"], contacts: ["What's the email address of Sam?"],
  github: ["Which pull requests are open on my GitHub?"], notion: ["What's in my Notion notes about the science fair?", "Summarize my latest Notion pages"],
  slack: ["What's new in Slack?"], spotify: ["What was I listening to on Spotify?"], discord: ["Post See you at 5! to my Discord"],
  dropbox: ["Find my tax files in Dropbox"], todoist: ["What's on my Todoist today?", "Add buy milk to my Todoist"], asana: ["What's due in Asana this week?"],
  linear: ["What are my Linear issues?"], zoom: ["When is my next Zoom meeting?"], twitch: ["Who's live on Twitch right now?"],
  outlook: ["What's new in my Outlook email?"], onedrive: ["What's new in my OneDrive?"], mstodo: ["What's on my Microsoft To Do list?"],
  x: ["What did I tweet lately?"], reddit: ["What's new on my subreddits?"], pinterest: ["What's on my Pinterest boards?"], tiktok: ["How are my TikTok videos doing?"], instagram: ["How are my Instagram posts doing?"],
};

export default function ConnectorsPane({ children }) {
  const [apps, setApps] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState("");
  const [seen, setSeen] = useState(null);
  const [draft, setDraft] = useState({ text: "", where: "" });
  // WhatsApp linking: the code to send from their WhatsApp, until it arrives (or 15 minutes pass)
  const [wa, setWa] = useState(null);

  const load = () => connectCall({ action: "list" }).then((d) => { setApps(d.apps || []); rememberApps(d.apps || []); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const app = apps && apps.find((a) => a.k === open);
  const look = (k) => { setSeen({ loading: true }); connectCall({ action: "read", app: k }).then(setSeen).catch((e) => { setSeen({ error: e.message }); if (e.data && e.data.reconnect) load(); }); };
  useEffect(() => { setSeen(null); setDraft({ text: "", where: "" }); if (app && app.connected && app.k !== "whatsapp") look(app.k); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (a) => {
    try {
      const d = await connectCall({ action: "start", app: a.k, back: window.location.origin + window.location.pathname });
      if (d.url) window.location.href = d.url;
      else if (d.code) { setWa({ ...d, until: Date.now() + 15 * 60 * 1000 }); setOpen(a.k); }
      else { showNotice(`${a.n} is on.`); load(); }
    } catch (e) { showNotice(e.message); }
  };
  // Waiting for the code to come in from their WhatsApp: check every few seconds.
  useEffect(() => {
    if (!wa) return;
    const t = setInterval(async () => {
      if (Date.now() > wa.until) { setWa(null); return; }
      try {
        const d = await connectCall({ action: "list" });
        setApps(d.apps || []);
        rememberApps(d.apps || []);
        if ((d.apps || []).some((a) => a.k === "whatsapp" && a.linked)) { setWa(null); showNotice("Your WhatsApp is linked."); }
      } catch { /* try again on the next tick */ }
    }, 4000);
    return () => clearInterval(t);
  }, [wa]);
  const disconnect = async (a) => {
    if (!(await askConfirm(`Disconnect ${a.n}? Nebulux AI and Nebulux Orbit will stop using it.`, { confirmLabel: "Disconnect", danger: true }))) return;
    try { await connectCall({ action: "disconnect", app: a.k }); setOpen(""); load(); } catch (e) { showNotice(e.message); }
  };
  const send = async (a, w) => {
    const text = draft.text.trim();
    if (!text) return showNotice("Write something to send first.");
    if (w.where && !draft.where) return showNotice("Pick where it goes first.");
    if (!(await askConfirm(`${w.label} in ${a.n}?\n\n"${text.slice(0, 300)}"`, { confirmLabel: "Send" }))) return;
    try { await connectCall({ action: "write", app: a.k, op: w.op, text, where: draft.where, confirmed: true }); setDraft({ text: "", where: draft.where }); showNotice("Sent."); } catch (e) { showNotice(e.message); }
  };

  const right = (a) =>
    a.status === "reconnect" ? <Pill strong onClick={() => connect(a)}>Reconnect</Pill>
      : a.k === "whatsapp" && a.link && !a.linked ? <Pill onClick={() => connect(a)}>{a.connected ? "Link my number" : "Connect"}</Pill>
      : a.connected ? <span className="text-[13px] text-emerald-500 shrink-0">Connected</span>
      : a.ready ? <Pill onClick={() => connect(a)}>Connect</Pill>
      : <span className="text-[12.5px] text-[var(--cl-muted)] shrink-0">Coming soon</span>;
  const row = (a) => (
    <button key={a.k} onClick={() => setOpen(a.k)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--cl-hover)] min-h-[56px]">
      <Logo k={a.k} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] text-[var(--cl-text)] truncate">{a.n}</span>
        <span className="block text-[13px] text-[var(--cl-muted)] truncate">{a.connected ? (a.account ? `Connected as ${a.account}` : "Connected") : a.about}</span>
      </span>
      {right(a)}
      <ChevronRight className="w-4 h-4 text-[var(--cl-muted)] shrink-0" />
    </button>
  );

  if (app) {
    const writes = app.connected ? app.writes || [] : [];
    const places = ((seen && seen.sections) || []).flatMap((s) => s.items).filter((i) => i.id);
    return (
      <>
        <button onClick={() => setOpen("")} className="flex items-center gap-1 text-[13.5px] text-[var(--cl-muted)] hover:text-[var(--cl-text)] mb-4"><ChevronLeft className="w-4 h-4" /> All connectors</button>
        <div className="flex items-center gap-3">
          <Logo k={app.k} size={36} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[19px] font-semibold text-[var(--cl-text)]">{app.n}</h2>
            <p className="text-[13.5px] text-[var(--cl-muted)]">{app.connected ? (app.account ? `Connected as ${app.account}` : "Connected") : app.about}</p>
          </div>
          {app.connected && !(app.k === "whatsapp" && app.link && !app.linked) ? <Pill onClick={() => disconnect(app)}>Disconnect</Pill> : right(app)}
        </div>
        {app.k === "whatsapp" && wa && (
          <div className="mt-5 rounded-xl border border-[var(--cl-border)] p-4">
            <p className="text-[14px] text-[var(--cl-text)]">Send this code to Nebulux from your WhatsApp:</p>
            <p className="my-2 text-[28px] font-semibold tracking-[0.2em] text-[var(--cl-text)] tabular-nums">{wa.code}</p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={wa.link} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-1.5 text-[13.5px] bg-[var(--cl-text)] text-[var(--cl-bg)] font-medium">Open WhatsApp</a>
              <span className="text-[13px] text-[var(--cl-muted)]">Waiting for your message… The code works for 15 minutes.</span>
            </div>
            {wa.number && <p className="mt-2 text-[12.5px] text-[var(--cl-muted)]">Nebulux's WhatsApp number: +{wa.number}</p>}
          </div>
        )}
        {app.status === "reconnect" && <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13.5px] text-[var(--cl-text)]">Nebulux's permission for {app.n} stopped working (it may have been taken back at {app.n}). Press Reconnect.</p>}
        {!app.ready && !app.connected && <p className="mt-4 text-[13.5px] text-[var(--cl-muted)]">{app.n} is coming soon to Nebulux. It'll work here as soon as it's ready.</p>}
        <p className="mt-5 text-[13.5px] text-[var(--cl-muted)]">
          {app.k === "whatsapp" && app.linked
            ? "Your WhatsApp is linked. Chat with Nebulux AI there any time, and in any chat say \"send this to my WhatsApp\" (or press the WhatsApp button under a reply). WhatsApp only lets Nebulux message you within 24 hours of your last message to it. Send STOP there to unlink."
            : app.k === "whatsapp" && app.link
            ? "Link your WhatsApp to chat with Nebulux AI there and send replies to yourself. Press Connect, then send the code from your WhatsApp. Nebulux only messages your own number, and can't see your other chats."
            : app.k === "whatsapp"
            ? "When it's on, every reply gets a Send to WhatsApp button that opens WhatsApp with the reply ready. You pick the chat and press send there."
            : `Ask about ${app.n} in any chat and Nebulux reads it first. It's shared with Nebulux Orbit, so you only connect once.${writes.length ? " Nothing is sent or posted until you press Send." : " Nebulux only reads it."}`}
        </p>
        {writes.map((w) => (
          <div key={w.op} className="mt-5 rounded-xl border border-[var(--cl-border)] p-4">
            <p className="text-[15px] text-[var(--cl-text)] mb-2">{w.label}</p>
            {w.where && (
              <select value={draft.where} onChange={(e) => setDraft({ ...draft, where: e.target.value })} className="w-full mb-2 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-bg)] text-[var(--cl-text)] px-3 py-2 text-[14px]">
                <option value="">Pick a {w.where}</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.t}</option>)}
              </select>
            )}
            <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={3} placeholder="Write it here" className="w-full rounded-lg border border-[var(--cl-border)] bg-[var(--cl-bg)] text-[var(--cl-text)] px-3 py-2 text-[14px] resize-y" />
            <div className="mt-2 flex justify-end"><Pill strong onClick={() => send(app, w)}>Send</Pill></div>
          </div>
        ))}
        {app.connected && TRY[app.k] && (
          <div className="mt-5">
            <p className="text-[12.5px] uppercase tracking-wide text-[var(--cl-muted)] mb-1">Try asking in a chat</p>
            <ul className="space-y-1">
              {TRY[app.k].map((t) => <li key={t} className="text-[14px] text-[var(--cl-text)]">"{t}"</li>)}
            </ul>
          </div>
        )}
        {app.connected && app.k !== "whatsapp" && (
          <div className="mt-6">
            <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold text-[var(--cl-text)]">What Nebulux sees</h3><Pill onClick={() => look(app.k)}>Refresh</Pill></div>
            {!seen || seen.loading ? <p className="mt-3 text-[13.5px] text-[var(--cl-muted)]">Loading…</p>
              : seen.error ? <p className="mt-3 text-[13.5px] text-red-400">{seen.error}</p>
              : (seen.sections || []).length === 0 ? <p className="mt-3 text-[13.5px] text-[var(--cl-muted)]">Nothing there yet.</p>
              : seen.sections.map((s) => (
                <div key={s.title} className="mt-4">
                  <p className="text-[12.5px] uppercase tracking-wide text-[var(--cl-muted)] mb-1">{s.title}</p>
                  <div className="rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)]">
                    {s.items.map((i, n) => (
                      <div key={n} className="px-3 py-2 min-w-0">
                        <p className="text-[14px] text-[var(--cl-text)] [overflow-wrap:anywhere]">{i.t}</p>
                        {i.s && <p className="text-[12.5px] text-[var(--cl-muted)] [overflow-wrap:anywhere]">{i.s}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </>
    );
  }

  const ql = q.trim().toLowerCase();
  const list = (apps || []).filter((a) => !ql || (a.n + " " + a.cat + " " + a.about).toLowerCase().includes(ql));
  const on = list.filter((a) => a.connected);
  return (
    <>
      <h2 className="text-[17px] font-semibold text-[var(--cl-text)] mb-1">Connectors</h2>
      <p className="text-[14px] text-[var(--cl-muted)]">Let Nebulux work with the apps you use. Connect an app once and it works in Nebulux AI and Nebulux Orbit.</p>
      <label className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--cl-border)] px-3 py-2">
        <Search className="w-4 h-4 text-[var(--cl-muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connectors" className="flex-1 bg-transparent outline-none text-[14px] text-[var(--cl-text)] placeholder:text-[var(--cl-muted)]" />
      </label>
      {!ql && children}
      {err && <p className="mt-4 text-[13.5px] text-red-400">{err}</p>}
      {!apps && !err && <p className="mt-4 text-[13.5px] text-[var(--cl-muted)]">Loading…</p>}
      {on.length > 0 && !ql && (
        <>
          <p className="mt-6 mb-2 text-[12.5px] uppercase tracking-wide text-[var(--cl-muted)]">Connected</p>
          <div className="rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)] overflow-hidden">{on.map(row)}</div>
        </>
      )}
      {CATS.map((cat) => {
        // apps that work come first; "Coming soon" ones after (the sort keeps each group's order)
        const l = list.filter((a) => a.cat === cat && (ql || !a.connected)).sort((a, b) => Number(!!b.ready) - Number(!!a.ready));
        return l.length ? (
          <div key={cat}>
            <p className="mt-6 mb-2 text-[12.5px] uppercase tracking-wide text-[var(--cl-muted)]">{cat}</p>
            <div className="rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)] overflow-hidden">{l.map(row)}</div>
          </div>
        ) : null;
      })}
      {apps && ql && !list.length && <p className="mt-4 text-[13.5px] text-[var(--cl-muted)]">No connector matches.</p>}
    </>
  );
}
