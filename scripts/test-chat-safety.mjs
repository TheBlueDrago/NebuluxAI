// Offline test: what Nebulux Chat lets through (workers/nebulux-chat/safety.js) and the Star shop.
// Run: node scripts/test-chat-safety.mjs
import { cleanMessage, cleanName } from "../workers/nebulux-chat/safety.js";
import { SHOP, DAILY_ORBS } from "../workers/nebulux-chat/shop.js";
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
assert(cleanMessage("hi everyone!").text === "hi everyone!", "normal messages go through");
assert(cleanMessage("call me 512-555-0199").text.includes("[phone number removed]"), "phone numbers are taken out");
assert(cleanMessage("email me at kid@gmail.com").text.includes("[email removed]"), "email addresses are taken out");
assert(cleanMessage("I live at 123 Oak Street").text.includes("[address removed]"), "home addresses are taken out");
assert(cleanMessage("go to evil.com/free-robux").text.includes("[link removed]") && cleanMessage("see https://nova.nebuluxai.com").text.includes("nebuluxai.com"), "outside links taken out, our own kept");
assert(cleanMessage("this is shit").text.includes("****") && !!cleanMessage("fuck shit bitch").error, "bad words starred, a message of only bad words refused");
assert(!!cleanMessage("").error && !!cleanMessage("x".repeat(2001)).error, "empty and too-long messages refused");
assert(cleanName("Sam_2012").name === "Sam_2012" && !!cleanName("NebuluxAdmin").error && !!cleanName("a").error, "names: normal ok, official-looking or too short refused");
assert(DAILY_ORBS > 0 && Object.values(SHOP).every((i) => (i.price > 0 || i.plusOnly) && ["name_color", "frame", "badge", "banner", "deco", "effect"].includes(i.kind)), "the Star shop has priced items");

