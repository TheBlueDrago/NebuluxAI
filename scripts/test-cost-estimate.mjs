// The cost shown before a message is sent (src/lib/costEstimate.js) must use the same numbers the
// server charges with (cloudflare-lib/creditSession.js), and the featured game must be stable.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import * as est from "../src/lib/costEstimate.js";
import * as real from "../cloudflare-lib/creditSession.js";

let n = 0;
const ok = (c, m) => { assert(c, m); n++; };
const src = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

ok(JSON.stringify(est.AI_MULT) === JSON.stringify(real.AI_MULT), "the AI multipliers match the server's");
ok(est.THINK_WEIGHT === real.THINK_WEIGHT && est.IMAGE_TOKENS === real.IMAGE_TOKENS, "thinking weight and picture tokens match");
const serverEst = /const THINK_EST = (\{[^}]+\})/.exec(src("cloudflare-lib/creditSession.js"))[1];
ok(JSON.stringify(est.THINK_EST) === JSON.stringify(Function("return " + serverEst)()), "thinking estimates match the server's");

// the estimate equals what the server would charge for an answer of the typical length
for (const tier of Object.keys(real.AI_MULT)) for (const effort of ["low", "medium", "high"]) {
  const question = "x".repeat(400), answer = "y".repeat(est.REPLY_TOKENS.chat * 4);
  const charged = real.tokensUsed({ tokens: null, text: answer, question, effort, tier });
  const guess = est.estimateTokens({ text: question, tier, effort, kind: "chat" });
  ok(Math.abs(charged - guess) <= 2, `${tier}/${effort}: estimate ${guess} is what the server charges ${charged}`);
}
ok(est.estimateTokens({ text: "hi", tier: "space5" }) === 3 * est.estimateTokens({ text: "hi", tier: "ai" }) || Math.abs(est.estimateTokens({ text: "hi", tier: "space5" }) - 3 * est.estimateTokens({ text: "hi", tier: "ai" })) <= 2, "Nebula costs three times Nebulux AI");
ok(est.estimateTokens({ text: "a site", kind: "build" }) > 5 * est.estimateTokens({ text: "a site", kind: "chat" }), "building costs far more than a chat answer");
ok(est.estimateTokens({ text: "x", images: 2 }) - est.estimateTokens({ text: "x" }) === 2 * real.IMAGE_TOKENS, "pictures are counted");

const limits = (left, wleft = 1e6) => ({ session: { limit: 100000, left, resetAt: Date.now() + 60000, hours: 5 }, week: { limit: 1e6, left: wleft } });
ok(est.estimateShare(null, { text: "hi" }) === null, "no limits, no estimate");
const s = est.estimateShare(limits(100000), { text: "hi", tier: "ai", effort: "medium" });
ok(s.pct >= 1 && s.pct <= 2 && s.enough, "a short chat message is about 1% of 100,000");
ok(!est.estimateShare(limits(100), { text: "hi" }).enough, "not enough left is flagged");
ok(!est.estimateShare(limits(100000, 50), { text: "hi" }).enough, "the weekly limit counts too");
ok(est.estimateShare({ session: { limit: 100000, left: 0, resetAt: null }, week: { left: 1e6 } }, { text: "hi" }).enough, "a 5-hour limit that isn't running counts as fresh");

// the meter always shows what's left, and the three composers pass an estimate
const meter = src("src/components/chat/SessionMeter.jsx");
ok(meter.includes("limit left") && meter.includes("data-cost-estimate"), "the meter says what's left and what a message costs");
for (const f of ["src/components/ChatBox.jsx", "src/components/WebsiteDesigner.jsx", "src/pages/chat/GamesDesigner.jsx"]) ok(/<SessionMeter estimate=\{/.test(src(f)), f + " shows the cost before sending");

// featured game
const { featuredGame, BEST_GAMES, ORBIT_USES, orbitLink } = await import("../src/lib/examples.js");
const day = 86400000, names = ["b", "a", "c"];
ok(featuredGame([]) === "", "no games, no featured game");
ok(featuredGame(names, 5 * day) === featuredGame(["c", "a", "b", "a"], 5 * day + 1000), "the same game all day, whatever order the list came in");
ok(new Set([0, 1, 2].map((d) => featuredGame(names, d * day))).size === 3, "a different one each day");
ok(BEST_GAMES.length >= 6 && ORBIT_USES.length >= 6, "the gallery has games and Orbit uses");
ok(orbitLink("a b&c").endsWith("text=a%20b%26c") && orbitLink("x").startsWith("https://"), "Orbit links carry the words safely");
const show = src("src/pages/Showcase.jsx");
ok(show.includes('id="games"') && show.includes('id="sites"') && show.includes('id="orbit"'), "the gallery has all three sections");
ok(!/target="_blank"(?![^>]*rel="noopener)/.test(show), "new-tab links have rel=noopener");
ok(src("src/pages/Landing.jsx").includes("<TryGame />") && src("src/components/landing/TryGame.jsx").includes("no account"), "the homepage has a game to play with no account");
ok(src("src/App.jsx").includes("<Feedback />") && src("src/components/ClaudeSidebar.jsx").includes("Report a bug / request a feature") && src("src/components/PublicLayout.jsx").includes("FeedbackButton"), "Report a bug / request a feature is in the app and on public pages");
ok(/topic: kind/.test(src("src/components/Feedback.jsx")) && real && Object.keys((await import("../cloudflare-lib/contact.js")).TOPICS).includes("bug") && Object.keys((await import("../cloudflare-lib/contact.js")).TOPICS).includes("idea"), "feedback goes through the contact topics the server knows");
// owners can opt out of remixes
{
  const fn = src("functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/showcase.js");
  ok(fn.includes("remix: !e.noRemix") && fn.includes("body.remix === false ? { noRemix: true }"), "the gallery remembers when an owner says no to remixes");
  ok(show.includes("s.remix !== false &&"), "and the Remix button is hidden on those sites");
  ok(src("src/pages/chat/DesignerDashboard.jsx").includes("Let other people remix it?"), "owners are asked when they add a site to the gallery");
}
console.log(`cost estimate, featured game, gallery, feedback: ${n} ok`);
