// Prepaid API credit (the Nebulux Platform, nebuluxai.com/api). Each AI has its own balance per
// account (owner, 2026-10-07), in millicents (1/1000 of a cent): money added to Galaxy only pays
// for Galaxy requests, and so on. An account also has a switch, "Use API key credits" (Settings →
// Usage), that must be on for its API keys and website AI to work, and the API billing agreement.
// Every request takes its cost from that model's balance; when it runs out, requests to that model
// stop until more is added. Money only goes in through a verified payment (payment provider:
// "later") or an admin grant.
//
// Prices (owner, 2026-10-07): Nebulux AI costs $0.10 per request (the input) plus $0.10 per credit
// of reply (the output: 1 credit per started 10,000 characters, times the effort level, the same
// credits as chatting). Galaxy is 2x, Space 3x, Nebula 5x (Nebula: $0.50 in, $0.50 per credit out).
import { CHARS_PER_CREDIT, EFFORT_MULT } from "./credits.js";

export const BASE = 10000; // $0.10 in millicents
export const PRICES = { "nebulux-ai": 1, galaxy: 2, space: 3, nebula: 5 }; // multipliers
export const MODEL_IDS = Object.keys(PRICES);
export const MIN_TOPUP = { "nebulux-ai": 2, galaxy: 3, space: 4, nebula: 5 }; // dollars
export const EFFORT_X = EFFORT_MULT;
export const toMc = (dollars) => Math.round(dollars * 100000);

let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS api_account (user_id TEXT PRIMARY KEY, use_api INTEGER DEFAULT 0, agreed_at TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS api_balance (user_id TEXT NOT NULL, model TEXT NOT NULL, balance INTEGER DEFAULT 0, funded INTEGER DEFAULT 0, PRIMARY KEY (user_id, model))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS api_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, at TEXT, kind TEXT, model TEXT, amount INTEGER, note TEXT)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS api_ledger_user ON api_ledger (user_id, id)").run();
  ready = true;
}
export async function account(db, userId) {
  await ensure(db);
  const a = await db.prepare("SELECT use_api, agreed_at FROM api_account WHERE user_id = ?").bind(userId).first();
  const rows = (await db.prepare("SELECT model, balance, funded FROM api_balance WHERE user_id = ?").bind(userId).all()).results || [];
  const balances = Object.fromEntries(MODEL_IDS.map((m) => [m, 0]));
  let funded = false;
  for (const r of rows) if (r.model in balances) { balances[r.model] = r.balance || 0; if (r.funded) funded = true; }
  return { balances, useApi: !!(a && a.use_api), agreedAt: (a && a.agreed_at) || null, funded };
}
async function upsert(db, userId) {
  await ensure(db);
  await db.prepare("INSERT OR IGNORE INTO api_account (user_id) VALUES (?)").bind(userId).run();
}
export async function setUseApi(db, userId, on) {
  await upsert(db, userId);
  await db.prepare("UPDATE api_account SET use_api = ? WHERE user_id = ?").bind(on ? 1 : 0, userId).run();
}
export async function agree(db, userId) {
  await upsert(db, userId);
  await db.prepare("UPDATE api_account SET agreed_at = ? WHERE user_id = ?").bind(new Date().toISOString(), userId).run();
}
// Money in, for one model: a verified payment or an admin grant (amount in millicents).
export async function addFunds(db, userId, model, amount, kind, note) {
  await upsert(db, userId);
  await db.prepare("INSERT INTO api_balance (user_id, model, balance, funded) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, model) DO UPDATE SET balance = balance + excluded.balance, funded = 1").bind(userId, model, amount).run();
  await db.prepare("INSERT INTO api_ledger (user_id, at, kind, model, amount, note) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, new Date().toISOString(), kind, model, amount, String(note || "").slice(0, 120)).run();
}
// Money out: one request, from that model's balance. Never below zero.
export async function charge(db, userId, model, amount, note) {
  if (amount <= 0) return;
  const row = await db.prepare("SELECT balance FROM api_balance WHERE user_id = ? AND model = ?").bind(userId, model).first();
  amount = Math.min(amount, (row && row.balance) || 0); // what is really taken
  if (amount <= 0) return;
  await db.prepare("UPDATE api_balance SET balance = MAX(0, balance - ?) WHERE user_id = ? AND model = ?").bind(amount, userId, model).run();
  await db.prepare("INSERT INTO api_ledger (user_id, at, kind, model, amount, note) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, new Date().toISOString(), "charge", model, -amount, String(note || "").slice(0, 120)).run();
}
export async function ledger(db, userId, n = 30) {
  await ensure(db);
  const r = await db.prepare("SELECT at, kind, model, amount, note FROM api_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?").bind(userId, n).all();
  return r.results || [];
}
// Credits a reply uses: 1 per started 10,000 characters (at least 1), times the effort level.
export const replyCredits = (effort, replyChars) => Math.max(1, Math.ceil((replyChars || 0) / CHARS_PER_CREDIT)) * (EFFORT_X[effort] || 1);
// The cost of one request, in millicents: input + output, times the model's multiplier.
export function costOf(model, effort, promptChars, replyChars) {
  const m = PRICES[model] || 1;
  return (BASE + BASE * replyCredits(effort, replyChars)) * m;
}
// The longest reply a balance covers (so a request never spends more than is there); 0 = not even one credit.
export function maxReplyChars(model, effort, promptChars, balance) {
  const m = PRICES[model] || 1;
  const credits = Math.floor(balance / (BASE * m)) - 1; // after paying for the input
  const perCredit = EFFORT_X[effort] || 1;
  return credits >= perCredit ? Math.floor(credits / perCredit) * CHARS_PER_CREDIT : 0;
}
export const dollars = (millicents) => (millicents / 100000).toFixed(2);
