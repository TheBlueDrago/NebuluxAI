// One AI request paid from an account's prepaid API balance (cloudflare-lib/apibilling.js).
// Used by the Nebulux API (functions/v1/chat.js, an API key's owner) and by AI on published websites
// (functions/v1/site-chat.js, the site's owner). The request runs through the normal AI path
// (chatCompletion: the same models and safety rules) as the paying account, with plan credits
// untouched, and the reply can never cost more than the balance holds.
import { oneCallSession } from "./apikeys.js";
import { account, charge, costOf, maxReplyChars } from "./apibilling.js";
import { onRequestPost as chatCompletion } from "../functions/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js";

export const MODELS = { "nebulux-ai": "automatic", galaxy: "claude_sonnet_4_6", space: "claude_opus_4_8", nebula: "claude-sonnet-5" };
export const SETTINGS_HINT = "Turn on API key credits: Nebulux AI → Settings → Usage → Use API key credits.";

// messages [{ role, content }] -> { prompt, question } or { error }
export function toPrompt(messages, fallback) {
  if (Array.isArray(messages) && messages.length) {
    const msgs = messages.filter((m) => m && typeof m.content === "string").slice(-40);
    const sys = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const convo = msgs.filter((m) => m.role !== "system");
    const last = convo.length && convo[convo.length - 1].role === "user" ? convo.pop() : null;
    if (!last) return { error: "The last message must be from the user." };
    return {
      question: last.content,
      prompt:
        (sys ? `Instructions from the developer: ${sys}\n\n` : "") +
        (convo.length ? "Conversation so far:\n" + convo.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n") + "\n\n" : "") +
        last.content,
    };
  }
  if (typeof fallback === "string" && fallback.trim()) return { prompt: fallback, question: fallback };
  return { error: 'Send messages: [{ role: "user", content: "..." }].' };
}

// -> { status, content?, cost?, balance?, error?, type? }
export async function billedAI(context, { userId, model, prompt, question, effort = "medium", note }) {
  const { request, env } = context;
  const acct = await account(env.DB, userId);
  if (!acct.agreedAt || !acct.useApi) return { status: 403, type: "billing_off", error: SETTINGS_HINT };
  const bal = acct.balances[model] || 0;
  if (bal <= 0) return { status: 402, type: "out_of_credit", error: `Your ${model} balance is empty. Add funds for it on the Nebulux Platform (nebuluxai.com/api) → Billing.` };
  const maxChars = maxReplyChars(model, effort, prompt.length, bal);
  if (maxChars <= 0) return { status: 402, type: "out_of_credit", error: `Your ${model} balance is too low for this request. Add funds for it on the Nebulux Platform (nebuluxai.com/api) → Billing.` };
  if (!env.SITE_AUTH_KEY) return { status: 503, type: "api_error", error: "The API isn't set up yet." };

  const session = await oneCallSession(env.DB, userId);
  try {
    const inner = new Request(new URL("/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion", request.url), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "x-nx-api-billing": env.SITE_AUTH_KEY, "cf-connecting-ip": request.headers.get("cf-connecting-ip") || "" },
      body: JSON.stringify({ prompt, question: String(question || "").slice(0, 2000), model: MODELS[model], effort, apiMaxChars: maxChars }),
    });
    const res = await chatCompletion({ ...context, request: inner });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return { status: res.status === 200 ? 400 : res.status, type: data.busy ? "overloaded" : "api_error", error: data.error || "The AI couldn't answer." };
    const content = data.content || "";
    const cost = costOf(model, effort, prompt.length, content.length);
    await charge(env.DB, userId, model, cost, note || `${model} request`);
    return { status: 200, content, cost, cut: !!data.cut, balance: Math.max(0, bal - cost) };
  } finally {
    context.waitUntil(session.done());
  }
}
