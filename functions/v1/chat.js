// The public Nebulux API: POST https://nebuluxai.com/v1/chat with "Authorization: Bearer nx-sk-..."
//   { model?: "nebulux-ai" | "galaxy" | "space" | "nebula", messages: [{ role: "system"|"user"|"assistant", content }],
//     effort?: "low" | "medium" | "high" }   (or just { prompt })
//   -> { id, object: "chat.completion", model, content, cost_usd, balance_usd }
// Paid from the key owner's prepaid API balance (the Playground too), only while their
// "Use API key credits" switch is on (Settings → Usage). See cloudflare-lib/apirun.js.
import { keyOwner, noteUse } from "../../cloudflare-lib/apikeys.js";
import { allow, hits, bump } from "../../cloudflare-lib/ratelimit.js";
import { dollars } from "../../cloudflare-lib/apibilling.js";
import { MODELS, toPrompt, billedAI } from "../../cloudflare-lib/apirun.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });
const fail = (message, status, type = "invalid_request") => out({ error: { type, message } }, status);

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost(context) {
  const { request, env } = context;
  // Someone trying key after key from one network is stopped for a while (30 wrong keys in 10 minutes).
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if ((await hits(`apikey-bad:${ip}`, 600)) >= 30) return fail("Too many wrong API keys from this network. Wait 10 minutes.", 429, "rate_limit");
  const owner = await keyOwner(env.DB, request);
  if (!owner) {
    await bump(`apikey-bad:${ip}`, 600);
    return fail("Missing or wrong API key. Send it as: Authorization: Bearer nx-sk-...", 401, "authentication");
  }
  if (!(await allow(`apikey:${owner.id}`, 20, 60))) return fail("Too many requests: up to 20 a minute per key.", 429, "rate_limit");
  const body = await request.json().catch(() => null);
  if (!body) return fail("Send a JSON body.", 400);
  const model = String(body.model || "nebulux-ai").toLowerCase();
  if (!MODELS[model]) return fail(`Unknown model "${model}". Use one of: ${Object.keys(MODELS).join(", ")}.`, 400);
  const p = toPrompt(body.messages, body.prompt);
  if (p.error) return fail(p.error, 400);
  if (p.prompt.length > 200000) return fail("That request is too long (200,000 characters at most).", 413);
  const effort = ["low", "medium", "high"].includes(body.effort) ? body.effort : "medium";

  const r = await billedAI(context, { userId: owner.user_id, model, prompt: p.prompt, question: p.question, effort, note: `API key ${owner.id} · ${model}` });
  context.waitUntil(noteUse(env.DB, owner.id).catch(() => {}));
  if (r.error) return fail(r.error, r.status, r.type);
  return out({ id: "nx-" + crypto.randomUUID(), object: "chat.completion", model, content: r.content, ...(r.cut ? { cut_off: true } : {}), cost_usd: Number(dollars(r.cost)), balance_usd: Number(dollars(r.balance)) });
}
