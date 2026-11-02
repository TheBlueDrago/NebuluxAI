// Offline test: text shown with its line breaks kept (whitespace-pre-wrap) also breaks long words and links,
// so a pasted link can't make a chat bubble run off a phone screen and the whole chat slide sideways.
// Also checks the Android keyboard setting and the phone touch areas for the small buttons under chat messages are still there.
// Run: node scripts/test-wrap.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(n)) files.push(p);
  }
};
walk(join(root, "src"));

const unwrapped = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("whitespace-pre-wrap") && !/break-words|break-all|overflow-wrap/.test(line)) unwrapped.push(f.slice(root.length) + ":" + (i + 1));
  });
}
assert(unwrapped.length === 0, "every whitespace-pre-wrap also breaks long words" + (unwrapped.length ? ": " + unwrapped.join(", ") : ""));

const chat = readFileSync(join(root, "src/components/ChatBox.jsx"), "utf8");
assert(/max-w-\[80%\][^"]*\[overflow-wrap:anywhere\]/.test(chat), "your own chat messages wrap long links");
assert(chat.includes('className="msg-acts '), "the buttons under the AI's replies are marked for bigger phone touch areas");
assert((chat.match(/tap-sm /g) || []).length >= 2, "copy and edit beside your own messages have bigger phone touch areas");
const css = readFileSync(join(root, "src/index.css"), "utf8");
assert(/\.msg-acts > button::after[^{]*\{[^}]*inset:/.test(css), "index.css gives those buttons their bigger touch area");

const page = readFileSync(join(root, "index.html"), "utf8");
assert(/<meta name="viewport" content="[^"]*interactive-widget=resizes-content/.test(page), "on Android the page shrinks when the keyboard opens, so the chat box stays above it");

// The big email address on About and Contact breaks after the @ on small phones (break-all left "om" alone).
for (const f of ["src/pages/About.jsx", "src/pages/Contact.jsx"]) {
  const src = readFileSync(join(root, f), "utf8");
  assert(/<EmailText email=\{CONTACT_EMAIL\}/.test(src) && !/break-all">\{CONTACT_EMAIL\}/.test(src), `${f.split("/").pop()} shows the email with EmailText`);
}
assert(/<wbr \/>/.test(readFileSync(join(root, "src/components/EmailText.jsx"), "utf8")), "EmailText lets the address break after the @");

// tailwindcss-animate also defines duration-*, ease-* and delay-*, so a custom value like duration-[380ms]
// matches two plugins and Tailwind silently leaves it out (the sidebar and the intro screen lost their timing).
// Custom timings use the CSS property itself: [transition-duration:380ms].
{
  const { readdirSync, statSync } = await import("node:fs");
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(n)) files.push(p); } };
  walk(join(root, "src"));
  const bad = files.flatMap((f) => (readFileSync(f, "utf8").match(/(?<![\w-])(duration|ease|delay)-\[[^\]]+\]/g) || []).map((m) => f.slice(root.length + 1) + ": " + m));
  assert(!bad.length, "no duration-[…], ease-[…] or delay-[…] classes, which Tailwind drops here" + (bad.length ? ": " + bad.join(", ") : ""));
}
