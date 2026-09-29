// One-time move from Base44 to Nebulux's own database (D1 "nebulux-db"). Reads the CSV files
// exported from the Base44 dashboard (Data tab: <Entity>_export.csv, plus the users list and a
// user-ids.json of { email: id }) and writes db/import.sql (not committed: it holds people's
// data), which is then loaded with:
//   npx wrangler d1 execute nebulux-db --remote --file db/import.sql
// Every record keeps its Base44 id, so credits, saves, published pages and everything else kept
// in Cloudflare under those ids stay linked. Run: node scripts/import-base44.mjs <folder>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || join(process.env.USERPROFILE || ".", "Downloads");

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0]);
  return (body || []).map((r) => Object.fromEntries((head || []).map((h, i) => [h, r[i] ?? ""])));
}

const NUMBERS = new Set(["plays", "credits", "aiCodeUsed", "quantity", "amount", "gross", "platformFee", "creatorPayout", "price", "tax"]);
export function value(k, v) {
  if (v === "") return undefined;
  if (v === "true") return true;
  if (v === "false") return false;
  if (NUMBERS.has(k) && !Number.isNaN(Number(v))) return Number(v);
  if (/^[[{]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {}
  }
  return v;
}

const iso = (d) => (d ? (/[zZ]$/.test(d) ? d : d + "Z") : new Date().toISOString());
const sql = (s) => (s === null || s === undefined ? "NULL" : "'" + String(s).replace(/'/g, "''") + "'");
const SYSTEM = new Set(["id", "created_date", "updated_date", "created_by_id", "is_sample"]);

export function toRow(entity, r, idFor) {
  const data = {};
  for (const [k, v] of Object.entries(r)) {
    if (SYSTEM.has(k)) continue;
    const val = value(k, v);
    if (val !== undefined) data[k] = val;
  }
  const id = r.id || idFor(r);
  if (!id) return null;
  const by = /^service_/.test(r.created_by_id || "") ? null : r.created_by_id || (entity === "User" ? id : null);
  return `INSERT OR REPLACE INTO rows (entity, id, created_by_id, created_date, updated_date, data) VALUES (${sql(entity)}, ${sql(id)}, ${sql(by)}, ${sql(iso(r.created_date))}, ${sql(iso(r.updated_date))}, ${sql(JSON.stringify(data))});`;
}

function main() {
  const out = [];
  const ids = JSON.parse(readFileSync(join(dir, "user-ids.json"), "utf8"));
  const users = parseCsv(readFileSync(join(dir, "Nebulux_AI-users.csv"), "utf8"));
  let missing = 0;
  for (const u of users) {
    const line = toRow("User", u, (r) => ids[String(r.email).toLowerCase()]);
    if (line) out.push(line);
    else missing++;
  }
  const counts = { User: users.length - missing };
  for (const e of ["AiActivity", "Base44Purchase", "GameDraft", "GamePlay", "PromoCode", "PromoRedemption", "PublishedGame", "PublishedSite", "SeenEmail", "SiteProduct", "SiteSale", "Team"]) {
    const f = join(dir, `${e}_export.csv`);
    if (!existsSync(f)) continue;
    const rows = parseCsv(readFileSync(f, "utf8"));
    for (const r of rows) {
      const line = toRow(e, r, () => null);
      if (line) out.push(line);
    }
    counts[e] = rows.length;
  }
  writeFileSync(new URL("../db/import.sql", import.meta.url), out.join("\n") + "\n");
  console.log(JSON.stringify(counts), missing ? `(${missing} users without an id were skipped)` : "");
}

if (process.argv[1] && process.argv[1].endsWith("import-base44.mjs")) main();
