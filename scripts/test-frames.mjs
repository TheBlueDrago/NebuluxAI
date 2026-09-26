// Offline guard for how the app shows pages people make: every <iframe> in src/ is sandboxed,
// a frame showing HTML from the app's own origin (srcDoc) can never also get
// allow-same-origin (that pair would let a page's script reach the signed-in account), and
// chat replies are never rendered as raw HTML. Also: new-tab links use rel="noopener", and
// security.txt is renewed before it expires.
// Run: node scripts/test-frames.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// File paths that work on Windows too (a URL pathname there is /C:/…).
const R = fileURLToPath(new URL("../", import.meta.url));
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(f)) files.push(p);
  }
})(join(R, "src"));

const { PREVIEW_SANDBOX } = await import(pathToFileURL(join(R, "src/lib/previewShim.js")).href);
assert(!PREVIEW_SANDBOX.includes("allow-same-origin"), "previews can't reach the app's origin");
assert(!PREVIEW_SANDBOX.includes("allow-top-navigation"), "previews can't move the app's tab to another page");

// Frames allowed to pair scripts with allow-same-origin: they only ever load another
// website's address (checked by siteUrl / safeWebUrl), never HTML on the app's origin.
// (None now: Blackhole Browser, which had two, was removed.)
const OTHER_ORIGIN_FRAMES = {};

// The sandbox value a frame uses: a string literal, PREVIEW_SANDBOX, or a constant in the file.
function sandboxOf(tag, src) {
  const lit = tag.match(/sandbox=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\})/);
  if (lit) return lit[1] ?? lit[2];
  const ref = tag.match(/sandbox=\{\s*([A-Z_]+)\s*\}/);
  if (!ref) return null;
  if (ref[1] === "PREVIEW_SANDBOX") return PREVIEW_SANDBOX;
  const def = src.match(new RegExp(`const ${ref[1]}\\s*=\\s*"([^"]*)"`));
  return def ? def[1] : null;
}

let frames = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(R, file).split(sep).join("/");
  for (const m of src.matchAll(/<iframe\b[\s\S]*?\/?>/g)) {
    frames++;
    const tag = m[0];
    const line = src.slice(0, m.index).split("\n").length;
    const where = `${rel}:${line}`;
    const sandbox = sandboxOf(tag, src);
    assert(sandbox != null, `${where} frame is sandboxed`);
    if (sandbox == null) continue;
    assert(!/allow-top-navigation/.test(sandbox), `${where} frame can't move the app's tab`);
    if (sandbox.includes("allow-same-origin") && sandbox.includes("allow-scripts")) {
      const guard = OTHER_ORIGIN_FRAMES[rel];
      assert(!!guard && src.includes(guard) && !/srcDoc/.test(tag), `${where} scripts + same-origin only for a checked outside address`);
    }
  }
  assert(!/rehype-raw|rehypeRaw|allowDangerousHtml/.test(src), `${rel} doesn't turn raw HTML on in markdown`);
  if (/dangerouslySetInnerHTML/.test(src)) {
    // Only the chart styles (built from the app's own colour config) may set raw HTML.
    assert(rel === "src/components/ui/chart.jsx", `${rel} doesn't set raw HTML`);
  }
}
assert(frames >= 5, `found the app's frames (${frames})`);

const pkg = JSON.parse(readFileSync(join(R, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
assert(!deps["rehype-raw"], "rehype-raw isn't installed");

// The JSX opening tag starting at i, up to its closing ">" (skipping any inside {…} or quotes).
function openingTag(src, i) {
  let depth = 0;
  let quote = "";
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (depth === 0 && c === ">") return src.slice(i, j + 1);
  }
  return src.slice(i);
}

// Links that open a new tab don't hand that tab a handle on the app's own tab (window.opener),
// which a page could use to swap the app for a look-alike sign-in page while you're away.
// Router <Link>s to the app's own pages are fine.
{
  // window.open without "noopener", and why it needs the handle.
  const OPENER_OK = { "src/components/designer/GitHubPush.jsx": "watches the GitHub sign-in popup close" };
  let links = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = relative(R, file).split(sep).join("/");
    for (const m of src.matchAll(/<a\s/g)) {
      const tag = openingTag(src, m.index);
      if (!/target=(?:"_blank"|\{"_blank"\})/.test(tag)) continue;
      links++;
      const line = src.slice(0, m.index).split("\n").length;
      assert(/\brel=(?:"[^"]*|\{"[^"]*)noopener/.test(tag), `${rel}:${line} new-tab link has rel="noopener"`);
    }
    for (const m of src.matchAll(/window\.open\(([^)]*)\)/g)) {
      if (!/_blank/.test(m[1])) continue;
      assert(/noopener/.test(m[1]) || OPENER_OK[rel], `${rel} window.open(${m[1]}) uses noopener${OPENER_OK[rel] ? ` (not needed: ${OPENER_OK[rel]})` : ""}`);
    }
  }
  assert(links >= 16, `found the new-tab links (${links})`);
}

// public/.well-known/security.txt says until when it's valid (RFC 9116). Fails a month before
// that date, so it gets renewed: change Expires to a year later.
{
  const txt = readFileSync(join(R, "public/.well-known/security.txt"), "utf8");
  const expires = Date.parse((/^Expires:\s*(\S+)/m.exec(txt) || [])[1]);
  const days = Math.floor((expires - Date.now()) / 86400000);
  assert(days > 30, `security.txt is valid for ${days} more days (renew its Expires date when this fails)`);
  assert(/^Contact:\s*\S+/m.test(txt), "security.txt has a contact");
}
