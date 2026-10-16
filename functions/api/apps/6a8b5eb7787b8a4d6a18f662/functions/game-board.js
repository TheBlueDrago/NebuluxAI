// Leaderboards for published games: the 10 best scores on each board, with the players' Nebulux
// usernames. A game asks through window.nebulux.score / window.nebulux.top (lib/previewShim.js,
// components/PreviewFrame.jsx passes the messages on to here).
// { action: "top", name, board }            -> { top: [{ name, score }] }   (anyone)
// { action: "score", name, board, score }   -> { top }                      (signed in)
// { action: "mine" }                        -> { boards: [{ game, board, place, name, score }] }
// Boards whose name ends in "time" rank the lowest score first (fastest finish).
// KV (PUBLISHED_HTML): board:<game>:<board>. Only written when the board changes, to keep
// within the free KV write limit.
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { allow, TOO_MANY } from "../../../../../cloudflare-lib/ratelimit.js";

const SIZE = 10;
// Only these games' boards exist, so nobody can make up names to fill KV.
export const BOARDS = {
  "sky-obby": ["stage", "time"],
  "fruit-seas": ["level"],
  "bed-brawl": ["wins"],
  "brawl-blitz": ["wins"],
  "storm-royale": ["wins"],
};
const MAX_SCORE = 1e9;

export function addScore(list, entry, low) {
  const had = list.find((x) => x.uid === entry.uid);
  if (had && (low ? had.score <= entry.score : had.score >= entry.score)) {
    if (had.name === entry.name) return null; // not a new best: nothing to save
    had.name = entry.name;
    return list;
  }
  const out = list.filter((x) => x.uid !== entry.uid);
  out.push(entry);
  out.sort((a, b) => (low ? a.score - b.score : b.score - a.score));
  const top = out.slice(0, SIZE);
  return top.some((x) => x.uid === entry.uid) || had ? top : null;
}

// Account deletion (delete-account.js): take the player off every board.
export async function removeFromBoards(kv, uid) {
  for (const [game, boards] of Object.entries(BOARDS)) {
    for (const board of boards) {
      const key = `board:${game}:${board}`;
      const list = (await kv.get(key, "json")) || [];
      if (list.some((x) => x.uid === uid)) await kv.put(key, JSON.stringify(list.filter((x) => x.uid !== uid)));
    }
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const kv = env.PUBLISHED_HTML;
    const body = await request.json().catch(() => ({}));
    // Every board the signed-in player is on ("Download my data", src/lib/myData.js).
    if (body.action === "mine") {
      const user = await currentUser(request);
      if (!user) return json({ error: "Please sign in." }, 401);
      const mine = [];
      for (const [game, boards] of Object.entries(BOARDS)) {
        for (const board of boards) {
          const list = (await kv.get(`board:${game}:${board}`, "json")) || [];
          const i = list.findIndex((x) => x.uid === user.id);
          if (i >= 0) mine.push({ game, board, place: i + 1, name: list[i].name, score: list[i].score });
        }
      }
      return json({ boards: mine });
    }
    const game = String(body.name || "").toLowerCase();
    const board = String(body.board || "score").toLowerCase();
    if (!(BOARDS[game] || []).includes(board)) return json({ error: "Which leaderboard?", top: [] }, 404);
    const key = `board:${game}:${board}`;
    const low = board.endsWith("time");
    const list = (await kv.get(key, "json")) || [];
    const show = (l) => l.map((x) => ({ name: x.name, score: x.score }));

    if (body.action === "score") {
      const user = await currentUser(request);
      if (!user) return json({ error: "Sign in to get on the leaderboard.", top: show(list) }, 401);
      if (!(await allow(`board:${user.id}`, 10, 60))) return json({ error: TOO_MANY, top: show(list) }, 429);
      const score = Math.round(Number(body.score) * 100) / 100;
      if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) return json({ error: "That score doesn't look right.", top: show(list) }, 400);
      const name = String(user.full_name || "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 24) || "Player";
      const next = addScore(list, { uid: user.id, name, score }, low);
      // At most 40 board changes a day per player (KV writes are shared by the whole site).
      if (next && (await allow(`board-day:${user.id}`, 40, 86400))) await kv.put(key, JSON.stringify(next));
      return json({ top: show(next || list) });
    }
    return json({ top: show(list) });
  } catch (err) {
    return json({ error: (err && err.message) || "Something went wrong." }, 500);
  }
}
