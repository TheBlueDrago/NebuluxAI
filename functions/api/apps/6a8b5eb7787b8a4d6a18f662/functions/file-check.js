// Every file someone uploads to the Website Designer (an attachment or a website ZIP) is checked
// here before it's used: known-dangerous file types are refused right away, then the AI looks at
// the contents (code and text, pictures). A harmful file is refused and the owner gets an email
// about it (with the file attached when it's safe to attach). Signed-in users only.
//   { name, type, data: base64 }  -> { ok: true } | { ok: false, reason }
import JSZip from "jszip";
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow } from "../../../../../cloudflare-lib/ratelimit.js";
import { scanPage } from "../../../../../cloudflare-lib/scan.js";

const MAX = 12 * 1024 * 1024;
const EXEC = /\.(exe|dll|scr|msi|bat|cmd|com|ps1|vbs|vbe|wsf|jar|apk|app|dmg|pkg|deb|rpm|sh|lnk|hta|reg|cpl|iso|img|bin)$/i;
const TEXT = /\.(html?|css|js|mjs|json|svg|txt|md|xml|csv)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|avif)$/i;
const IMG_TYPE = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif" };

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const magicExec = (u8) => (u8[0] === 0x4d && u8[1] === 0x5a) || (u8[0] === 0x7f && u8[1] === 0x45 && u8[2] === 0x4c && u8[3] === 0x46) || (u8[0] === 0xcf && u8[1] === 0xfa && u8[2] === 0xed && u8[3] === 0xfe);

// What's inside: text of code files, a few pictures, and anything dangerous by name or bytes.
async function contents(name, bytes) {
  const out = { text: [], images: [], danger: [] };
  const add = async (path, u8) => {
    if (EXEC.test(path) || magicExec(u8)) out.danger.push(`${path} is a program or script file`);
    else if (TEXT.test(path)) out.text.push(`--- ${path} ---\n` + new TextDecoder().decode(u8).slice(0, 40000));
    else if (IMAGE.test(path) && out.images.length < 4 && u8.length < 3 * 1024 * 1024) out.images.push({ path, mime: IMG_TYPE[path.split(".").pop().toLowerCase()], data: bytesToB64(u8) });
  };
  if (/\.zip$/i.test(name) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    const zip = await JSZip.loadAsync(bytes).catch(() => null);
    if (!zip) { out.danger.push("the ZIP can't be opened"); return out; }
    const files = Object.values(zip.files).filter((f) => !f.dir).slice(0, 400);
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) { out.danger.push(`${f.name} is a ZIP inside the ZIP`); continue; }
      await add(f.name, await f.async("uint8array"));
    }
  } else await add(name, bytes);
  return out;
}

async function aiVerdict(apiKey, name, c) {
  const prompt = [
    "You check files uploaded to a website builder used by kids, before they're added to a website.",
    'Decide if the file is harmful: malware or malicious code (stealing data, cookies or passwords, crypto miners, wallet drainers, hidden redirects or downloads), phishing or scam pages, adult/sexual content, very violent or hateful content, or anything illegal.',
    "Normal website code, pictures and text are NOT harmful. Be fair: only say harmful when it really is.",
    'Reply with ONLY JSON: {"harmful": true|false, "reason": "short reason if harmful"}',
    "",
    `File: ${name}`,
    c.text.join("\n\n").slice(0, 80000) || "(no text files; pictures are attached)",
  ].join("\n");
  const parts = [{ text: prompt }, ...c.images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }))];
  for (const model of ["gemini-3.6-flash", "gemini-3.8-flash"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 1024, responseMimeType: "application/json" } }),
      });
      if (!res.ok) continue;
      const d = await res.json();
      const t = ((d.candidates?.[0]?.content?.parts) || []).map((p) => (p.thought ? "" : p.text || "")).join("");
      const v = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      if (typeof v.harmful === "boolean") return { harmful: v.harmful, reason: String(v.reason || "").slice(0, 200) };
    } catch {}
  }
  return null;
}

async function ownerEmails(env) {
  if (!env.DB) return [];
  const r = await env.DB.prepare("SELECT json_extract(data, '$.email') AS email FROM rows WHERE entity = 'User' AND json_extract(data, '$.role') = 'admin'").all().catch(() => ({ results: [] }));
  return [...new Set((r.results || []).map((x) => x.email).filter(Boolean))].slice(0, 5);
}

async function report(env, user, name, bytes, reason, attach) {
  const to = await ownerEmails(env);
  if (!env.RESEND_API_KEY || !to.length) return;
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const text = `A file uploaded to the Website Designer was refused.\n\nFile: ${name} (${Math.round(bytes.length / 1024)} KB)\nSHA-256: ${hash}\nWhy: ${reason}\nUploaded by: ${user.email || user.id} (${user.id})\nWhen: ${new Date().toISOString()}\n\n${attach ? "The file is attached. Don't open it on your computer." : "The file isn't attached because it's a program or script file."}`;
  const send = (withFile) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Nebulux AI <support@nebuluxai.com>", to, subject: `Refused upload: ${name}`, text, ...(withFile ? { attachments: [{ filename: name + ".blocked", content: bytesToB64(bytes) }] } : {}) }),
  }).catch(() => null);
  const r = await send(attach && bytes.length <= 8 * 1024 * 1024);
  if (attach && (!r || !r.ok)) await send(false);
}

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (!(await allow(`filecheck:${user.id}`, 60, 3600))) return json({ error: "You've uploaded a lot of files. Try again later." }, 429);
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  let bytes;
  try { bytes = b64ToBytes(String(body.data || "")); } catch { return json({ error: "That file couldn't be read." }, 400); }
  if (!bytes.length) return json({ error: "That file is empty." }, 400);
  if (bytes.length > MAX) return json({ ok: false, reason: "That file is too big to check (12 MB max)." });

  const c = await contents(name, bytes);
  if (c.danger.length) {
    const reason = c.danger.slice(0, 3).join("; ");
    await report(env, user, name, bytes, reason, false);
    return json({ ok: false, reason: `This file was refused: ${reason}. Program and script files can't be uploaded.` });
  }
  // A quick pattern check of any page in it, then the AI.
  const pages = c.text.filter((t) => /^--- .*\.html?/i.test(t)).join("\n");
  const quick = pages ? scanPage(pages) : null;
  const ai = env.GEMINI_API_KEY ? await aiVerdict(env.GEMINI_API_KEY, name, c) : null;
  const harmful = (ai && ai.harmful) || (quick && quick.block && quick.block.length > 0);
  if (harmful) {
    const reason = (ai && ai.harmful && ai.reason) || quick.block.join("; ") || "it looks harmful";
    await report(env, user, name, bytes, reason, true);
    return json({ ok: false, reason: `This file was refused because ${reason.replace(/^[A-Z]/, (x) => x.toLowerCase())}.` });
  }
  return json({ ok: true, checked: !!ai });
}
