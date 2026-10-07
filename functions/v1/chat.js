// The public Nebulux API: POST https://nebuluxai.com/v1/chat with "Authorization: Bearer nx-sk-..."
//   { model?: "nebulux-ai" | "ultra" | "galaxy" | "space", messages: [{ role: "system"|"user"|"assistant", content }],
//     effort?: "low" | "medium" | "high" }   (or just { prompt })
//   -> { id, object: "chat.completion", model, content, credits_left }
// It runs as the key's owner through the normal AI path (functions/.../chatCompletion.js), so it
// uses their credits and plan limits, with the same safety rules.
import { keyOwner, noteUse, oneCallSession } from "../../cloudflare-lib/apikeys.js";
import { allow } from "../../cloudflare-lib/ratelimit.js";
import { onRequestPost as chatCompletion } from "../api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion.js";

const MODELS = { "nebulux-ai": "automatic", ultra: "claude_sonnet_4_6", galaxy: "claude_opus_4_8", space: "claude-sonnet-5" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });
const fail = (message, status, type = "invalid_request") => out({ error: { type, message } }, status);

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost(context) {
  const { request, env } = context;
  const owner = await keyOwner(env.DB, request);
  if (!owner) return fail("Missing or wrong API key. Send it as: Authorization: Bearer nx-sk-...", 401, "authentication");
  if (!(await allow(`apikey:${owner.id}`, 20, 60))) return fail("Too many requests: up to 20 a minute per key.", 429, "rate_limit");
  const body = await request.json().catch(() => null);
  if (!body) return fail("Send a JSON body.", 400);
  const modelName = String(body.model || "nebulux-ai").toLowerCase();
  if (!MODELS[modelName]) return fail(`Unknown model "${modelName}". Use one of: ${Object.keys(MODELS).join(", ")}.`, 400);

  // messages -> one prompt (system notes first, then the conversation, then the last question)
  let prompt = "", question = "";
  if (Array.isArray(body.messages) && body.messages.length) {
    const msgs = body.messages.filter((m) => m && typeof m.content === "string").slice(-40);
    const sys = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const convo = msgs.filter((m) => m.role !== "system");
    const last = convo.length && convo[convo.length - 1].role === "user" ? convo.pop() : null;
    if (!last) return fail("The last message must be from the user.", 400);
    question = last.content;
    prompt =
      (sys ? `Instructions from the developer: ${sys}\n\n` : "") +
      (convo.length ? "Conversation so far:\n" + convo.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n") + "\n\n" : "") +
      question;
  } else if (typeof body.prompt === "string" && body.prompt.trim()) {
    prompt = question = body.prompt;
  } else return fail("Send messages: [{ role: \"user\", content: \"...\" }] (or a prompt).", 400);
  if (prompt.length > 200000) return fail("That request is too long (200,000 characters at most).", 413);

  const session = await oneCallSession(env.DB, owner.user_id);
  try {
    const inner = new Request(new URL("/api/apps/6a8b5eb7787b8a4d6a18f662/functions/chatCompletion", request.url), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.token}`, "cf-connecting-ip": request.headers.get("cf-connecting-ip") || "" },
      body: JSON.stringify({ prompt, question: question.slice(0, 2000), model: MODELS[modelName], effort: ["low", "medium", "high"].includes(body.effort) ? body.effort : "medium" }),
    });
    const res = await chatCompletion({ ...context, request: inner });
    const data = await res.json().catch(() => ({}));
    context.waitUntil(noteUse(env.DB, owner.id).catch(() => {}));
    if (!res.ok || data.error) {
      const status = res.status === 200 ? 400 : res.status;
      return fail(data.error || "The AI couldn't answer.", status, data.busy ? "overloaded" : data.outOfCredits ? "out_of_credits" : "api_error");
    }
    const left = data.credits && data.credits.tiers ? data.credits.tiers[{ "nebulux-ai": "ai", ultra: "aiCode", galaxy: "galaxy5", space: "space5" }[modelName]] : null;
    return out({ id: "nx-" + crypto.randomUUID(), object: "chat.completion", model: modelName, content: data.content || "", ...(data.cut ? { cut_off: true } : {}), credits_left: left ? left.remaining : null });
  } finally {
    context.waitUntil(session.done());
  }
}
