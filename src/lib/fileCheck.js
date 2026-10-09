import { base44 } from "@/api/base44Client";

// Before the Website Designer uses an uploaded file (an attachment or a website ZIP), the server
// checks it (functions/file-check.js): harmful files are refused and the owner is told.
// -> { ok: true } or { ok: false, reason }
export async function checkUpload(file) {
  if (file.size > 12 * 1024 * 1024) return { ok: false, reason: `${file.name} is too big to upload (12 MB max).` };
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  try {
    const r = await base44.functions.invoke("file-check", { name: file.name, type: file.type, data: btoa(bin) });
    return r.data?.ok ? { ok: true } : { ok: false, reason: r.data?.reason || `${file.name} couldn't be checked.` };
  } catch (e) {
    return { ok: false, reason: e?.response?.data?.error || `${file.name} couldn't be checked right now. Try again in a minute.` };
  }
}
