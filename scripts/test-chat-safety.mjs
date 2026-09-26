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

// Weekly quests: same 6 for everyone in a week, different next week; weeks start Monday UTC.
{
  const { weeklyQuests, weekNumber, weekStart, DAILY_CLAIMS } = await import("../workers/nebulux-chat/quests.js");
  const w = weekNumber(Date.parse("2026-09-28T12:00:00Z"));
  assert(weekStart(w) === "2026-09-28T00:00:00.000Z", "weeks start on Monday");
  const a = weeklyQuests(w).map((q) => q.key).join();
  assert(a === weeklyQuests(w).map((q) => q.key).join() && weeklyQuests(w).length === 6, "the same 6 weekly quests for everyone");
  assert(a !== weeklyQuests(w + 1).map((q) => q.key).join(), "weekly quests change next week");
  assert(DAILY_CLAIMS === 2, "2 quest claims a day");
  const { STAR_PACKS } = await import("../workers/nebulux-chat/shop.js");
  const checkout = (await import("node:fs")).readFileSync(new URL("../base44/functions/create-checkout/entry.ts", import.meta.url), "utf8");
  for (const [n, p] of Object.entries(STAR_PACKS)) assert(checkout.includes(`"${n}": "${p.price}"`), `star pack ${n} priced the same in checkout`);
}
