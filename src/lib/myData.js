import { base44 } from "@/api/base44Client";
import { siteUrl } from "@/lib/blackholeDomain";

// Settings → Security → Download my data: a copy of what Nebulux AI keeps about this
// account (including the AI activity record the Privacy Policy describes), as one JSON file.
// Each part is loaded on its own, so one that fails is noted in the file instead of stopping
// the rest. Chats aren't in it: they're kept in this browser and have their own backup
// (src/lib/chatBackup.js).
export const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));

const PURCHASE_FIELDS = ["productName", "productId", "quantity", "amount", "currency", "status", "created_date", "paidAt", "canceledAt"];
const PAGE_FIELDS = ["name", "title", "description", "created_date", "updated_date", "hidden"];

export async function collectMyData(user) {
  const out = {
    app: "nebulux-ai",
    kind: "my-data",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: pick(user, ["id", "email", "full_name", "role", "created_date"]),
  };
  const part = async (name, load) => {
    try {
      out[name] = await load();
    } catch {
      out[name] = { error: "Couldn't load this part right now. Try again later." };
    }
  };
  await Promise.all([
    part("credits", async () => {
      const d = (await base44.functions.invoke("credits")).data || {};
      return pick(d, ["plan", "planSource", "tiers", "bonus", "resetsAt"]);
    }),
    // What's kept about your AI use this month: counts, and the start of your latest questions.
    part("aiActivityThisMonth", async () => (await base44.functions.invoke("credits", { action: "my-activity" })).data?.activity || null),
    part("purchases", async () => {
      const rows = await base44.entities.Base44Purchase.filter({ appUserId: user.id }, "-created_date", 200);
      return (rows || []).filter((p) => p.status === "paid" || p.status === "canceled").map((p) => pick(p, PURCHASE_FIELDS));
    }),
    part("sites", async () => {
      const rows = await base44.entities.PublishedSite.filter({ created_by_id: user.id });
      return (rows || []).map((s) => ({ ...pick(s, PAGE_FIELDS), address: siteUrl(s.name) || undefined }));
    }),
    part("games", async () => {
      const rows = await base44.entities.PublishedGame.filter({ created_by_id: user.id });
      return (rows || []).map((g) => pick(g, [...PAGE_FIELDS, "plays"]));
    }),
    // Progress kept with the account in every game played (functions/.../game-save.js).
    part("gameProgress", async () => (await base44.functions.invoke("game-save", { action: "list" })).data?.saves || {}),
    // The website being worked on, published or not (functions/.../site-draft.js).
    part("websiteDraft", async () => {
      const d = (await base44.functions.invoke("site-draft", { action: "load" })).data?.draft;
      return d ? pick(d, ["siteName", "savedAt", "html"]) : null;
    }),
    part("gameDraft", async () => {
      const d = (await base44.functions.invoke("game-draft", { action: "load" })).data?.draft;
      return d ? pick(d, ["gameName", "title", "genre", "html"]) : null;
    }),
  ]);
  return out;
}

// Saves `data` as a JSON file in the browser's downloads.
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
