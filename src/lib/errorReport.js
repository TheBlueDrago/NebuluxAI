// Sends crashes in this browser to Monitor → Errors (functions/.../client-error.js), so the team
// sees what broke without anyone having to tell them. Only the error message, its stack and the
// page's path are sent, never what was typed. Noise is skipped (browser extensions, dropped
// connections, the harmless ResizeObserver warning), and each error is sent once per page load,
// at most 5 a page.
import { base44 } from "@/api/base44Client";
import { isNetworkError } from "@/lib/netError";

const sent = new Set();
const IGNORE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|AbortError|The user aborted|Load failed|Failed to fetch dynamically imported module|Importing a module script failed/i;

export function reportError(error, extra = "") {
  try {
    const message = String((error && (error.message || error.reason)) || error || "").slice(0, 500);
    const stack = String((error && error.stack) || "") + (extra ? `\n${extra}` : "");
    if (!message || IGNORE.test(message) || IGNORE.test(stack) || isNetworkError(error)) return;
    const key = message + "|" + stack.split("\n")[1];
    if (sent.has(key) || sent.size >= 5) return;
    sent.add(key);
    base44.functions.invoke("client-error", { action: "report", message, stack: stack.slice(0, 2000), path: window.location.pathname }).catch(() => {});
  } catch {
    /* reporting must never cause a crash of its own */
  }
}

export function installErrorReporting() {
  window.addEventListener("error", (e) => {
    // A broken image or script tag also fires "error", with no message: not a crash.
    if (e && e.error) reportError(e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    // Failed requests are already shown to people where they happen.
    if (r && (r.response || r.name === "Base44Error" || r.name === "AxiosError")) return;
    if (r) reportError(r instanceof Error ? r : new Error(String(r)));
  });
}
