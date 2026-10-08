// Offline test for the app's address helpers (src/lib/blackholeDomain.js): what the browser
// view will open, which site addresses are built, and which maker names are shown.
// Run: node scripts/test-urls.mjs
const R = new URL("../", import.meta.url).href; // a file URL, so imports work on Windows too
const { safeWebUrl, siteUrl, makerName, notForKids } = await import(R + "src/lib/blackholeDomain.js");
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "  javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "file:///etc/passwd", "blob:https://x/1", "", null, "not a url", "//evil.com"]) {
  assert(safeWebUrl(bad) === "", `browser view refuses ${JSON.stringify(bad)}`);
}
assert(safeWebUrl("https://example.com/a?b=1") === "https://example.com/a?b=1", "https addresses open");
assert(safeWebUrl(" http://example.com ") === "http://example.com/", "http addresses open, trimmed");
for (const bad of ["evil.com#", "a/b", "x?y", "-x", "x-", "a..b", "", "UPPER spaces"]) assert(siteUrl(bad) === "", `no site address for ${JSON.stringify(bad)}`);
assert(siteUrl("My-Site-2") === "https://my-site-2.nebuluxai.com", "site names are lower-cased into their address");
assert(makerName("  Maya ") === "Maya" && makerName("BLACKHOLE") === "" && makerName("x@y.z") === "", "maker names");

const j = (...p) => p.join("");
for (const bad of [j("https://www.", "porn", "hub.com/"), j("https://", "xvideos", ".com"), "https://best-casino-online.example/", j("https://thepirate", "bay.org/")]) assert(notForKids(bad), `browser leaves out ${bad.replace(/https?:\/\/(www\.)?/, "").slice(0, 12)}…`);
for (const ok of ["https://en.wikipedia.org/wiki/Essex", "https://www.sussex.ac.uk/", "https://example.com/?q=porn", "not a url"]) assert(!notForKids(ok), `browser shows ${ok}`);

// The report form's reasons match the ones the server accepts (cloudflare-lib/reports.js).
{
  const { readFileSync } = await import("node:fs");
  const { REASONS } = await import(R + "cloudflare-lib/reports.js");
  const form = readFileSync(new URL("../src/pages/Report.jsx", import.meta.url), "utf8");
  const list = form.slice(form.indexOf("const REASONS = ["), form.indexOf("];", form.indexOf("const REASONS = [")));
  const keys = [...list.matchAll(/\["([a-z]+)", "/g)].map((m) => m[1]);
  assert(keys.length > 0 && keys.join() === Object.keys(REASONS).join(), `report reasons match the server (${keys.join(", ")})`);
}

// "Remember me" unticked: the saved sign-in is removed once the browser has been closed.
{
  const { markSessionOnly, forgetIfBrowserWasClosed, FLAG } = await import(R + "src/lib/sessionOnly.js");
  const mem = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, m };
  };
  const doc = { cookie: "" };
  let s = mem();
  s.setItem("base44_access_token", "tok");
  markSessionOnly(true, s, doc);
  assert(s.getItem(FLAG) === "1" && doc.cookie.startsWith("bh_session=1") && /Secure/.test(doc.cookie), "unticking Remember me marks this browser session");
  assert(!forgetIfBrowserWasClosed(s, "other=1; bh_session=1") && s.getItem("base44_access_token") === "tok", "reloading or opening a new tab keeps you signed in");
  s.setItem("infinity-ai-conversations", "[{\"title\":\"my chat\"}]");
  const deleted = [];
  const idb = { deleteDatabase: (n) => deleted.push(n) };
  assert(forgetIfBrowserWasClosed(s, "other=1", idb) && s.getItem("base44_access_token") === null && s.getItem("token") === null && s.getItem(FLAG) === null, "after the browser was closed, you're signed out");
  assert(s.getItem("infinity-ai-conversations") === null && deleted.includes("blackhole-designer"), "and the chats and projects saved in the browser are cleared for the next person");
  s = mem();
  s.setItem("base44_access_token", "tok");
  markSessionOnly(false, s, { cookie: "" });
  s.setItem("infinity-ai-conversations", "[]");
  assert(!forgetIfBrowserWasClosed(s, "") && s.getItem("base44_access_token") === "tok" && s.getItem("infinity-ai-conversations") === "[]", "with Remember me ticked you stay signed in and keep your chats");
  assert(!forgetIfBrowserWasClosed({ getItem: () => { throw new Error("blocked"); } }, ""), "blocked storage doesn't break start-up");

  // Signing out puts your chats aside under your account; the next person starts with none.
  const { stashChats, restoreChats } = await import(R + "src/lib/chatStash.js");
  const { clearThisBrowser } = await import(R + "src/lib/sessionOnly.js");
  const chats = (s) => JSON.parse(s.getItem("infinity-ai-conversations") || "[]").map((c) => c.title).join();
  s = mem();
  s.setItem("infinity-ai-conversations", JSON.stringify([{ id: "a1", title: "A's secret" }]));
  stashChats("A", s);
  assert(chats(s) === "" && s.getItem("bh-chats-stash:A"), "signing out puts your chats aside, so the next person sees none");
  assert(!restoreChats("B", s) && chats(s) === "", "another account signing in doesn't get them");
  s.setItem("infinity-ai-conversations", JSON.stringify([{ id: "b1", title: "B's chat" }]));
  stashChats("B", s);
  assert(restoreChats("A", s) && chats(s) === "A's secret" && s.getItem("bh-chats-stash:A") === null, "signing back in brings back only your own chats");
  s.setItem("infinity-ai-conversations", JSON.stringify([{ id: "new", title: "made before signing in" }, { id: "a1", title: "A's secret" }]));
  s.setItem("bh-chats-stash:A", JSON.stringify([{ id: "a1", title: "A's secret" }, { id: "a2", title: "A's other" }]));
  restoreChats("A", s);
  assert(chats(s) === "made before signing in,A's secret,A's other", "chats already here are kept, without doubles");
  stashChats(undefined, s);
  assert(chats(s) !== "", "without a known account nothing is moved");
  clearThisBrowser(s, null);
  assert(chats(s) === "" && s.getItem("bh-chats-stash:B"), "clearing the browser removes your chats but keeps the ones other accounts put aside");
  assert(!restoreChats("A", { getItem: () => { throw new Error("blocked"); } }), "blocked storage is fine");

  // The sign-in page says why you were signed out, for a few minutes, in that tab only.
  const { noteSignedOut, signedOutNote, forgetSignedOutNote } = await import(R + "src/lib/sessionOnly.js");
  const tab = mem();
  const t0 = Date.parse("2026-09-24T12:00:00Z");
  noteSignedOut("signed-out", tab, t0);
  assert(signedOutNote(tab, t0 + 5000) === "signed-out", "right after signing out, the sign-in page knows why");
  assert(signedOutNote(tab, t0 + 11 * 60000) === null, "but not long after");
  forgetSignedOutNote(tab);
  assert(signedOutNote(tab, t0) === null, "and it's shown once");
  tab.setItem("bh-signed-out", "not json");
  assert(signedOutNote(tab, t0) === null, "a broken note is ignored");
  s = mem();
  s.setItem("base44_access_token", "tok");
  s.setItem("bh-forget-on-close", "1");
  const tab2 = mem();
  forgetIfBrowserWasClosed(s, "", null, tab2);
  assert(signedOutNote(tab2) === "closed", "being signed out because the browser was closed is explained too");
}

// The contact form's topics match the ones the server accepts (cloudflare-lib/contact.js).
{
  const { readFileSync } = await import("node:fs");
  const { TOPICS } = await import(R + "cloudflare-lib/contact.js");
  const form = readFileSync(new URL("../src/pages/Contact.jsx", import.meta.url), "utf8");
  const list = form.slice(form.indexOf("const TOPICS = ["), form.indexOf("];", form.indexOf("const TOPICS = [")));
  const keys = [...list.matchAll(/\["([a-z]+)", "/g)].map((m) => m[1]);
  assert(keys.length > 0 && keys.slice().sort().join() === Object.keys(TOPICS).sort().join(), `contact topics match the server (${keys.join(", ")})`);
  const monitor = readFileSync(new URL("../src/components/monitor/Messages.jsx", import.meta.url), "utf8");
  assert(keys.every((k) => new RegExp(`\\b${k}: "`).test(monitor)), "and Monitor has a label for each");
}

// "Report this reply" in the chat: the report fits in one contact message and names the reason.
{
  const { replyReportMessage, REPLY_REASONS } = await import(R + "src/lib/replyReport.js");
  const { TOPICS, addMessage, listMessages } = await import(R + "cloudflare-lib/contact.js");
  assert(TOPICS.ai, "the server accepts the AI reply topic");
  const long = "x".repeat(5000);
  const msg = replyReportMessage("harmful", "It told me to do something dangerous", long, long + "END");
  assert(msg.startsWith("Reported AI reply: Harmful or unsafe") && msg.includes("Note: It told me") && msg.length <= 2000, `a long question and reply are cut to fit (${msg.length} characters)`);
  assert(!msg.includes("END") && msg.includes("Question: xxx") && msg.includes("Reply: xxx"), "keeping the start of each");
  assert(/^Reported AI reply: Something else\n\nQuestion: \(none\)\n\nReply: Hi$/.test(replyReportMessage("made-up", "", undefined, "Hi")), "an unknown reason, no question and no note still make a clear report");
  assert(REPLY_REASONS.map(([k]) => k).join() === "harmful,wrong,other", "reasons: harmful, wrong, other");
  const m = new Map();
  const kv = { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), put: async (k, v) => m.set(k, v) };
  await addMessage(kv, { topic: "ai", message: msg, email: "k@e.com", userId: "u1", who: "u1" });
  const saved = (await listMessages(kv))[0];
  assert(saved.topic === "ai" && saved.message === msg, "the whole report is kept for Monitor");
}

// Monitor → Promo codes: big giveaways are confirmed before they go live.
{
  const { promoWarning } = await import(R + "src/lib/promoRisk.js");
  assert(promoWarning({ kind: "discount", code: "SAVE10", pct: 10, maxUses: 0 }) === "", "a small discount goes straight through");
  assert(/FREEALL makes it free for anyone who has the code, with no use limit/.test(promoWarning({ kind: "discount", code: "FREEALL", pct: 100, maxUses: 0 })), "100% off with no limit is confirmed");
  assert(/up to 5 people/.test(promoWarning({ kind: "discount", code: "VIP", pct: 100, maxUses: 5 })), "100% off for a few people is confirmed, saying how many");
  assert(/60% off to anyone/.test(promoWarning({ kind: "discount", code: "HALF", pct: 60, maxUses: 0 })) && promoWarning({ kind: "discount", code: "HALF", pct: 60, maxUses: 20 }) === "", "half off or more is confirmed only without a use limit");
  assert(promoWarning({ kind: "credits", code: "GIFT", credits: 50 }) === "" && /500 credits/.test(promoWarning({ kind: "credits", code: "BIG", credits: 500 })), "200+ free credits are confirmed");
  assert(/^This code/.test(promoWarning({ kind: "credits", credits: 999 })), "works before a code is typed");
}

// A dropped connection is explained in plain words, not "Failed to fetch".
{
  const { isNetworkError } = await import(R + "src/lib/netError.js");
  assert(isNetworkError(new TypeError("Failed to fetch"), true) && isNetworkError({ message: "Network Error" }, true) && isNetworkError(new TypeError("Load failed"), true), "fetch and axios network failures are recognised (Chrome, axios, Safari)");
  assert(isNetworkError(new Error("anything"), false), "anything while the browser is offline counts");
  assert(!isNetworkError({ response: { status: 402, data: { error: "Out of credits" } }, message: "Request failed" }, false), "an answer from the server is never called a connection problem");
  assert(!isNetworkError(new Error("Unexpected token"), true) && !isNetworkError(Object.assign(new Error("aborted"), { name: "AbortError" }), true), "other errors (and pressing Stop) aren't");
}

// Publishing a website: a card number or written-out password on the page is pointed out; a
// business's phone number, and numbers inside scripts, aren't.
{
  const { privateInfoOnPage } = await import(R + "src/lib/privateInfo.js");
  // A tiny stand-in for the browser's DOMParser: body text without <script>/<style>.
  const parse = (html) => {
    const body = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ");
    return { querySelectorAll: () => [], body: { textContent: body } };
  };
  assert(privateInfoOnPage("<h1>Pay me</h1><p>Card: 4111 1111 1111 1111</p>", parse) === "a card number", "a card number on the page is pointed out");
  assert(privateInfoOnPage("<p>My password is Sunshine2012!</p>", parse) === "a password", "so is a written-out password");
  assert(privateInfoOnPage("<p>Call us: (555) 123-4567</p>", parse) === "", "a business phone number isn't");
  assert(privateInfoOnPage("<script>const seed = 4111111111111111;</script><h1>Game</h1>", parse) === "", "numbers inside scripts aren't");
  assert(privateInfoOnPage("<h1>x</h1>", () => { throw new Error("no DOM"); }) === "", "a page that can't be read is never blocked");
}

// Screen readers hear a finished reply in plain words.
{
  const { spokenReply } = await import(R + "src/hooks/useReplyAnnouncer.js");
  assert(spokenReply("## Hi\n**Bold** and [a link](https://x.y) here") === "Hi Bold and a link here", "markdown is read as plain words");
  assert(spokenReply("Try this:\n```js\nconsole.log(1)\n```\nDone.") === "Try this: (code) Done.", "code blocks are called (code)");
  assert(spokenReply("word ".repeat(200)).length <= 301, "long replies are cut short");
}

// Signed-in pages get their own tab titles.
{
  const { appTitleFor } = await import(R + "src/hooks/usePageTitle.js");
  const want = { "/chat": "Chat", "/chat/": "Chat", "/chat/code": "Nebulux Code", "/chat/designer/build": "Website Designer", "/chat/game-designer": "Game Designer", "/chat/games": "Games", "/chat/game/zap": "Game", "/chat/shop": "Plans", "/chat/monitor": "Monitor", "/somewhere": "" };
  assert(Object.entries(want).every(([p, t]) => appTitleFor(p) === t), "each signed-in page has its own title");
}
