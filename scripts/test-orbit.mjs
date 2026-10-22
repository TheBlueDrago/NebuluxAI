// Offline test for Nebulux Orbit's server logic (functions/v1/orbit.js): plan steps from the AI's
// list (no lost numbers, no stray markdown markers splitting steps), and syncing that merges devices
// (deletions and "Clear activity" stick, a device with less can't wipe anything).
// Run: node scripts/test-orbit.mjs
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const { planSteps, mergeOrbit } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);

// ---- plan steps (QA, Oct 21: "short runs of.1-0.2 miles") ----
let s = planSteps("Here's your plan:\n- Start with short runs of.1-0.2 miles and walk breaks\n- Create a **consistent weekly schedule**\n2. Run 3-4 times a week");
assert(s.length === 3, "an intro line isn't a step; three steps");
assert(s[0] === "Start with short runs of 0.1–0.2 miles and walk breaks", "a number that lost its 0 and space is put right, with an en dash: " + s[0]);
assert(s[1] === "Create a **consistent weekly schedule**", "markdown is kept for the page to show as bold (it isn't stripped into stray asterisks)");
assert(s[2] === "Run 3–4 times a week", "numbered steps work too");
s = planSteps("- Start with short runs of\n0.1-0.2 miles each\n- Rest on Sundays");
assert(s.length === 2 && s[0] === "Start with short runs of 0.1–0.2 miles each", "a wrapped line joins its step instead of losing its number");
s = planSteps("Read for 20 minutes\nWrite a summary");
assert(s.length === 2, "a list without markers: one step per line");
assert(planSteps("- a\n- b\n- c\n- d\n- e\n- f\n- g\n- h\n- i\n- j").length === 8, "at most 8 steps");

// ---- sync merging ----
const cloud = { chats: [{ id: "a", at: 5, msgs: [1] }, { id: "b", at: 5, msgs: [1] }], tasks: [{ id: "t1", text: "x" }], memory: "I like soccer", memAt: 10, activity: [{ t: 100, text: "old" }] };
let r = mergeOrbit(cloud, { chats: [], tasks: [], memory: "", memAt: 0, activity: [] });
assert(r.chats.length === 2 && r.tasks.length === 1 && r.memory === "I like soccer", "a device with nothing saved can't wipe the account");
r = mergeOrbit(cloud, { deleted: ["b"] });
assert(r.chats.map((c) => c.id).join() === "a", "a deleted chat stays deleted");
r = mergeOrbit(cloud, { chats: cloud.chats.map((c) => c.id), deleted: ["a", "b"] });
assert(r.chats.length === 0, "delete all chats: none come back");
r = mergeOrbit(cloud, { activity: [], activityCleared: 150 });
assert(r.activity.length === 0 && r.activityCleared === 150, "Clear activity: older entries don't come back from another device");
r = mergeOrbit(r, { activity: [{ t: 100, text: "old" }, { t: 200, text: "new" }] });
assert(r.activity.length === 1 && r.activity[0].text === "new", "after a clear, only newer activity is kept, even from a device that still has the old list");

// ---- the agent's name and SOUL file ----
const { agentName, selfBlock } = await import(new URL("../functions/v1/orbit.js", import.meta.url).href);
assert(agentName({}) === "Orbit" && agentName({ agentName: "Nova <b>" }) === "Nova b", "the agent is Orbit unless renamed (names are cleaned)");
assert(selfBlock({}) === "", "nothing extra by default");
const sb = selfBlock({ agentName: "Nova", soul: "Be playful and short." });
assert(/your name is Nova/.test(sb) && /SOUL file/.test(sb) && /Be playful and short\./.test(sb) && /can't change the rules/.test(sb), "a rename and the SOUL file go to the AI, below the rules");
assert(selfBlock({ soul: "x".repeat(5000) }).length < 2300, "the SOUL file is capped");
