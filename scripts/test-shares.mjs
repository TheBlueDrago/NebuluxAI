// Shared chats (cloudflare-lib/shares.js): Code chats only open for Pro and up, and the sharer
// gets 30 Nebula credits when a friend upgrades within 5 minutes of first opening the link.
// Run: node scripts/test-shares.mjs
import { DatabaseSync } from "node:sqlite";
import { createShare, viewShare, cleanMessages, REWARD_WINDOW_MS } from "../cloudflare-lib/shares.js";

const assert = (c, m) => {
  if (!c) {
    console.error("FAIL", m);
    process.exitCode = 1;
  } else console.log("ok", m);
};
const sq = new DatabaseSync(":memory:");
const db = {
  prepare(sqlText) {
    const st = sq.prepare(sqlText);
    let args = [];
    const api = { bind: (...a) => ((args = a), api), all: async () => ({ results: st.all(...args) }), first: async () => st.get(...args) || null, run: async () => st.run(...args) };
    return api;
  },
};
const paid = [];
const give = async (owner, amounts, once) => paid.push({ owner, amounts, once });
const owner = { id: "sharer", full_name: "Sam Smith" };
const msgs = [{ role: "user", content: "make a game" }, { role: "assistant", content: "here it is" }, { role: "system", content: "" }];

assert(cleanMessages(msgs).length === 2, "empty messages are dropped");
assert((await createShare(db, owner, { kind: "code", messages: [] })).error, "an empty chat can't be shared");
const { id: code } = await createShare(db, owner, { kind: "code", title: "Game", messages: msgs });
const { id: chat } = await createShare(db, owner, { kind: "chat", title: "Hi", messages: msgs });

let r = await viewShare(db, { id: "f1" }, "free", chat, give);
assert(r.share && r.share.messages.length === 2, "a normal chat opens for anyone signed in");
r = await viewShare(db, { id: "f1" }, "free", code, give, 1000);
assert(r.locked && !r.share && !r.messages && r.reward_ends_at === 1000 + REWARD_WINDOW_MS, "a Code chat is locked for Free: no messages sent, the timer starts");
r = await viewShare(db, { id: "f1" }, "free", code, give, 1000 + 60000);
assert(r.locked && r.reward_ends_at === 1000 + REWARD_WINDOW_MS, "opening again doesn't restart the timer");
r = await viewShare(db, { id: "f1" }, "pro", code, give, 1000 + 4 * 60000);
assert(r.share && r.rewarded && paid.length === 1 && paid[0].owner === "sharer" && paid[0].amounts.space5 === 30, "upgrading within 5 minutes opens it and pays the sharer 30 Nebula credits");
r = await viewShare(db, { id: "f1" }, "pro", code, give, 1000 + 4.5 * 60000);
assert(r.share && !r.rewarded && paid.length === 1, "only once per friend");

await viewShare(db, { id: "f2" }, "free", code, give, 0);
r = await viewShare(db, { id: "f2" }, "pro", code, give, REWARD_WINDOW_MS + 1);
assert(r.share && !r.rewarded && paid.length === 1, "upgrading after 5 minutes opens the chat but pays nothing");

r = await viewShare(db, { id: "f3" }, "pro", code, give, 0);
assert(r.share && !r.rewarded && paid.length === 1, "someone already on Pro opens it, no reward");
r = await viewShare(db, { id: "sharer" }, "free", code, give, 0);
assert(r.share && r.own, "the sharer can always open their own chat");
assert((await viewShare(db, { id: "f1" }, "pro", "nope", give)).missing, "a wrong link says it doesn't exist");
