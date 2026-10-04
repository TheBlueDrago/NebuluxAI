import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// The "Made with Nebulux AI" badge on a published website: off unless the owner turns it on.
// (For now every plan can choose; later only Pro and up will be able to turn it off.)
export default function BadgeToggle({ siteName, userId }) {
  const [rec, setRec] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setRec(null);
    base44.entities.PublishedSite.filter({ name: String(siteName || "").toLowerCase() })
      .then((rows) => alive && setRec((rows || []).find((r) => r.created_by_id === userId) || false))
      .catch(() => alive && setRec(false));
    return () => {
      alive = false;
    };
  }, [siteName, userId]);

  if (rec === null) return null;
  const on = rec && rec.showBadge === true;

  const flip = async () => {
    if (!rec || saving) return;
    setSaving(true);
    setErr("");
    try {
      await base44.entities.PublishedSite.update(rec.id, { showBadge: !on });
      setRec({ ...rec, showBadge: !on });
    } catch (e) {
      setErr(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-slate-300 text-sm font-medium mb-2">"Made with Nebulux AI" badge</p>
      {rec ? (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={flip}
            disabled={saving}
            className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-indigo-500" : "bg-slate-700"} disabled:opacity-60`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-slate-400 text-xs">
            {on ? "Shown in the corner of your website." : "Hidden. Turn it on to show it in the corner of your website."}
          </span>
        </label>
      ) : (
        <p className="text-slate-500 text-xs">Publish this website first, then you can choose here.</p>
      )}
      {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
    </div>
  );
}
