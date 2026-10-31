// Connectors (Settings → Connectors): the apps a person connected, shared with Nebulux Orbit
// (functions/v1/connect on the server, cloudflare-lib/apps.js for the apps themselves). Connect an app
// once and both use it; the chat reads it when a question is about it.
import { appParams } from "@/lib/app-params";

const token = () => {
  try { return localStorage.getItem("base44_access_token") || appParams.token || ""; } catch { return appParams.token || ""; }
};
export async function connectCall(body) {
  const t = token();
  const r = await fetch("/v1/connect", { method: "POST", headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.error || "Something went wrong. Please try again.");
    e.data = d;
    throw e;
  }
  return d;
}

// Which apps are on, kept on this device so a reply's WhatsApp button shows without asking the server.
const KEY = "nx-apps-on";
export const appsOn = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
export const rememberApps = (apps) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(apps.filter((a) => a.connected).map((a) => a.k)));
    localStorage.setItem(WA_KEY, apps.some((a) => a.k === "whatsapp" && a.linked) ? "1" : "0");
  } catch { /* fine */ }
  window.dispatchEvent(new Event("nx-apps"));
};
export const whatsappLink = (text) => "https://wa.me/?text=" + encodeURIComponent(String(text || "").slice(0, 3000));

// The person's own WhatsApp linked to their account (WhatsApp Business Platform, cloudflare-lib/whatsapp.js):
// replies go straight to it, from a reply's button or by asking in the chat.
const WA_KEY = "nx-wa-linked";
export const waLinked = () => {
  try { return localStorage.getItem(WA_KEY) === "1"; } catch { return false; }
};
export const sendToWhatsApp = (text) => connectCall({ action: "write", app: "whatsapp", op: "send", text, confirmed: true });
// What to show when it couldn't be sent (with a link to message Nebulux first, after WhatsApp's 24 hours).
export const whatsappError = (e) => (e && e.data && e.data.chat ? `${e.message} [Open WhatsApp](${e.data.chat})` : (e && e.message) || "Couldn't send it to WhatsApp.");
export { waIntent } from "./waIntent.js";

// Back from an app's own permission page: ?connected=<app>&result=connected|cancelled|failed|...
export const RESULT_TEXT = {
  connected: (n) => `${n} is connected. Ask about it in any chat.`,
  cancelled: (n) => `${n} wasn't connected (it was cancelled).`,
  failed: (n) => `${n} didn't finish connecting. Please try again.`,
  unavailable: (n) => `${n} can't be connected right now. Please try again later.`,
  signin: () => "Please sign in, then connect the app again.",
};
export const CATS = ["Productivity", "Business", "Social & Entertainment"];
