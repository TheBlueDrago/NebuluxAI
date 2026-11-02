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
