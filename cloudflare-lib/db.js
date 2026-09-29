// Nebulux's own records, replacing Base44's database. Every record type (User, PublishedGame,
// Team, ...) lives in the D1 table `rows` (db/schema.sql) with its fields as JSON, and is read and
// written with the same REST shape Base44 used, so the app and the functions didn't change:
//   GET    entities/<E>?q=<json>&sort=-field&limit=&skip=    -> [records]
//   GET    entities/<E>/<id> | entities/User/me              -> record
//   POST   entities/<E>          (create)   PUT entities/<E>/<id>   DELETE entities/<E>/<id>
// A record comes back flat: { id, created_date, updated_date, created_by_id, ...fields }.
// Who may read or change what is RULES below, copied from the Base44 entity settings
// (base44/entities/*.jsonc). The data sets are small, so queries filter in memory.

const OWNER = "owner"; // created_by_id is the user
const ADMIN = "admin";
const PUBLIC = "public";
const SIGNED_IN = "signedIn";

// read / create / update / delete: who is allowed. A field name ("data.userId") means that field
// must be the user's id. Several entries = any one is enough. Admins can always do anything.
const RULES = {
  AiActivity: { read: ["userId"], write: [] },
  Base44Purchase: { read: ["appUserId", OWNER], write: [] },
  GameDraft: { read: [OWNER], create: [SIGNED_IN], write: [OWNER] },
  GamePlay: { read: [], write: [] },
  PromoCode: { read: [], write: [] },
  PromoRedemption: { read: ["userId"], write: [] },
  PublishedGame: { read: [PUBLIC], create: [SIGNED_IN], write: [OWNER] },
  PublishedSite: { read: [PUBLIC], create: [SIGNED_IN], write: [OWNER] },
  SeenEmail: { read: [], write: [] },
  SiteProduct: { read: [OWNER], create: [SIGNED_IN], write: [OWNER] },
  SiteSale: { read: ["creatorId"], write: [] },
  Team: { read: ["ownerId"], write: [] },
  // Users: everyone sees and edits only themselves (entities/User/me), admins see everyone.
  User: { read: ["id"], write: [] },
};

// Fields only an admin (or the server itself) may set on a user; a person can't give
// themselves a plan, credits, admin rights or lift their own ban.
const PROTECTED_USER_FIELDS = ["role", "plan", "planExpiresAt", "banned", "blockedUntil", "blockReason", "bonus", "email", "removed", "status"];
const SYSTEM_FIELDS = ["id", "created_date", "updated_date", "created_by_id", "created_by", "entity"];

export class DbError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

function flat(row) {
  let data = {};
  try {
    data = JSON.parse(row.data) || {};
  } catch {}
  return { ...data, id: row.id, created_date: row.created_date, updated_date: row.updated_date, created_by_id: row.created_by_id };
}

function allowed(rule, rec, user) {
  if (user && user.role === "admin") return true;
  for (const r of rule || []) {
    if (r === PUBLIC) return true;
    if (!user) continue;
    if (r === SIGNED_IN) return true;
    if (r === OWNER && rec && rec.created_by_id === user.id) return true;
    if (r !== OWNER && r !== SIGNED_IN && rec && rec[r] === user.id) return true;
  }
  return false;
}

// The subset of Base44's (Mongo-style) query language the app uses: equal values, $in, $ne,
// $or, $and, $exists, $gt/$gte/$lt/$lte, and "data.field" as another way to write "field".
export function matches(rec, q) {
  if (!q || typeof q !== "object") return true;
  for (const [k0, want] of Object.entries(q)) {
    if (k0 === "$or") {
      if (!(want || []).some((sub) => matches(rec, sub))) return false;
      continue;
    }
    if (k0 === "$and") {
      if (!(want || []).every((sub) => matches(rec, sub))) return false;
      continue;
    }
    const k = k0.startsWith("data.") ? k0.slice(5) : k0;
    const have = rec[k];
    if (want && typeof want === "object" && !Array.isArray(want)) {
      for (const [op, v] of Object.entries(want)) {
        if (op === "$in" && !(v || []).some((x) => same(have, x))) return false;
        if (op === "$nin" && (v || []).some((x) => same(have, x))) return false;
        if (op === "$ne" && same(have, v)) return false;
        if (op === "$eq" && !same(have, v)) return false;
        if (op === "$exists" && (have !== undefined && have !== null) !== !!v) return false;
        if (op === "$gt" && !(have > v)) return false;
        if (op === "$gte" && !(have >= v)) return false;
        if (op === "$lt" && !(have < v)) return false;
        if (op === "$lte" && !(have <= v)) return false;
      }
    } else if (!same(have, want)) return false;
  }
  return true;
}

function same(a, b) {
  if (Array.isArray(a) && !Array.isArray(b)) return a.some((x) => same(x, b));
  if (typeof a === "string" && typeof b === "string" && a.includes("@") && b.includes("@")) return a.toLowerCase() === b.toLowerCase();
  return a === b || (a == null && b == null);
}

function sortBy(list, sort) {
  if (!sort) return list;
  const desc = sort.startsWith("-");
  const f = desc ? sort.slice(1) : sort;
  return list.sort((a, b) => {
    const x = a[f];
    const y = b[f];
    if (x === y) return 0;
    if (x === undefined || x === null) return 1;
    if (y === undefined || y === null) return -1;
    return (x < y ? -1 : 1) * (desc ? -1 : 1);
  });
}

function known(entity) {
  if (!Object.prototype.hasOwnProperty.call(RULES, entity)) throw new DbError(404, `Unknown record type ${entity}`);
}

// ---- Server-side access (functions and cloudflare-lib): `user` may be null (signed out) or
// { system: true } for the server acting on its own, which is allowed everything.

export async function all(db, entity) {
  const r = await db.prepare("SELECT * FROM rows WHERE entity = ?").bind(entity).all();
  return (r.results || []).map(flat);
}

export async function getRow(db, entity, id) {
  const row = await db.prepare("SELECT * FROM rows WHERE entity = ? AND id = ?").bind(entity, id).first();
  return row ? flat(row) : null;
}

const isSystem = (user) => !!(user && user.system);
const asUser = (user) => (isSystem(user) ? { id: "system", role: "admin" } : user);

export async function query(db, entity, user, { q, sort, limit, skip } = {}) {
  known(entity);
  const u = asUser(user);
  let list = (await all(db, entity)).filter((rec) => allowed(RULES[entity].read, rec, u) && matches(rec, q));
  list = sortBy(list, sort || "-created_date");
  const s = Math.max(0, Number(skip) || 0);
  const n = Math.min(5000, Number(limit) || 5000);
  return list.slice(s, s + n);
}

export async function readOne(db, entity, user, id) {
  known(entity);
  const rec = await getRow(db, entity, id);
  if (!rec || !allowed(RULES[entity].read, rec, asUser(user))) throw new DbError(404, "Not found");
  return rec;
}

function clean(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) if (!SYSTEM_FIELDS.includes(k)) out[k] = v;
  return out;
}

export async function create(db, entity, user, data, { id, created_by_id, created_date } = {}) {
  known(entity);
  const u = asUser(user);
  const rule = RULES[entity].create || RULES[entity].write;
  if (!u || !(u.role === "admin" || (rule || []).includes(SIGNED_IN))) throw new DbError(u ? 403 : 401, "Not allowed");
  const now = new Date().toISOString();
  const rec = clean(data);
  const rowId = id || newId();
  const by = created_by_id || (isSystem(user) ? null : u.id);
  await db
    .prepare("INSERT INTO rows (entity, id, created_by_id, created_date, updated_date, data) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(entity, rowId, by, created_date || now, now, JSON.stringify(rec))
    .run();
  return { ...rec, id: rowId, created_date: created_date || now, updated_date: now, created_by_id: by };
}

export async function update(db, entity, user, id, data) {
  known(entity);
  const u = asUser(user);
  const rec = await getRow(db, entity, id);
  if (!rec) throw new DbError(404, "Not found");
  const self = entity === "User" && u && u.id === id;
  if (!self && !allowed(RULES[entity].write, rec, u)) throw new DbError(u ? 403 : 401, "Not allowed");
  let changes = clean(data);
  if (entity === "User" && u.role !== "admin") for (const f of PROTECTED_USER_FIELDS) delete changes[f];
  const { id: _i, created_date, updated_date: _u, created_by_id, ...old } = rec;
  const next = { ...old, ...changes };
  const now = new Date().toISOString();
  await db.prepare("UPDATE rows SET data = ?, updated_date = ? WHERE entity = ? AND id = ?").bind(JSON.stringify(next), now, entity, id).run();
  return { ...next, id, created_date, updated_date: now, created_by_id };
}

export async function remove(db, entity, user, id) {
  known(entity);
  const u = asUser(user);
  const rec = await getRow(db, entity, id);
  if (!rec) throw new DbError(404, "Not found");
  const self = entity === "User" && u && u.id === id;
  if (!self && !allowed(RULES[entity].write, rec, u)) throw new DbError(u ? 403 : 401, "Not allowed");
  await db.prepare("DELETE FROM rows WHERE entity = ? AND id = ?").bind(entity, id).run();
  if (entity === "User") {
    await db.prepare("DELETE FROM logins WHERE user_id = ?").bind(id).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  }
  return { success: true };
}

// Answers one Base44-style REST call (path after /api/apps/<appId>/): used by the /api proxy for
// the app, and by published.js base44() for the functions. -> { status, body }
export async function handleEntities(db, user, method, path, search, body) {
  try {
    const parts = path.split("/").filter(Boolean); // ["entities", E, id?]
    const entity = parts[1];
    let id = parts[2] ? decodeURIComponent(parts[2]) : "";
    const params = new URLSearchParams(search || "");
    if (entity === "User" && id === "me") {
      if (!user || isSystem(user)) return { status: 401, body: { message: "You must be logged in" } };
      id = user.id;
      if (method === "GET") return { status: 200, body: await readOne(db, "User", user, id) };
      if (method === "PUT" || method === "PATCH") return { status: 200, body: await update(db, "User", user, id, body) };
    }
    if (method === "GET" && !id) {
      let q = null;
      if (params.get("q")) {
        try {
          q = JSON.parse(params.get("q"));
        } catch {
          return { status: 400, body: { message: "Bad query" } };
        }
      }
      const list = await query(db, entity, user, { q, sort: params.get("sort"), limit: params.get("limit"), skip: params.get("skip") });
      return { status: 200, body: list };
    }
    if (method === "GET" && id === "count") {
      const q = params.get("q") ? JSON.parse(params.get("q")) : null;
      return { status: 200, body: { count: (await query(db, entity, user, { q })).length } };
    }
    if (method === "GET") return { status: 200, body: await readOne(db, entity, user, id) };
    if (method === "POST" && !id) return { status: 200, body: await create(db, entity, user, body) };
    if (method === "POST" && id === "bulk") {
      const out = [];
      for (const r of Array.isArray(body) ? body : []) out.push(await create(db, entity, user, r));
      return { status: 200, body: out };
    }
    if ((method === "PUT" || method === "PATCH") && id) return { status: 200, body: await update(db, entity, user, id, body) };
    if (method === "DELETE" && id) return { status: 200, body: await remove(db, entity, user, id) };
    return { status: 405, body: { message: "Not supported" } };
  } catch (err) {
    return { status: (err && err.status) || 500, body: { message: (err && err.message) || "Something went wrong" } };
  }
}
