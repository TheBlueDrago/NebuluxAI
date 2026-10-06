import React, { useEffect, useMemo, useState } from "react";
import { LogIn, LayoutDashboard, Users, Database, Globe, Plug, ShieldCheck, Code2, History, Settings, ExternalLink, Copy, Check, Rocket, Inbox, Trash2, RotateCcw, EyeOff, Eye, Plus, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { askConfirm, showNotice } from "@/lib/dialogs";
import { siteUrl } from "@/lib/blackholeDomain";
import { privateInfoOnPage } from "@/lib/privateInfo";
import CustomDomain from "@/components/designer/CustomDomain";
import DownloadZip from "@/components/designer/DownloadZip";
import GitHubPush from "@/components/designer/GitHubPush";
import BadgeToggle from "@/components/designer/BadgeToggle";
import SiteMessages from "@/components/designer/SiteMessages";
import SiteSignIns from "@/components/designer/SiteSignIns";
import ShareLink from "@/components/designer/ShareLink";
import { QrButton } from "@/components/designer/QrDialog";

// The site's dashboard in the Website Designer, laid out like Base44's app dashboard: a menu of
// sections on the left (Overview, People, Data, Domains, Integrations, Security, Code,
// Versions, Settings) and the section on the right. Everything here is real and works.
const SECTIONS = [
  ["overview", "Overview", LayoutDashboard],
  ["people", "People", Users],
  ["signin", "Sign in", LogIn],
  ["data", "Data", Database],
  ["domains", "Domains", Globe],
  ["integrations", "Integrations", Plug],
  ["security", "Security", ShieldCheck],
  ["code", "Code", Code2],
  ["versions", "Versions", History],
  ["settings", "Settings", Settings],
];

const Card = ({ title, sub, children, right }) => (
  <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
    {(title || right) && (
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          {title && <p className="text-[14px] font-semibold text-white">{title}</p>}
          {sub && <p className="text-[12.5px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);
const H = ({ children, sub }) => (
  <div className="mb-4">
    <h2 className="text-[19px] font-semibold text-white">{children}</h2>
    {sub && <p className="text-[13px] text-slate-400 mt-0.5">{sub}</p>}
  </div>
);
const Btn = ({ children, onClick, primary, danger, disabled }) => (
  <button disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium disabled:opacity-40 ${primary ? "bg-indigo-600 hover:bg-indigo-700 text-white" : danger ? "border border-red-500/40 text-red-400 hover:bg-red-500/10" : "border border-slate-600 text-slate-200 hover:bg-slate-800"}`}>
    {children}
  </button>
);

export default function SiteDashboard({ siteName, onRename, html, plan, onUpgrade, user, members, cap, canAdd, onInvite, onPublish, builds, onRestore, onEdit }) {
  const [tab, setTab] = useState("overview");
  const [site, setSite] = useState(undefined); // the published record, null when not published
  const [inbox, setInbox] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState(siteName);
  const url = site && !site.hidden ? siteUrl(siteName) : "";

  useEffect(() => setNewName(siteName), [siteName]);
  useEffect(() => {
    let off = false;
    setSite(undefined);
    base44.entities.PublishedSite.list("-updated_date", 200)
      .then((rows) => !off && setSite((rows || []).find((r) => r.name === siteName) || null))
      .catch(() => !off && setSite(null));
    base44.functions.invoke("site-form", { action: "count", site: siteName })
      .then((r) => !off && setInbox(r.data?.count ?? null))
      .catch(() => {});
    return () => { off = true; };
  }, [siteName]);

  const secret = useMemo(() => (tab === "security" ? privateInfoOnPage(html) : ""), [tab, html]);
  const lines = (html || "").split("\n").length;
  const kb = Math.round(new Blob([html || ""]).size / 1024);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(html || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { showNotice("Couldn't copy. Select the code and copy it instead."); }
  };
  const toggleHidden = async () => {
    if (!site) return;
    try { await base44.entities.PublishedSite.update(site.id, { hidden: !site.hidden }); setSite({ ...site, hidden: !site.hidden }); }
    catch { showNotice("Couldn't change that. Please try again."); }
  };
  const unpublish = async () => {
    if (!site || !(await askConfirm(`Take ${siteName} offline and delete the published copy? Your project here stays, so you can publish again.`))) return;
    try { await base44.entities.PublishedSite.delete(site.id); setSite(null); showNotice("Your site is offline now."); }
    catch { showNotice("Couldn't take it offline. Please try again."); }
  };

  const status = site === undefined ? "Checking…" : !site ? "Draft (not published)" : site.hidden ? "Published, hidden" : "Live";
  const body = {
    overview: (
      <>
        <H sub="Your site at a glance.">{siteName}</H>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <Card><p className="text-[12px] text-slate-400">Status</p><p className={`text-[16px] font-semibold mt-1 ${site && !site.hidden ? "text-emerald-400" : "text-slate-200"}`}>{status}</p></Card>
          <Card><p className="text-[12px] text-slate-400">Form messages</p><p className="text-[16px] font-semibold mt-1 text-slate-100">{inbox ?? "—"}</p></Card>
          <Card><p className="text-[12px] text-slate-400">Page size</p><p className="text-[16px] font-semibold mt-1 text-slate-100">{html ? `${kb} KB` : "—"}</p></Card>
        </div>
        <Card title="Your address" sub={url ? "Anyone with the link can visit." : "Publish to put it online."} right={url ? <div className="flex gap-1"><ShareLink url={url} title={siteName} className="bg-slate-800 hover:bg-slate-700 text-slate-200" /><QrButton onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`, "_blank", "noopener")} className="bg-slate-800 hover:bg-slate-700" /></div> : null}>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-950 border border-slate-700/60 px-3 py-2 text-[13px] text-indigo-200">{siteName}.nebuluxai.com</code>
            {url && <Btn onClick={() => window.open(url, "_blank", "noopener")}><ExternalLink className="w-4 h-4" /> Open</Btn>}
            <Btn primary onClick={onPublish} disabled={!html}><Rocket className="w-4 h-4" /> {site ? "Publish changes" : "Publish"}</Btn>
          </div>
        </Card>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Card title="Edit visually" sub="Drag blocks, change text, colors and pictures."><Btn onClick={onEdit} disabled={!html}>Open the editor</Btn></Card>
          <Card title="Versions" sub={`${builds.length} saved version${builds.length === 1 ? "" : "s"}.`}><Btn onClick={() => setTab("versions")}>See versions</Btn></Card>
        </div>
      </>
    ),
    people: (
      <>
        <H sub={`People who can work on this site (${members.length + 1}/${cap}).`}>People</H>
        <Card>
          <div className="divide-y divide-slate-800">
            <div className="flex items-center gap-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white">{(user?.full_name || user?.email || "Y")[0].toUpperCase()}</span>
              <span className="flex-1 text-[14px] text-slate-200">{user?.email || "You"}</span>
              <span className="text-[12px] text-slate-400">Owner</span>
            </div>
            {members.map((m) => (
              <div key={m} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">{m[0].toUpperCase()}</span>
                <span className="flex-1 text-[14px] text-slate-200">{m}</span>
                <span className="text-[12px] text-slate-400">Editor</span>
              </div>
            ))}
          </div>
          <div className="mt-3">{canAdd ? <Btn onClick={onInvite}><Plus className="w-4 h-4" /> Invite someone</Btn> : <p className="text-[12.5px] text-slate-400">Your plan's limit is reached. <button onClick={onUpgrade} className="underline text-slate-200">Upgrade</button> for more people.</p>}</div>
        </Card>
      </>
    ),
    signin: <SiteSignIns site={siteName} />,
    data: (
      <>
        <H sub="What visitors send through the forms on your published site.">Data</H>
        <Card title="Form messages" sub={inbox == null ? "Publish your site to collect messages." : `${inbox} message${inbox === 1 ? "" : "s"} so far.`} right={<Btn onClick={() => setShowInbox(true)} disabled={!site}><Inbox className="w-4 h-4" /> Open inbox</Btn>}>
          <p className="text-[12.5px] text-slate-400">Bookings, sign-ups and contact forms land here. You can download them as a spreadsheet from the inbox.</p>
        </Card>
      </>
    ),
    domains: (
      <>
        <H sub="Where people find your site.">Domains</H>
        <Card title="Free address" sub="Included with every site."><code className="text-[13px] text-indigo-200">{siteName}.nebuluxai.com</code></Card>
        <div className="mt-3"><Card title="Your own domain" sub="Use a name you own, like www.yourname.com."><CustomDomain siteName={siteName} plan={plan} onUpgrade={onUpgrade} /></Card></div>
      </>
    ),
    integrations: (
      <>
        <H sub="Take your site to other places.">Integrations</H>
        <div className="grid sm:grid-cols-2 gap-3">
          <Card title="GitHub" sub="Save the site's code to one of your repositories."><GitHubPush html={html} siteName={siteName} plan={plan} onUpgrade={onUpgrade} /></Card>
          <Card title="Download" sub="Get the files to host anywhere."><DownloadZip html={html} name={siteName} plan={plan} onUpgrade={onUpgrade} /></Card>
        </div>
      </>
    ),
    security: (
      <>
        <H sub="Keep your site and your visitors safe.">Security</H>
        <Card title="Private info check" sub="Looks for keys, passwords or personal details left on the page.">
          {secret ? (
            <p className="flex items-start gap-2 text-[13px] text-amber-300"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {secret}</p>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-emerald-400"><Check className="w-4 h-4" /> Nothing private found on the page.</p>
          )}
        </Card>
        <div className="mt-3">
          <Card title="Visibility" sub={site ? (site.hidden ? "Hidden: only you can see it in your list." : "Public: anyone with the link can visit.") : "Not published yet."} right={site ? <Btn onClick={toggleHidden}>{site.hidden ? <><Eye className="w-4 h-4" /> Show it</> : <><EyeOff className="w-4 h-4" /> Hide it</>}</Btn> : null} />
        </div>
        <p className="text-[12px] text-slate-500 mt-3">Every site is served over HTTPS, and forms are checked for spam.</p>
      </>
    ),
    code: (
      <>
        <H sub={`${lines} lines · ${kb} KB`}>Code</H>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-[12px] text-slate-400">index.html</span>
            <Btn onClick={copyCode} disabled={!html}>{copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}</Btn>
          </div>
          <pre className="max-h-[55vh] overflow-auto p-3 text-[12px] leading-relaxed text-slate-300 font-mono whitespace-pre">{html || "Nothing built yet."}</pre>
        </div>
      </>
    ),
    versions: (
      <>
        <H sub="Every version the AI or the editor made. Restoring adds it as the newest version.">Versions</H>
        <div className="space-y-2">
          {builds.length === 0 && <p className="text-[13px] text-slate-400">No versions yet.</p>}
          {[...builds].reverse().map((b, i) => (
            <div key={b.index} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3">
              <History className="w-4 h-4 text-slate-400" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-slate-100">Version {builds.length - i}{i === 0 ? " · current" : ""}</p>
                <p className="text-[12px] text-slate-400 truncate">{b.label}</p>
              </div>
              {i > 0 && <Btn onClick={() => onRestore(b.content)}><RotateCcw className="w-4 h-4" /> Restore</Btn>}
            </div>
          ))}
        </div>
      </>
    ),
    settings: (
      <>
        <H sub="Name, badge and taking the site down.">Settings</H>
        <Card title="Site name" sub="Letters, numbers and hyphens. It's also your address.">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-[13.5px] outline-none focus:border-indigo-500 text-white" />
            <Btn onClick={() => onRename(newName)} disabled={!newName || newName === siteName}>Save</Btn>
          </div>
        </Card>
        <div className="mt-3"><Card><BadgeToggle siteName={siteName} userId={user?.id} /></Card></div>
        <div className="mt-3">
          <Card title="Take the site offline" sub="Deletes the published copy. Your project stays here." right={<Btn danger onClick={unpublish} disabled={!site}><Trash2 className="w-4 h-4" /> Unpublish</Btn>} />
        </div>
      </>
    ),
  }[tab];

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col sm:flex-row">
      <nav className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-800 p-2 flex sm:flex-col gap-0.5 overflow-x-auto">
        {SECTIONS.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-left ${tab === k ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">{body}</div>
      {showInbox && <SiteMessages site={siteName} onClose={() => setShowInbox(false)} />}
    </div>
  );
}
