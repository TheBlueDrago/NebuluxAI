// Offline test for src/lib/errorReport.js: a crash that throws or rejects something that isn't an Error is
// recorded in Monitor → Errors with what it was (its fields, or what failed to load), not "[object Object]".
// Run: node scripts/test-error-report.mjs
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const src = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const out = join(mkdtempSync(join(tmpdir(), "nxerr-")), "report.mjs");
await build({ entryPoints: [join(src, "lib/errorReport.js")], bundle: true, format: "esm", platform: "neutral", outfile: out, alias: { "@": src }, define: { "import.meta.env": "{}" }, logLevel: "silent" });

// A tiny browser: the reporter's listeners, and what it sends to the server.
const listeners = {}, sent = [];
const mem = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { addEventListener: (k, f) => (listeners[k] = f), location: { pathname: "/pricing", search: "", hash: "" }, localStorage: mem, sessionStorage: mem, history: { replaceState() {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = { cookie: "" };
globalThis.fetch = async (url, init) => {
  if (String(url).includes("client-error")) sent.push(JSON.parse(init.body));
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
};
const { describe, installErrorReporting } = await import(pathToFileURL(out).href);
installErrorReporting();
const flush = () => new Promise((r) => setTimeout(r, 20));

listeners.unhandledrejection({ reason: { code: "popup_closed", detail: "The sign-in window was closed" } });
await flush();
assert(sent.length === 1 && sent[0].message === 'Unhandled rejection: {"code":"popup_closed","detail":"The sign-in window was closed"}' && sent[0].path === "/pricing", "a rejected plain object is recorded with its fields (" + (sent[0] || {}).message + ")");

class Timeout { constructor() { this.ms = 5000; } }
listeners.error({ error: new Timeout() });
await flush();
assert(sent.length === 2 && sent[1].message === 'Thrown: Timeout {"ms":5000}', "a thrown object of some class says which class (" + (sent[1] || {}).message + ")");

listeners.unhandledrejection({ reason: "just text" });
await flush();
assert(sent.length === 3 && sent[2].message === "Unhandled rejection: just text", "a rejected string is recorded as it is");

listeners.unhandledrejection({ reason: Object.assign(new Error("Request failed"), { response: { status: 500 } }) });
await flush();
assert(sent.length === 3, "failed requests aren't recorded here (they're shown where they happen)");

const cyc = {}; cyc.self = cyc;
assert(describe(cyc) === "[object Object]" && describe(null) === "null" && describe(5) === "5", "anything that can't be written out still gives something, without crashing");
