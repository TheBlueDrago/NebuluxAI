// What a message is likely to use, shown before it's sent (components/chat/SessionMeter.jsx).
// The server charges with cloudflare-lib/creditSession.js tokensUsed(); these numbers are the same
// ones (scripts/test-cost-estimate.mjs fails if they drift). It is an estimate: the real amount
// depends on how long the answer turns out.
export const AI_MULT = { ai: 1, aiCode: 1.5, galaxy5: 2, space5: 3 };
export const THINK_WEIGHT = 0.25;
export const THINK_EST = { low: 0.5, medium: 2, high: 4, extra: 6, ultracode: 8 };
export const IMAGE_TOKENS = 258;
// About how long an answer is, in tokens: a chat answer, code, or a whole website or game.
export const REPLY_TOKENS = { chat: 450, code: 1800, build: 7000 };

// -> tokens this message will probably use
export function estimateTokens({ text = "", tier = "ai", effort = "medium", kind = "chat", images = 0 } = {}) {
  const asked = Math.ceil(String(text).length / 4) + IMAGE_TOKENS * (Number(images) || 0);
  const answer = REPLY_TOKENS[kind] || REPLY_TOKENS.chat;
  const thinking = answer * (THINK_EST[effort] ?? 2);
  return Math.max(1, Math.ceil((asked + answer + thinking * THINK_WEIGHT) * (AI_MULT[tier] || 1)));
}

// -> { tokens, pct (of the 5-hour limit, at least 1), enough (false when what's left won't cover it) } or null without limits
export function estimateShare(limits, opts) {
  const limit = limits && limits.session && limits.session.limit;
  if (!limit) return null;
  const tokens = estimateTokens(opts);
  const running = limits.session.resetAt && limits.session.resetAt > Date.now();
  const left = Math.min(running ? limits.session.left : limit, limits.week && limits.week.left != null ? limits.week.left : Infinity);
  return { tokens, pct: Math.max(1, Math.round((tokens / limit) * 100)), enough: left >= tokens };
}

export const estimateText = (e) => (!e ? "" : `This ${e.kind || "message"}: about ${e.pct}% of your limit`);
