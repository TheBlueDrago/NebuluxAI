import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, ShieldCheck, Sparkles, Download, BadgeCheck, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PublicLayout from "@/components/PublicLayout";

// Must match ENTITY_TYPES in cloudflare-lib/enterprise.js.
const ENTITY_TYPES = [
  ["llc", "LLC"],
  ["corporation", "Corporation (Inc., Corp.)"],
  ["partnership", "Partnership (LP, LLP)"],
  ["nonprofit", "Nonprofit"],
  ["other", "Other registered business"],
];

const POINTS = [
  { icon: Users, title: "A seat for everyone", text: "Add and remove the people in your organization yourself, as many as you need." },
  { icon: Sparkles, title: "One shared pool of credits", text: "Each seat adds 100 Nebulux AI, 75 Code, 50 Galaxy and 25 Space credits a month to a pool everyone in your organization uses." },
  { icon: Download, title: "All features", text: "All 4 AI models, 10 published websites, 10 new games a month, ZIP download and GitHub push." },
  { icon: ShieldCheck, title: "Verified organizations only", text: "Enterprise is for legally registered businesses. We check every application before approving it." },
];

const STATUS = {
  new: { icon: Clock, color: "text-amber-300", title: "Application received", text: "We're checking your organization's details and will email you with a quote." },
  approved: { icon: BadgeCheck, color: "text-emerald-300", title: "Approved", text: "Your organization is approved. We'll email you about payment, then turn Enterprise on for your account." },
  active: { icon: CheckCircle2, color: "text-emerald-300", title: "Enterprise is on", text: "Add your team from your account → Settings → Membership." },
  rejected: { icon: XCircle, color: "text-red-300", title: "Not approved", text: "We couldn't verify the organization. Check the details below and send it again, or contact us." },
};

const field = "mt-1 w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-400 placeholder:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-300 font-medium">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// Enterprise: what it includes, and the application form for registered organizations.
// Applications go to Monitor → Enterprise, where an admin reviews them.
export default function Enterprise({ embedded = false }) {
  const { isAuthenticated } = useAuth();
  const [mine, setMine] = useState(undefined); // undefined = loading, null = none yet
  const [form, setForm] = useState({
    orgName: "", entityType: "llc", region: "", regNumber: "", website: "", contactName: "", role: "", workEmail: "", phone: "", seats: 5, useCase: "", confirm: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return setMine(null);
    base44.functions
      .invoke("enterprise", { action: "mine" })
      .then((r) => setMine(r.data?.application || null))
      .catch(() => setMine(null));
  }, [isAuthenticated]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await base44.functions.invoke("enterprise", { action: "apply", ...form, seats: Number(form.seats) });
      setMine(r.data?.application || null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err?.response?.data?.error || "Could not send the application. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  const status = mine && STATUS[mine.status];
  const canApply = isAuthenticated && mine !== undefined && (!mine || mine.status === "new" || mine.status === "rejected");

  // The application card; the app's Plans screen shows just this (embedded), so people stay put.
  const card = (
    <div className="rounded-3xl bg-slate-900/70 border border-slate-700/60 p-6 sm:p-8 h-fit">
      {status && (
        <div className="mb-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4 flex gap-3">
          <status.icon className={`w-6 h-6 shrink-0 ${status.color}`} />
          <div>
            <p className="font-semibold text-white">{status.title}</p>
            <p className="text-sm text-slate-400">
              {mine.orgName} · {mine.seats} seats
            </p>
            <p className="mt-1 text-sm text-slate-300">{status.text}</p>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="text-center py-6">
          <h2 className="text-2xl font-bold text-white">Apply for Enterprise</h2>
          <p className="mt-2 text-slate-400">Create a free account first (or log in), then fill in your organization's details.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={"/register?returnTo=" + encodeURIComponent("/enterprise")} className="px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-200">
              Create an account
            </Link>
            <Link to={"/login?returnTo=" + encodeURIComponent("/enterprise")} className="px-6 py-3 rounded-full border border-slate-600 text-slate-200 font-semibold hover:bg-white/5">
              Log in
            </Link>
          </div>
        </div>
      ) : mine === undefined ? (
        <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : canApply ? (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{mine ? "Update your application" : "Apply for Enterprise"}</h2>
            <p className="mt-1 text-sm text-slate-400">Only for legally registered organizations. We verify every one before approving it.</p>
          </div>
          <Field label="Organization's legal name">
            <input required value={form.orgName} onChange={set("orgName")} placeholder="Acme Bakery LLC" className={field} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type of organization">
              <select value={form.entityType} onChange={set("entityType")} className={field}>
                {ENTITY_TYPES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Registered in (state or country)">
              <input required value={form.region} onChange={set("region")} placeholder="Texas" className={field} />
            </Field>
          </div>
          <Field label="Registration number or EIN" hint="From your state filing or tax records, so we can check the organization is real.">
            <input required value={form.regNumber} onChange={set("regNumber")} placeholder="12-3456789" className={field} />
          </Field>
          <Field label="Company website (optional)">
            <input value={form.website} onChange={set("website")} placeholder="acmebakery.com" className={field} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Your name">
              <input required value={form.contactName} onChange={set("contactName")} autoComplete="name" className={field} />
            </Field>
            <Field label="Your role">
              <input required value={form.role} onChange={set("role")} placeholder="Owner, manager…" className={field} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Work email">
              <input required type="email" value={form.workEmail} onChange={set("workEmail")} autoComplete="email" placeholder="you@company.com" className={field} />
            </Field>
            <Field label="Phone (optional)">
              <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" className={field} />
            </Field>
          </div>
          <Field label="How many people will use it?" hint="Including you. You can change this later.">
            <input required type="number" min={2} max={10000} value={form.seats} onChange={set("seats")} className={field} />
          </Field>
          <Field label="What will you use it for? (optional)">
            <textarea rows={3} value={form.useCase} onChange={set("useCase")} className={`${field} resize-none`} placeholder="Websites for our locations, training, marketing…" />
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.confirm} onChange={set("confirm")} className="mt-1 w-4 h-4 accent-violet-500 shrink-0" />
            <span>I confirm this organization is legally registered and I'm allowed to sign it up.</span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !form.confirm}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mine ? "Send again" : "Send application"}
          </button>
          <p className="text-xs text-slate-500 text-center">
            We only use these details to check your organization and send your quote. See our{" "}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </form>
      ) : (
        <p className="text-center text-sm text-slate-400">
          Questions? <Link to="/contact?topic=business" className="text-indigo-300 hover:text-indigo-200">Contact us</Link>
        </p>
      )}
    </div>
  );
  if (embedded) return card;

  return (
    <PublicLayout title="Enterprise">
      <section className="grid lg:grid-cols-2 gap-12 pt-10 sm:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-violet-300">
            <Building2 className="w-4 h-4" /> Enterprise
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-white leading-tight">Nebulux AI for your whole organization</h1>
          <p className="mt-5 text-slate-400 text-lg">
            Give everyone in your business or organization Nebulux AI, sharing one pool of credits that grows with every seat. Pricing depends on how many people will use it: tell us
            about your organization and we'll send you a quote.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-slate-900/50 border border-slate-800 p-4">
                <Icon className="w-6 h-6 text-violet-300" />
                <p className="mt-2 font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {card}
      </section>
    </PublicLayout>
  );
}
