import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Home, FlaskConical, BookOpen, Gauge, Plus, Copy, Check, Trash2, Loader2, ArrowLeft, Send, AlertTriangle, MoreHorizontal, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import BlackholeIcon from "@/components/BlackholeIcon";
import { askConfirm } from "@/lib/dialogs";

// The Nebulux Platform (nebuluxai.com/api): make API keys and use Nebulux AI from your own code.
// Keys: functions/.../api-keys.js; the API itself: functions/v1/chat.js (paid from prepaid per-AI balances, Billing).
const API_URL = "https://nebuluxai.com/v1/chat";
// id, name, what it's good at, price multiplier (Nebulux AI: $0.10 per request + $0.10 per reply credit)
const MODELS = [
  ["nebulux-ai", "Nebulux AI", "Fast, everyday answers.", 1],
  ["galaxy", "Galaxy", "Coding and harder questions.", 2],
  ["space", "Space", "Stronger reasoning.", 3],
  ["nebula", "Nebula", "The strongest model.", 5],
];
const NAV = [
  ["overview", "Overview", Home],
  ["keys", "API keys", KeyRound],
  ["playground", "Playground", FlaskConical],
  ["docs", "Docs", BookOpen],
  ["billing", "Billing", Gauge],
];
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never");

function CopyBtn({ text, label = "Copy" }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* fine */ } }} className="inline-flex items-center gap-1 rounded-md border border-[var(--cl-border)] px-2 py-1 text-[12px] text-[var(--cl-muted)] hover:text-[var(--cl-text)]">
      {ok ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {ok ? "Copied" : label}
    </button>
  );
}
function Code({ children, lang }) {
  return (
    <div className="rounded-xl border border-[var(--cl-border)] bg-[#0b0920] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--cl-border)] text-[12px] text-[var(--cl-faint)]">
        <span>{lang}</span>
        <CopyBtn text={children} />
      </div>
      <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed text-[#d9d3ff]"><code>{children}</code></pre>
    </div>
  );
}
const H = ({ children, sub }) => (
  <div className="mb-5">
    <h1 className="text-[26px] font-semibold text-[var(--cl-text)]">{children}</h1>
    {sub && <p className="text-[14px] text-[var(--cl-muted)] mt-1">{sub}</p>}
  </div>
);

const curl = (key) => `curl ${API_URL} \\
  -H "Authorization: Bearer ${key || "nx-sk-YOUR_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "nebulux-ai",
    "messages": [{ "role": "user", "content": "Write a haiku about space" }]
  }'`;
const js = (key) => `const res = await fetch("${API_URL}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key || "nx-sk-YOUR_KEY"}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "nebulux-ai",
    messages: [
      { role: "system", content: "You are a friendly helper." },
      { role: "user", content: "Write a haiku about space" },
    ],
  }),
});
const data = await res.json();
console.log(data.content);`;
const py = (key) => `import requests

r = requests.post(
    "${API_URL}",
    headers={"Authorization": "Bearer ${key || "nx-sk-YOUR_KEY"}"},
    json={
        "model": "nebulux-ai",
        "messages": [{"role": "user", "content": "Write a haiku about space"}],
    },
)
print(r.json()["content"])`;

export default function ApiPlatform() {
  const { isAuthenticated, user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [keys, setKeys] = useState(null);
  const [newKey, setNewKey] = useState(""); // the "Save your API key" window (shown once)
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false); // the Create Key window
  const [menuFor, setMenuFor] = useState(""); // the ••• menu on a row
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [bill, setBill] = useState(null); // API balance, agreement, history
  const [agreeTick, setAgreeTick] = useState(false);
  const [amount, setAmount] = useState(5);
  const [fundModel, setFundModel] = useState("nebulux-ai"); // which AI to add funds to
  const [grantAmt, setGrantAmt] = useState(5);
  const loadBill = () => base44.functions.invoke("api-billing", { action: "status" }).then((r) => setBill(r.data)).catch(() => setBill({}));
  const billCall = async (body, tag) => {
    setBusy(tag); setErr("");
    try { const d = (await base44.functions.invoke("api-billing", body)).data; setBill(d); return d; }
    catch (e) { setErr(e?.response?.data?.error || "Something went wrong. Please try again."); return null; }
    finally { setBusy(""); }
  };
  // playground
  const [pgKey, setPgKey] = useState("");
  const [pgModel, setPgModel] = useState("nebulux-ai");
  const [pgSystem, setPgSystem] = useState("");
  const [pgMsg, setPgMsg] = useState("Write a haiku about space");
  const [pgOut, setPgOut] = useState(null);

  useEffect(() => {
    document.title = "Nebulux Platform · API keys";
    if (!isAuthenticated) return;
    base44.functions.invoke("api-keys", { action: "list" }).then((r) => setKeys(r.data?.keys || [])).catch(() => setKeys([]));
    loadBill();
  }, [isAuthenticated]);

  const call = async (body, tag) => {
    setBusy(tag); setErr("");
    try { return (await base44.functions.invoke("api-keys", body)).data; }
    catch (e) { setErr(e?.response?.data?.error || "Something went wrong. Please try again."); return null; }
    finally { setBusy(""); }
  };
  const create = async () => {
    const d = await call({ action: "create", name: name.trim() || "My key" }, "create");
    if (d) { setKeys(d.keys); setNewKey(d.key); setPgKey(d.key); setName(""); setCreating(false); }
    else if (/agree|funds/i.test(err || "")) setCreating(false);
  };
  const revoke = async (k) => {
    if (!(await askConfirm(`Delete the key "${k.name}"? Apps using it stop working right away.`))) return;
    const d = await call({ action: "revoke", id: k.id }, k.id);
    if (d) setKeys(d.keys);
  };
  const run = async () => {
    setPgOut({ loading: true });
    const t0 = Date.now();
    try {
      const res = await fetch("/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pgKey.trim()}` },
        body: JSON.stringify({ model: pgModel, messages: [...(pgSystem.trim() ? [{ role: "system", content: pgSystem }] : []), { role: "user", content: pgMsg }] }),
      });
      const data = await res.json().catch(() => ({ error: { message: "No answer" } }));
      setPgOut({ status: res.status, data, ms: Date.now() - t0 });
      loadBill();
    } catch (e) {
      setPgOut({ status: 0, data: { error: { message: String(e.message || e) } }, ms: Date.now() - t0 });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--cl-bg)] text-[var(--cl-text)] flex flex-col items-center justify-center p-6 text-center">
        <BlackholeIcon className="w-14 h-14 mb-4" />
        <h1 className="text-3xl font-semibold">Nebulux Platform</h1>
        <p className="mt-2 text-[var(--cl-muted)] max-w-md">Use Nebulux AI in your own apps and code with an API key.</p>
        <Link to={`/login?returnTo=${encodeURIComponent("/api")}`} className="mt-6 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-5 py-2.5 font-medium">Sign in to get a key</Link>
      </div>
    );
  }

  const ready = !!(bill && bill.agreed && bill.funded && bill.total > 0);
  const balOf = (m) => (bill?.balanceTexts || {})[m] || "$0.00";
  const minOf = (m) => (bill?.minTopup || {})[m] || 2;
  const price = (m) => `${(0.1 * m).toFixed(2)}`;
  // Shown on API keys and the Playground until billing is set up.
  const setupBanner = !ready && bill && (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[14px]">
      <p className="font-medium text-amber-200">Set up billing first</p>
      <p className="text-amber-100/80 mt-1">{!bill.agreed ? "Agree to API billing and add funds" : "Add funds to your API balance"} before you can make keys or use the Playground. Every request is charged.</p>
      <button onClick={() => setTab("billing")} className="mt-3 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-3 py-1.5 text-[13px] font-medium">Go to Billing</button>
    </div>
  );
  const body = {
    overview: (
      <>
        <H sub="Use Nebulux AI from your own website, app, bot or script.">Welcome, {String(user?.full_name || "developer").split(" ")[0]}</H>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[["1", "Set up billing", "Agree to API billing and add funds.", () => setTab("billing")], ["2", "Make a key", "API keys → Create key. Copy it somewhere safe.", () => setTab("keys")], ["3", "Turn it on", "Nebulux AI → Settings → Usage → Use API key credits.", () => window.open("/chat", "_blank", "noopener")], ["4", "Build", "Call the API from your code, or try the Playground.", () => setTab("docs")]].map(([n, t, d, go]) => (
            <button key={n} onClick={go} className="text-left rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-4 hover:border-[var(--cl-focus,#a78bfa)]">
              <span className="w-7 h-7 rounded-full bg-[var(--cl-hover)] flex items-center justify-center text-[13px] font-semibold">{n}</span>
              <p className="mt-2 font-medium">{t}</p>
              <p className="text-[13px] text-[var(--cl-muted)] mt-0.5">{d}</p>
            </button>
          ))}
        </div>
        <p className="text-[14px] text-[var(--cl-muted)] mb-2">Quick start</p>
        <Code lang="curl">{curl(pgKey)}</Code>
        <p className="text-[12.5px] text-[var(--cl-faint)] mt-3">Every call is paid from your prepaid API balance (Billing), never your plan credits. Up to 20 requests a minute per key.</p>
      </>
    ),
    keys: (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[26px] font-semibold">API keys</h1>
            <p className="text-[14px] text-[var(--cl-muted)] mt-1">Keys let your code use Nebulux AI as you. Every request is paid from that AI's prepaid balance.</p>
          </div>
          <button onClick={() => { setErr(""); if (!ready) setTab("billing"); else setCreating(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-3.5 py-2 text-[14px] font-medium"><Plus className="w-4 h-4" /> Create Key</button>
        </div>
        {setupBanner}
        {err && !creating && <p className="mb-3 text-[13px] text-amber-300">{err}</p>}
        <div className="rounded-xl border border-[var(--cl-border)] overflow-x-auto">
          <table className="w-full text-left text-[13.5px] min-w-[640px]">
            <thead className="text-[12.5px] text-[var(--cl-muted)] bg-[var(--cl-card)]">
              <tr>{["Name", "Key", "Created by", "Created", "Last used", "Calls", ""].map((h) => <th key={h} className="font-medium px-4 py-2.5 border-b border-[var(--cl-border)]">{h}</th>)}</tr>
            </thead>
            <tbody>
              {keys === null ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-[var(--cl-muted)]" /></td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--cl-muted)]">No API keys yet. Press Create Key to make one.</td></tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="border-b last:border-0 border-[var(--cl-border)] hover:bg-[var(--cl-hover)]/40">
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3"><code className="text-[12.5px] text-[var(--cl-muted)]">{k.prefix}…</code></td>
                    <td className="px-4 py-3 text-[var(--cl-muted)] truncate max-w-[12rem]">{user?.email || "You"}</td>
                    <td className="px-4 py-3 text-[var(--cl-muted)] whitespace-nowrap">{k.created_at ? new Date(k.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}</td>
                    <td className="px-4 py-3 text-[var(--cl-muted)] whitespace-nowrap">{k.last_used ? new Date(k.last_used).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Never"}</td>
                    <td className="px-4 py-3 text-[var(--cl-muted)]">{k.uses || 0}</td>
                    <td className="px-2 py-3 text-right relative">
                      <button onClick={() => setMenuFor((m) => (m === k.id ? "" : k.id))} aria-label={`Options for ${k.name}`} className="p-1.5 rounded-md text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]"><MoreHorizontal className="w-4 h-4" /></button>
                      {menuFor === k.id && (
                        <div className="absolute right-2 top-11 z-10 w-40 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] shadow-xl py-1 text-left">
                          <button onClick={() => { setMenuFor(""); revoke(k); }} disabled={busy === k.id} className="w-full flex items-center gap-2 px-3 py-2 text-[13.5px] text-red-400 hover:bg-[var(--cl-hover)]"><Trash2 className="w-4 h-4" /> Delete key</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-[var(--cl-faint)] mt-3">Keep keys secret: never put one in a public web page or on GitHub. Up to 10 keys, 20 requests a minute each.</p>

        {creating && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
            <div role="dialog" aria-modal="true" aria-label="Create API key" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[18px] font-semibold">Create API key</h2>
                <button onClick={() => setCreating(false)} aria-label="Close" className="p-1 rounded-md text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]"><X className="w-5 h-5" /></button>
              </div>
              <label className="block text-[13px] text-[var(--cl-muted)] mb-1">Name your key</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="my-website-key" maxLength={60} className="w-full rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] px-3 py-2 outline-none focus:border-[var(--cl-focus)] text-[14px]" />
              {err && <p className="mt-2 text-[13px] text-amber-300">{err}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setCreating(false)} className="rounded-lg border border-[var(--cl-border)] px-4 py-2 text-[14px] text-[var(--cl-muted)]">Cancel</button>
                <button onClick={create} disabled={busy === "create"} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[14px] font-medium disabled:opacity-50">{busy === "create" && <Loader2 className="w-4 h-4 animate-spin" />} Create Key</button>
              </div>
            </div>
          </div>
        )}
        {newKey && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-label="Save your API key" className="w-full max-w-lg rounded-2xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-6 shadow-2xl">
              <h2 className="text-[18px] font-semibold">Save your API key</h2>
              <p className="mt-1 text-[14px] text-[var(--cl-muted)]">Keep it somewhere safe and private. <b className="text-[var(--cl-text)]">You won't be able to see it again</b> after you close this.</p>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-bg)] px-3 py-2">
                <code className="flex-1 min-w-0 break-all text-[13px]">{newKey}</code>
                <CopyBtn text={newKey} label="Copy Key" />
              </div>
              <div className="mt-5 flex justify-end">
                <button onClick={() => setNewKey("")} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[14px] font-medium">Done</button>
              </div>
            </div>
          </div>
        )}
      </>
    ),
    playground: (
      <>
        <H sub="Send a real request to the API and see exactly what comes back.">Playground</H>
        {setupBanner}
        <p className="mb-4 text-[13px] text-[var(--cl-muted)]">Every Playground message is a real API request: <b className="text-[var(--cl-text)]">it's charged to that AI's balance</b> ({balOf(pgModel)} left for {MODELS.find((x) => x[0] === pgModel)?.[1]}), the same as from your code.</p>
        <div className="grid gap-3">
          <label className="text-[13px] text-[var(--cl-muted)]">API key
            <input value={pgKey} onChange={(e) => setPgKey(e.target.value)} placeholder="nx-sk-..." type="password" className="mt-1 w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-2 outline-none focus:border-[var(--cl-focus)] text-[14px] text-[var(--cl-text)]" />
          </label>
          <label className="text-[13px] text-[var(--cl-muted)]">Model
            <select value={pgModel} onChange={(e) => setPgModel(e.target.value)} className="mt-1 w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-2 outline-none text-[14px] text-[var(--cl-text)]">
              {MODELS.map(([id, n, , m]) => <option key={id} value={id}>{n} ({id}) · from {price(m * 2)} a request · {balOf(id)} left</option>)}
            </select>
          </label>
          <label className="text-[13px] text-[var(--cl-muted)]">System (optional)
            <input value={pgSystem} onChange={(e) => setPgSystem(e.target.value)} placeholder="You are a friendly helper." className="mt-1 w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-2 outline-none focus:border-[var(--cl-focus)] text-[14px] text-[var(--cl-text)]" />
          </label>
          <label className="text-[13px] text-[var(--cl-muted)]">Message
            <textarea value={pgMsg} onChange={(e) => setPgMsg(e.target.value)} rows={3} className="mt-1 w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-2 outline-none focus:border-[var(--cl-focus)] text-[14px] text-[var(--cl-text)] resize-none" />
          </label>
          <div>
            <button onClick={run} disabled={!ready || !pgKey.trim() || !pgMsg.trim() || pgOut?.loading} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-2 text-[14px] font-medium disabled:opacity-50">
              {pgOut?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
            {!pgKey && <span className="ml-3 text-[12.5px] text-[var(--cl-faint)]">Make a key first, or paste one you saved.</span>}
          </div>
          {pgOut && !pgOut.loading && (
            <div className="grid gap-2">
              {pgOut.data?.content && <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-4 text-[15px] leading-relaxed whitespace-pre-wrap font-serif">{pgOut.data.content}</div>}
              {pgOut.data?.error && <p className="flex items-start gap-2 text-[13.5px] text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {pgOut.data.error.message}</p>}
              <Code lang={`response · ${pgOut.status} · ${pgOut.ms} ms`}>{JSON.stringify(pgOut.data, null, 2)}</Code>
            </div>
          )}
        </div>
      </>
    ),
    docs: (
      <>
        <H sub="One endpoint: send a conversation, get the next reply.">Docs</H>
        <h2 className="font-semibold mb-2">Endpoint</h2>
        <Code lang="http">{`POST ${API_URL}\nAuthorization: Bearer nx-sk-...\nContent-Type: application/json`}</Code>
        <h2 className="font-semibold mt-6 mb-2">Request</h2>
        <ul className="text-[14px] text-[var(--cl-muted)] space-y-1 list-disc pl-5">
          <li><code className="text-[var(--cl-text)]">model</code>: one of the models below (default <code>nebulux-ai</code>).</li>
          <li><code className="text-[var(--cl-text)]">messages</code>: the conversation, oldest first. Each is <code>{"{ role, content }"}</code> with role <code>system</code>, <code>user</code> or <code>assistant</code>. The last one must be from the user.</li>
          <li><code className="text-[var(--cl-text)]">effort</code> (optional): <code>low</code>, <code>medium</code> or <code>high</code>. Higher thinks harder and costs more credits.</li>
        </ul>
        <h2 className="font-semibold mt-6 mb-2">Response</h2>
        <Code lang="json">{`{\n  "id": "nx-…",\n  "object": "chat.completion",\n  "model": "nebulux-ai",\n  "content": "Silent stars drift by…",\n  "credits_left": 4210\n}`}</Code>
        <h2 className="font-semibold mt-6 mb-2">Models</h2>
        <div className="rounded-xl border border-[var(--cl-border)] overflow-hidden text-[14px]">
          <div className="grid grid-cols-[7rem_1fr_6rem_7rem] gap-2 px-4 py-2 border-b border-[var(--cl-border)] text-[12px] text-[var(--cl-faint)]"><span>Model</span><span></span><span>Input</span><span>Output</span></div>
          {MODELS.map(([id, n, d, m]) => (
            <div key={id} className="grid grid-cols-[7rem_1fr_6rem_7rem] gap-2 px-4 py-2.5 border-b last:border-0 border-[var(--cl-border)]">
              <code className="text-[var(--cl-text)]">{id}</code>
              <span className="text-[var(--cl-muted)]">{n}: {d}</span>
              <span>{price(m)}<span className="text-[var(--cl-faint)] text-[11px]"> /request</span></span>
              <span>{price(m)}<span className="text-[var(--cl-faint)] text-[11px]"> /credit</span></span>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] text-[var(--cl-muted)] mt-2">A request costs its input price once, plus the output price for each credit of reply: 1 credit per started 10,000 characters (about 2,500 tokens), doubled on high effort. A short Nebulux AI answer costs $0.20; the same on Nebula costs $1.00. The response shows <code>cost_usd</code> and <code>balance_usd</code>.</p>
        <h2 className="font-semibold mt-6 mb-2">Examples</h2>
        <div className="grid gap-3">
          <Code lang="JavaScript">{js(pgKey)}</Code>
          <Code lang="Python">{py(pgKey)}</Code>
          <Code lang="curl">{curl(pgKey)}</Code>
        </div>
        <h2 className="font-semibold mt-6 mb-2">Errors</h2>
        <ul className="text-[14px] text-[var(--cl-muted)] space-y-1 list-disc pl-5">
          <li><b className="text-[var(--cl-text)]">401</b> wrong or deleted key · <b className="text-[var(--cl-text)]">400</b> bad request · <b className="text-[var(--cl-text)]">402</b> your API balance is empty · <b className="text-[var(--cl-text)]">403</b> "Use API key credits" is off (Nebulux AI → Settings → Usage) · <b className="text-[var(--cl-text)]">429</b> more than 20 requests a minute · <b className="text-[var(--cl-text)]">503</b> the AI is busy, try again in a moment.</li>
          <li>Errors look like <code>{'{ "error": { "type": "...", "message": "..." } }'}</code>.</li>
        </ul>
        <h2 className="font-semibold mt-6 mb-2">Keep your key safe</h2>
        <p className="text-[14px] text-[var(--cl-muted)]">Anyone with your key can spend your API balance. Call the API from a server, not from a public web page, and never commit a key to GitHub. If one leaks, delete it in API keys and make a new one.</p>
      </>
    ),
    billing: (
      <>
        <H sub="Prepaid: add money, and every API request, Playground message and website AI answer takes its cost from it.">Billing</H>
        {err && <p className="mb-3 text-[13px] text-amber-300">{err}</p>}
        <p className="text-[13px] text-[var(--cl-muted)] mb-2">Each AI has its own balance: money added to one AI only pays for that AI. {bill?.useApi ? "API key credits are on." : "API key credits are off: turn them on in Nebulux AI → Settings → Usage."}</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {MODELS.map(([id, n, , m]) => (
            <button key={id} onClick={() => { setFundModel(id); setAmount(minOf(id)); }} className={`text-left rounded-xl border bg-[var(--cl-card)] p-4 ${fundModel === id ? "border-[var(--cl-text)]" : "border-[var(--cl-border)]"}`}>
              <p className="text-[13px] text-[var(--cl-muted)]">{n}</p>
              <p className="text-[24px] font-semibold mt-0.5">{balOf(id)}</p>
              <p className="text-[11.5px] text-[var(--cl-faint)] mt-0.5">{price(m)} in · {price(m)}/credit out</p>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-5 mb-4">
          <p className="text-[14px] font-medium">Add funds to {MODELS.find((x) => x[0] === fundModel)?.[1]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[minOf(fundModel), 10, 25, 50].filter((d, i, arr) => arr.indexOf(d) === i && d >= minOf(fundModel)).map((d) => (
              <button key={d} onClick={() => setAmount(d)} className={`rounded-lg border px-3 py-1.5 text-[14px] ${amount === d ? "border-[var(--cl-text)] bg-[var(--cl-hover)]" : "border-[var(--cl-border)] text-[var(--cl-muted)]"}`}>${d}</button>
            ))}
          </div>
          <button onClick={() => (bill?.agreed ? billCall({ action: "topup", model: fundModel, dollars: amount }, "topup") : setErr("Agree to API billing below first."))} disabled={busy === "topup"} className="mt-3 w-full sm:w-auto rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-5 py-2 text-[14px] font-medium disabled:opacity-50">Add ${amount} with a card</button>
          <p className="text-[11.5px] text-[var(--cl-faint)] mt-2">Smallest amount: Nebulux AI ${minOf("nebulux-ai")}, Galaxy ${minOf("galaxy")}, Space ${minOf("space")}, Nebula ${minOf("nebula")}. A real card is needed: cards that can't pay, or with no money, are refused.</p>
        </div>

        <div className="rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-5 mb-4">
          <p className="text-[15px] font-semibold">API billing agreement</p>
          <ul className="mt-2 text-[13.5px] text-[var(--cl-muted)] space-y-1.5 list-disc pl-5">
            <li><b className="text-[var(--cl-text)]">You are charged every time</b> an API request is made with one of your keys, <b className="text-[var(--cl-text)]">including every message you send in the Playground</b>, and every answer the AI gives on your websites if you turned on AI for visitors.</li>
            <li>The price depends on the AI (Nebulux AI $0.10 per request plus $0.10 per credit of reply; Galaxy 2x, Space 3x, Nebula 5x) and is taken right away from <b className="text-[var(--cl-text)]">that AI's own prepaid balance</b>. Each AI's balance only pays for that AI.</li>
            <li>Money added to your API balance is not refundable and can't be turned into plan credits. Requests stop when the balance runs out.</li>
            <li>You are responsible for everything done with your keys: keep them secret. If one leaks, delete it; requests already made stay charged.</li>
            <li>You need to be 18 or older, or have a parent or guardian's permission, to add money.</li>
          </ul>
          {bill?.agreed ? (
            <p className="mt-3 flex items-center gap-2 text-[13.5px] text-emerald-400"><Check className="w-4 h-4" /> You agreed to API billing.</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={agreeTick} onChange={(e) => setAgreeTick(e.target.checked)} /> I agree to be charged for every API request and Playground message.</label>
              <button onClick={() => billCall({ action: "agree" }, "agree")} disabled={!agreeTick || busy === "agree"} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-4 py-1.5 text-[13.5px] font-medium disabled:opacity-40">Agree</button>
            </div>
          )}
        </div>

        {user?.role === "admin" && (
          <div className="rounded-xl border border-dashed border-[var(--cl-border)] p-4 mb-4 flex flex-wrap items-center gap-2 text-[13.5px]">
            <span className="text-[var(--cl-muted)]">Admin: add test balance to {MODELS.find((x) => x[0] === fundModel)?.[1]} on your account</span>
            <input type="number" min="1" max="1000" value={grantAmt} onChange={(e) => setGrantAmt(Number(e.target.value))} className="w-24 rounded-lg bg-[var(--cl-bg)] border border-[var(--cl-border)] px-2 py-1" />
            <button onClick={() => billCall({ action: "grant", model: fundModel, dollars: grantAmt }, "grant")} disabled={busy === "grant"} className="rounded-lg border border-[var(--cl-border)] px-3 py-1">Add</button>
          </div>
        )}

        <p className="text-[14px] font-medium mb-2">History</p>
        <div className="rounded-xl border border-[var(--cl-border)] divide-y divide-[var(--cl-border)] text-[13.5px]">
          {!bill?.ledger?.length ? (
            <p className="p-4 text-[var(--cl-muted)]">Nothing yet.</p>
          ) : (
            bill.ledger.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0 truncate">{l.kind === "charge" ? l.note || "API request" : l.kind === "grant" ? `Balance added · ${MODELS.find((x) => x[0] === l.model)?.[1] || l.model}` : `Funds added · ${MODELS.find((x) => x[0] === l.model)?.[1] || l.model}`}</span>
                <span className="text-[var(--cl-faint)] text-[12px] whitespace-nowrap">{new Date(l.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                <span className={`w-24 text-right tabular-nums ${l.amount < 0 ? "text-[var(--cl-muted)]" : "text-emerald-400"}`}>{l.amount < 0 ? "-" : "+"}${(Math.abs(l.amount) / 100000).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </>
    ),
  }[tab];

  return (
    <div className="min-h-screen bg-[var(--cl-bg)] text-[var(--cl-text)] flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[var(--cl-border)] bg-[var(--cl-side,var(--cl-bg))] p-3 md:min-h-screen">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <BlackholeIcon className="w-7 h-7" />
          <span className="font-semibold">Nebulux Platform</span>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`shrink-0 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-left whitespace-nowrap ${tab === k ? "bg-[var(--cl-hover)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:bg-[var(--cl-hover)]/60"}`}>
              <Icon className="w-4 h-4" /> {l}
            </button>
          ))}
        </nav>
        <Link to="/chat" className="hidden md:flex mt-6 items-center gap-2 px-3 py-2 text-[13px] text-[var(--cl-muted)] hover:text-[var(--cl-text)]"><ArrowLeft className="w-4 h-4" /> Back to Nebulux AI</Link>
      </aside>
      <main className="flex-1 min-w-0 p-5 sm:p-10 max-w-4xl">{body}</main>
    </div>
  );
}
