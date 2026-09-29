// Offline test: a build reply the AI didn't finish is recognised and joined with its
// continuation (src/lib/buildReply.js). Run: node scripts/test-build-continue.mjs
import { looksCut, joinContinuation, splitBuildReply } from "../src/lib/buildReply.js";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const game = "<!DOCTYPE html><html><head><style>body{background:#000}</style></head><body><canvas></canvas><script>" + Array.from({ length: 40 }, (_, i) => "function f" + i + "(){return " + i * 7 + "}").join(";") + "</script></body></html>";
const reply = "Here you go!\n\n```html\n" + game + "\n```\n\nWhat I did: a game.";
const cutAt = Math.floor(reply.length * 0.55);
const first = reply.slice(0, cutAt);
assert(looksCut(first), "a reply that stops before </html> is seen as cut off");
assert(!looksCut(reply), "a finished reply isn't");
assert(!looksCut("Sure, what colour should it be?"), "a plain answer isn't");
// The AI's continuation often repeats a little and opens a new code block.
const rest = "```html\n" + reply.slice(cutAt - 60);
const joined = joinContinuation(first, rest);
assert(joined === reply, "the continuation joins on exactly, without repeats");
assert(splitBuildReply(joined).html === game, "the joined reply gives the whole game");
