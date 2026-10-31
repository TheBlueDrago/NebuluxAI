// Offline test for the real WhatsApp connection (cloudflare-lib/whatsapp.js, functions/v1/whatsapp.js and
// WhatsApp in functions/v1/connect): Meta's webhook check and signatures, linking a number with a Connect
// code, chatting with Nebulux AI from WhatsApp, the daily limit, STOP, and "send this to my WhatsApp"
// (only to the person's own number, only within WhatsApp's 24 hours). Run: node scripts/test-whatsapp.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const W = await import(new URL("../cloudflare-lib/whatsapp.js", import.meta.url).href);
const H = await import(new URL("../functions/v1/whatsapp.js", import.meta.url).href);
const C = await import(new URL("../functions/v1/connect/index.js", import.meta.url).href);

// ---- a tiny D1 with just the statements WhatsApp and Connectors use ----
function fakeDb() {
  const links = new Map(), codes = new Map(), seen = new Set(), conns = new Map(), ages = new Map();
  const tokens = new Map([["a".repeat(48), { user_id: "u1", name: "Sam" }]]);
  const byUser = (uid) => [...links.entries()].filter(([, l]) => l.user_id === uid);
  const exec = (sql, a) => {
    let changes = 1;
    if (/DELETE FROM whatsapp_codes WHERE user_id = \? OR exp < \?/.test(sql)) { for (const [c, r] of codes) if (r.user_id === a[0] || r.exp < a[1]) codes.delete(c); }
    else if (/INSERT OR IGNORE INTO whatsapp_codes/.test(sql)) { if (codes.has(a[0])) changes = 0; else codes.set(a[0], { user_id: a[1], exp: a[2] }); }
    else if (/DELETE FROM whatsapp_codes WHERE code = \?/.test(sql)) codes.delete(a[0]);
    else if (/DELETE FROM whatsapp_links WHERE user_id = \? OR k = \?/.test(sql)) { for (const [k] of byUser(a[0])) links.delete(k); links.delete(a[1]); }
    else if (/DELETE FROM whatsapp_links WHERE user_id = \?/.test(sql)) { for (const [k] of byUser(a[0])) links.delete(k); }
    else if (/DELETE FROM whatsapp_links WHERE k = \?/.test(sql)) links.delete(a[0]);
    else if (/INSERT INTO whatsapp_links/.test(sql)) links.set(a[0], { user_id: a[1], last_in: a[2], day: "", n: 0, hist: "[]" });
    else if (/UPDATE whatsapp_links SET last_in = \? WHERE k = \?/.test(sql)) { const l = links.get(a[1]); if (l) l.last_in = a[0]; }
    else if (/UPDATE whatsapp_links SET day = \?, n = \?, hist = \? WHERE k = \?/.test(sql)) { const l = links.get(a[3]); if (l) Object.assign(l, { day: a[0], n: a[1], hist: a[2] }); }
    else if (/UPDATE whatsapp_links SET day = \?, n = \? WHERE k = \?/.test(sql)) { const l = links.get(a[2]); if (l) Object.assign(l, { day: a[0], n: a[1] }); }
    else if (/INSERT OR IGNORE INTO whatsapp_seen/.test(sql)) { if (seen.has(a[0])) changes = 0; else seen.add(a[0]); }
    else if (/INSERT INTO orbit_connections \(user_id, provider, refresh, email, at, scopes, status\) VALUES \(\?, 'whatsapp'/.test(sql)) conns.set(a[0] + "|whatsapp", { user_id: a[0], provider: "whatsapp", refresh: a[1], email: a[2], status: null });
    else if (/INSERT INTO orbit_connections/.test(sql)) conns.set(a[0] + "|" + a[1], { user_id: a[0], provider: a[1], refresh: "-", email: "", status: null });
    else if (/DELETE FROM orbit_connections WHERE user_id = \? AND provider = 'whatsapp'/.test(sql)) conns.delete(a[0] + "|whatsapp");
    else if (/DELETE FROM orbit_connections WHERE user_id = \? AND provider = \?/.test(sql)) conns.delete(a[0] + "|" + a[1]);
    else changes = 0;
    return { success: true, meta: { changes } };
  };
  const query = (sql, a) => {
    if (/FROM whatsapp_codes WHERE code = \?/.test(sql)) return codes.has(a[0]) ? [codes.get(a[0])] : [];
    if (/FROM whatsapp_links WHERE k = \?/.test(sql)) return links.has(a[0]) ? [links.get(a[0])] : [];
    if (/SELECT refresh FROM orbit_connections WHERE user_id = \? AND provider = 'whatsapp'/.test(sql)) return conns.has(a[0] + "|whatsapp") ? [conns.get(a[0] + "|whatsapp")] : [];
    if (/SELECT provider, email, status FROM orbit_connections/.test(sql)) return [...conns.values()].filter((c) => c.user_id === a[0]);
    if (/FROM user_ages/.test(sql)) return ages.has(a[0]) ? [{ birth: ages.get(a[0]) }] : [];
    if (/FROM orbit_tokens/.test(sql)) return tokens.has(a[0]) ? [tokens.get(a[0])] : [];
    if (/PRAGMA/.test(sql)) return [{ name: "scopes" }, { name: "status" }];
    return [];
  };
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => exec(sql, args), first: async () => query(sql, args)[0] || null, all: async () => ({ results: query(sql, args) }) });
  return { prepare: (sql) => stmt(sql), batch: async () => [], links, codes, conns, ages };
}

// ---- Meta's Graph API, made up ----
const sent = [];
let reads = 0, failWindow = false;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (/graph\.facebook\.com\/v21\.0\/PHONE1\/messages/.test(u)) {
    const b = JSON.parse(init.body);
    if (b.status === "read") { reads++; return new Response("{}", { status: 200 }); }
    if (failWindow) return new Response(JSON.stringify({ error: { code: 131047, message: "Re-engagement message" } }), { status: 400 });
    sent.push({ to: b.to, text: b.text.body, auth: init.headers.Authorization });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 });
  }
  return new Response("{}", { status: 404 });
};

const db = fakeDb();
const env = { DB: db, ORBIT_TOKEN_KEY: "test-seal-key", WHATSAPP_TOKEN: "TOKEN1", WHATSAPP_PHONE_ID: "PHONE1", WHATSAPP_APP_SECRET: "app-secret", WHATSAPP_VERIFY_TOKEN: "verify-me", WHATSAPP_NUMBER: "+1 555 010 0000" };
const SAM = "15550123456";
const enc = new TextEncoder();
const sign = async (raw, secret = "app-secret") => "sha256=" + [...new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(raw)))].map((b) => b.toString(16).padStart(2, "0")).join("");
let mid = 0;
const msg = (from, body, extra = {}) => ({ from, id: "wamid." + ++mid, type: "text", text: { body }, ...extra });
const hook = async (messages, { phone = "PHONE1", secret } = {}) => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phone }, messages } }] }] });
  return H.onRequestPost({ request: new Request("https://nebuluxai.com/v1/whatsapp", { method: "POST", headers: { "x-hub-signature-256": await sign(raw, secret) }, body: raw }), env });
};
const call = async (body) => {
  const res = await C.onRequestPost({ request: new Request("https://nebuluxai.com/v1/connect", { method: "POST", headers: { "content-type": "application/json", authorization: "Orbit " + "a".repeat(48), origin: "https://nebuluxai.com" }, body: JSON.stringify(body) }), env: { ...env, GOOGLE_CLIENT_ID: "g" } });
  return { status: res.status, d: await res.json() };
};
let replies = [];
const gen = async (e, prompt) => { replies.push(prompt); return { text: "## Plan\n**Monday**: study\n- read chapter 2" }; };

// 1. Set up only when all four secrets are there.
assert(!W.waReady({ ...env, WHATSAPP_APP_SECRET: "" }) && W.waReady(env), "1. WhatsApp turns on only when all four secrets are set");

// 2. Meta's one-time address check.
const get = (q) => H.onRequestGet({ request: new Request("https://nebuluxai.com/v1/whatsapp?" + q), env });
let r = await get("hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42");
const r2 = await get("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42");
assert(r.status === 200 && (await r.text()) === "42" && r2.status === 403, "2. the webhook answers Meta's check only with the right verify token");

// 3. Signatures.
const raw = '{"a":1}';
assert((await W.signatureOk(env, raw, await sign(raw))) && !(await W.signatureOk(env, raw, await sign(raw, "other"))) && !(await W.signatureOk(env, raw, "")), "3. only calls signed with the app secret are trusted");
r = await hook([msg(SAM, "hi")], { secret: "wrong" });
const off = await H.onRequestPost({ request: new Request("https://nebuluxai.com/v1/whatsapp", { method: "POST", body: "{}" }), env: { DB: db } });
assert(r.status === 401 && off.status === 503 && sent.length === 0, "3b. a forged call is refused, and nothing runs before it's set up");

// 4. Formatting for WhatsApp.
assert(W.toWhatsApp("## Plan\n**Monday**: study\n* item\n[site](https://x.com)") === "*Plan*\n*Monday*: study\n- item\nsite (https://x.com)", "4. markdown becomes WhatsApp formatting");
const parts = W.chunks("word ".repeat(2500));
assert(parts.length === 4 - 1 && parts.every((p) => p.length <= 4000), "4b. long answers go as a few messages under WhatsApp's limit");

// 5. Someone who hasn't linked gets told how.
await hook([msg(SAM, "hi")]);
assert(sent.length === 1 && sent[0].text === H.HELLO_TEXT && sent[0].to === SAM, "5. an unknown number is told how to link");

// 6. Connect gives a code and a WhatsApp link with it.
r = await call({ action: "start", app: "whatsapp" });
const code = r.d.code;
assert(r.status === 200 && /^\d{6}$/.test(code) && r.d.link === `https://wa.me/15550100000?text=${encodeURIComponent("Link Nebulux " + code)}`, "6. Connect gives a one-time code and opens WhatsApp with it ready");

// 7. A wrong code doesn't link.
await hook([msg(SAM, "Link Nebulux 000000")]);
assert(sent.at(-1).text === H.BAD_CODE_TEXT && !db.conns.has("u1|whatsapp"), "7. a wrong code doesn't link anything");

// 8. The right code links the number, kept sealed.
await hook([msg(SAM, "Link Nebulux " + code)]);
const row = db.conns.get("u1|whatsapp");
assert(sent.at(-1).text === H.LINKED_TEXT && row && row.email === "the number ending in 3456" && !row.refresh.includes(SAM) && db.codes.size === 0, "8. the code links the number (stored sealed, shown only as its last 4 digits) and is used up");
assert([...db.links.keys()].every((k) => !k.includes(SAM)), "8b. links are looked up by a keyed hash, never the number itself");

// 9. The list shows it linked.
r = await call({ action: "list" });
const wa = r.d.apps.find((a) => a.k === "whatsapp");
assert(wa.connected && wa.link && wa.linked && wa.account === "the number ending in 3456", "9. Connectors shows WhatsApp linked, with the masked number");

// 10. Chatting with Nebulux AI from WhatsApp.
const before = sent.length;
await H.handle(env, msg(SAM, "Plan my week"), gen);
assert(sent.length === before + 1 && sent.at(-1).text === "*Plan*\n*Monday*: study\n- read chapter 2" && replies[0].includes("Plan my week") && replies[0].startsWith("You are Nebulux AI, answering a message on WhatsApp") && reads === 1, "10. a linked number gets Nebulux AI's answer, formatted for WhatsApp (and the message shows as read)");
const link = [...db.links.values()][0];
assert(link.n === 1 && JSON.parse(link.hist)[0].u === "Plan my week", "10b. the day's count and the last few messages are kept");
await H.handle(env, msg(SAM, "And Tuesday?"), gen);
assert(replies[1].includes("User: Plan my week") && replies[1].includes("User: And Tuesday?"), "10c. a follow-up question sees the earlier messages");

// 11. The same message delivered twice is answered once.
const dup = msg(SAM, "Hello again");
await H.handle(env, dup, gen);
const n1 = sent.length;
await H.handle(env, dup, gen);
assert(sent.length === n1, "11. a message Meta delivers twice is answered once");

// 12. The daily limit.
Object.assign(link, { day: new Date().toISOString().slice(0, 10), n: W.DAILY_MAX });
await H.handle(env, msg(SAM, "one more"), gen);
await H.handle(env, msg(SAM, "and another"), gen);
assert(sent.at(-1).text === H.limitText(W.DAILY_MAX) && sent.filter((s) => s.text === H.limitText(W.DAILY_MAX)).length === 1, "12. past the daily limit it says so once, then stays quiet");
link.n = 0;

// 13. A message for another WhatsApp number of the same Meta app is ignored.
const n2 = sent.length;
await hook([msg(SAM, "hi")], { phone: "OTHER" });
assert(sent.length === n2, "13. messages to a different phone number ID are ignored");

// 14. Accounts under the age limit get no answers.
db.ages.set("u1", "2024-01-01");
await H.handle(env, msg(SAM, "hello"), gen);
assert(sent.length === n2, "14. an account under the age limit gets no answers");
db.ages.delete("u1");

// 15. "Send this to my WhatsApp": only after Send, only to their own number, only within 24 hours.
r = await call({ action: "write", app: "whatsapp", op: "send", text: "**Shopping**: milk" });
assert(r.status === 400, "15. nothing is sent without Send (confirmed)");
r = await call({ action: "write", app: "whatsapp", op: "send", text: "**Shopping**: milk", confirmed: true });
assert(r.status === 200 && sent.at(-1).to === SAM && sent.at(-1).text === "*Shopping*: milk", "15b. it goes to the person's own number, formatted");
link.last_in = Date.now() - 25 * 3600 * 1000;
r = await call({ action: "write", app: "whatsapp", op: "send", text: "late", confirmed: true });
assert(r.status === 400 && r.d.window && /24 hours/.test(r.d.error) && r.d.chat.startsWith("https://wa.me/15550100000"), "15c. after WhatsApp's 24 hours it explains, with a link to message Nebulux first");
link.last_in = Date.now();
failWindow = true;
r = await call({ action: "write", app: "whatsapp", op: "send", text: "x", confirmed: true });
failWindow = false;
assert(r.status === 400 && r.d.window, "15d. if WhatsApp itself says the 24 hours passed, that's explained too");

// 16. STOP unlinks.
await H.handle(env, msg(SAM, "STOP"), gen);
assert(sent.at(-1).text === H.UNLINKED_TEXT && db.links.size === 0 && !db.conns.has("u1|whatsapp"), "16. STOP unlinks the number and removes the connection");

// 17. Disconnect in Connectors removes the link too.
r = await call({ action: "start", app: "whatsapp" });
await hook([msg(SAM, "Link Nebulux " + r.d.code)]);
assert(db.links.size === 1, "17. linking again works");
await call({ action: "disconnect", app: "whatsapp" });
assert(db.links.size === 0 && !db.conns.has("u1|whatsapp"), "17b. Disconnect removes the link and the connection");

// 18. Without the secrets, WhatsApp stays the simple button.
const res = await C.onRequestPost({ request: new Request("https://nebuluxai.com/v1/connect", { method: "POST", headers: { "content-type": "application/json", authorization: "Orbit " + "a".repeat(48) }, body: JSON.stringify({ action: "start", app: "whatsapp" }) }), env: { DB: db, ORBIT_TOKEN_KEY: "k" } });
const d = await res.json();
assert(res.status === 200 && d.ok && !d.code, "18. without the WhatsApp secrets, Connect just turns on the Send to WhatsApp button");

// 19. Which chat messages mean "send to my WhatsApp" (src/lib/waIntent.js).
const { waIntent } = await import(new URL("../src/lib/waIntent.js", import.meta.url).href);
const I = (t) => JSON.stringify(waIntent(t));
assert(I("send this to my WhatsApp") === '{"last":true}' && I("Can you send that to my whatsapp please?") === '{"last":true}' && I("send it to me on WhatsApp") === '{"last":true}', "19. \"send this to my WhatsApp\" sends the last answer");
assert(I("send to my WhatsApp: buy milk and eggs") === '{"body":"buy milk and eggs"}', "19b. \"send to my WhatsApp: …\" sends exactly that");
assert(I("write a short poem about fall and send it to my WhatsApp") === '{"after":true}', "19c. \"write … and send it to my WhatsApp\" sends the new answer once it's written");
assert(waIntent("text my mom on WhatsApp") === null && waIntent("How do I send a message on WhatsApp?") === null && waIntent("send this to my teacher") === null, "19d. other people's WhatsApp, or questions about WhatsApp, aren't this");
