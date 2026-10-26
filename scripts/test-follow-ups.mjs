// Offline test: the quick follow-up buttons under an answer (src/lib/followUps.js).
// Run: node scripts/test-follow-ups.mjs
import { followUps } from "../src/lib/followUps.js";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const long = "Photosynthesis is how plants make food. ".repeat(20);
assert(followUps("what is photosynthesis", long).join() === "Explain it more simply,Make flashcards,Quiz me on this", "explanations: simpler, flashcards, quiz");
assert(followUps("write a python loop", "Here:\n```py\nfor i in range(3): print(i)\n```").includes("Explain this code step by step"), "code gets code follow-ups");
assert(followUps("write a poem about cats", "Soft paws and whiskers bright, ".repeat(10)).join() === "Make it shorter,Make it funnier,Make it more formal", "writing gets rewrite follow-ups");
assert(followUps("hi", "\u26A0 Nebulux AI is very busy right now.").length === 0 && followUps("x", "some text\n\n_(stopped)_").length === 0, "errors and stopped answers get none");
assert(followUps("hi", "Hello! How can I help?").length === 0, "short replies like a greeting get none");
assert(followUps("q", long.repeat(3)).length === 3, "never more than three");
assert(followUps("make flashcards", "Here you go:\n```flashcards\nQ: a\nA: b\n```").join() === "Make 10 more flashcards,Quiz me on this", "flashcards get study follow-ups, not code ones");
