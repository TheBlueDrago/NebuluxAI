// Checked by publish() in published.js before a site or game goes live: refuses pages
// whose forms send passwords or card numbers to another website (the classic phishing
// page). No imports, so published.js can use it without a circular import.

// Finds a <form> that collects a password or card number and submits it to another
// website. Returns a short description of what was found, or "" if the page is fine.
// Forms that post to this page, a relative path, or a nebuluxai.com address
// are allowed (sites built here can't receive form posts anyway).
export function findCredentialForm(html) {
  const text = String(html || "");
  const forms = text.match(/<form\b[^>]*>[\s\S]*?(<\/form>|$)/gi) || [];
  for (const form of forms) {
    const open = form.match(/<form\b[^>]*>/i)[0];
    const action = (open.match(/\baction\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || "";
    const sensitive =
      /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(form)
        ? "password"
        : /\b(autocomplete|name|id)\s*=\s*["']?(cc-number|cc-csc|cardnumber|card[-_]?number|cvv|cvc|card[-_]?cvc)\b/i.test(form)
          ? "card number"
          : "";
    if (sensitive && isExternal(action)) return `a form that sends a ${sensitive} to ${hostOf(action)}`;
  }
  return "";
}

function isExternal(action) {
  if (!/^(https?:)?\/\//i.test(action)) return false;
  const host = hostOf(action);
  return !(host === "nebuluxai.com" || host.endsWith(".nebuluxai.com") || host.endsWith("nebuluxai.pages.dev"));
}

function hostOf(url) {
  try {
    return new URL(url, "https://x.invalid").hostname.toLowerCase();
  } catch {
    return "another website";
  }
}

// Stricter checks, used when a page is published and in Monitor's scan (scan.js), but not
// when already-published pages are served, so an existing page is never taken down by them
// without a person looking. Returns a short description, or "".
//
// 1. A page with a password or card-number field that sends data to another website from a
//    script (fetch, XMLHttpRequest, sendBeacon, WebSocket, an image "beacon" built from
//    values, or a form whose action is changed by script). A form isn't needed for that.
// 2. A sign-in page dressed up as Nebulux AI's (its title or main heading says Blackhole
//    AI, and it asks for a password), to trick people into typing their real password.
const SENSITIVE_FIELD =
  /<input\b[^>]*\btype\s*=\s*["']?password\b|\b(autocomplete|name|id)\s*=\s*["']?(cc-number|cc-csc|cardnumber|card[-_]?number|cvv|cvc|card[-_]?cvc)\b/i;
const HOST = "(?:https?:|wss?:)?\\/\\/([^\\/`'\"\\s?#:]+)";
const SENDERS = [
  new RegExp(`\\bfetch\\s*\\(\\s*[\`'"]${HOST}`, "gi"),
  new RegExp(`\\.open\\s*\\(\\s*[\`'"][A-Za-z]+[\`'"]\\s*,\\s*[\`'"]${HOST}`, "gi"),
  new RegExp(`sendBeacon\\s*\\(\\s*[\`'"]${HOST}`, "gi"),
  new RegExp(`new\\s+WebSocket\\s*\\(\\s*[\`'"]${HOST}`, "gi"),
  new RegExp(`\\.src\\s*=\\s*[\`'"]${HOST}[^\`'"]*[\`'"]\\s*\\+`, "gi"),
  new RegExp(`\\.action\\s*=\\s*[\`'"]${HOST}`, "gi"),
];

export function findCredentialLeak(html) {
  const text = String(html || "");
  if (!SENSITIVE_FIELD.test(text)) return "";
  const what = /type\s*=\s*["']?password/i.test(text) ? "password" : "card number";
  for (const re of SENDERS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const host = m[1].toLowerCase();
      if (!isOurs(host)) return `a ${what} field and a script that sends data to ${host}`;
    }
  }
  const title = (text.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const heading = (text.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i) || [])[1] || "";
  if (what === "password" && /(nebulux|blackhole)\s*ai/i.test(`${title} ${heading.replace(/<[^>]+>/g, " ")}`)) {
    return "a sign-in page that looks like Nebulux AI's own";
  }
  return "";
}

const isOurs = (host) => host === "nebuluxai.com" || host.endsWith(".nebuluxai.com") || host.endsWith("nebuluxai.pages.dev");
