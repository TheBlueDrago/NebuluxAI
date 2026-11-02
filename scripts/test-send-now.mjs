// Offline test: a message sent while the AI is still writing goes out right away in every chat (Chat,
// Code, Website Designer, Game Designer): the AI stops, is told what it was doing, and answers the new
// message. Nothing waits in a queue (owner, 2026-11-02). Run: node scripts/test-send-now.mjs
import { readFileSync } from "node:fs";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
for (const f of ["components/ChatBox.jsx", "components/CodePage.jsx", "components/WebsiteDesigner.jsx", "pages/chat/GamesDesigner.jsx"]) {
  const src = read(f);
  const send = (src.match(/const send = (?:async )?\(\) => \{[\s\S]*?\n {4}if \(loading\) \{([\s\S]*?)\n {4}\}/) || [])[1] || "";
  const name = f.split("/").pop();
  assert(send && /q\.setSteer\(/.test(send) && /stop\(/.test(send) && /runPrompt\(text/.test(send), `${name}: a message sent mid-reply stops it and is sent now`);
  assert(!/q\.push\(/.test(src) && !/isAfterMsg/.test(src), `${name}: nothing is put in a queue`);
}
const hook = read("hooks/useMessageQueue.js");
assert(!/isAfterMsg|shouldQueue/.test(hook), "the queue rule for \"after you finish\" messages is gone");
assert(/once you're done \("after you finish…"\), finish what you were doing first, then do that too/.test(hook), "the AI is told to finish first, then do an \"after you finish\" request");
