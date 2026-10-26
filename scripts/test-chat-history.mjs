// Offline test for the conversation sent with each chat message (src/lib/chatHistory.js).
// Run: node scripts/test-chat-history.mjs
import { historyBlock, HISTORY_TOTAL, HISTORY_EACH } from "../src/lib/chatHistory.js";

let failed = 0;
const assert = (c, m) => {
  console.log((c ? "ok " : "FAIL ") + m);
  if (!c) failed++;
};

assert(historyBlock([]) === "" && historyBlock(undefined) === "", "a new chat sends no history");
const h = historyBlock([
  { role: "user", content: "Quiz me on fractions (attached: notes.pdf)" },
  { role: "ai", content: "What is 1/2 + 1/4?" },
  { role: "ai", content: "\u26A0 The AI is busy. Please try again." }, { role: "ai", err: true, content: "The connection dropped." },
]);
assert(h.includes("User: Quiz me on fractions\n") && h.includes("Assistant: What is 1/2 + 1/4?"), "earlier questions and answers are included");
assert(!h.includes("\u26A0") && !h.includes("The connection dropped") && !h.includes("attached:"), "error notes and attachment names are left out");
assert(h.endsWith("Latest message:\n"), "it ends by pointing at the new message");
const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "ai" : "user", content: `m${i} ` + "x".repeat(3000) }));
const hl = historyBlock(long);
assert(hl.length < HISTORY_TOTAL + 400, "long chats are capped");
assert(hl.includes("m29 ") && !hl.includes("m10 "), "the newest messages are the ones kept");
assert(!hl.includes("x".repeat(HISTORY_EACH + 1)), "each message is capped too");

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
