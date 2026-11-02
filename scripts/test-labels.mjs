// Offline test: every text box, list and picker in the app's code has a name screen readers say: an aria-label,
// aria-labelledby, title, a <label htmlFor>, or a wrapping <label> / <Field label>. A placeholder alone isn't
// enough (it disappears as soon as you type). Run: node scripts/test-labels.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const missing = [];
let seen = 0;
const check = (f) => {
  const s = readFileSync(f, "utf8");
  const re = /<(input|textarea|select)(?=[\s>])/g;
  let m;
  while ((m = re.exec(s))) {
    const lineStart = s.lastIndexOf("\n", m.index) + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(s.slice(lineStart, m.index))) continue; // a comment
    // the end of the opening tag, skipping {...} expressions and quoted text
    let i = m.index + m[0].length, depth = 0, q = null;
    for (; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if ((c === '"' || c === "'" || c === "`") && depth === 0) { q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const tag = s.slice(m.index, i + 1);
    seen++;
    if (/type=["'](hidden|submit|button|radio|checkbox|file|range|color)["']/.test(tag)) continue;
    if (/aria-label|aria-labelledby|\stitle=|\{\.\.\./.test(tag)) continue;
    const id = (tag.match(/\sid=["']([^"']+)["']/) || [])[1];
    if (id && s.includes(`htmlFor="${id}"`)) continue;
    const before = s.slice(Math.max(0, m.index - 900), m.index);
    if (before.lastIndexOf("<label") > before.lastIndexOf("</label>")) continue;
    if (before.lastIndexOf("<Field") > before.lastIndexOf("</Field>")) continue;
    missing.push(relative(root, f) + ":" + s.slice(0, m.index).split("\n").length);
  }
};
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx$/.test(n)) check(p);
  }
};
walk(join(root, "src"));
assert(seen > 80, `found the app's inputs (${seen})`);
assert(!missing.length, "every input, text box and picker has a name for screen readers" + (missing.length ? ": " + missing.join(", ") : ""));
