// AI for visitors of a published website: POST https://nebuluxai.com/v1/site-chat
//   { site, messages: [{ role, content }] }  -> { content }
// Only when the site's owner turned on "AI for visitors" (Website Designer → Dashboard → AI,
// functions/.../site-ai.js); every reply is paid from the owner's prepaid API balance
// (cloudflare-lib/apirun.js). No key is ever in the page. Called by window.NebuluxAI on the site.
import { allow } from "../../cloudflare-lib/ratelimit.js";
import { toPrompt, billedAI } from "../../cloudflare-lib/apirun.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...CORS } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const site = String(body.site || "").toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/.test(site)) return out({ error: "Unknown website." }, 400);
  const cfg = await env.PUBLISHED_HTML.get(`siteai:${site}`, "json").catch(() => null);
  if (!cfg || !cfg.on || !cfg.owner) return out({ error: "This website's AI isn't turned on." }, 403);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await allow(`siteai:${site}:${ip}`, 8, 60))) return out({ error: "You're sending messages very fast. Wait a moment." }, 429);
  if (!(await allow(`siteai:${site}`, 300, 3600))) return out({ error: "This website's AI is very busy. Try again later." }, 429);
  const msgs = (Array.isArray(body.messages) ? body.messages : [{ role: "user", content: String(body.message || "") }])
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 4000) }));
  // The owner's own instructions for their assistant, then the visitor's conversation.
  const system = `You are the AI assistant on the website ${site}.nebuluxai.com.${cfg.instructions ? " The website's owner says: " + String(cfg.instructions).slice(0, 2000) : ""} Keep answers short and friendly. Never ask for passwords, card numbers or other private details.`;
  const p = toPrompt([{ role: "system", content: system }, ...msgs]);
  if (p.error) return out({ error: p.error }, 400);
  const r = await billedAI(context, { userId: cfg.owner, model: cfg.model || "nebulux-ai", prompt: p.prompt, question: p.question, effort: "low", note: `Site AI · ${site}` });
  // Visitors never see the owner's billing details.
  if (r.error) return out({ error: r.type === "overloaded" ? "The AI is busy right now. Try again in a moment." : "This website's AI isn't available right now." }, r.status === 429 ? 429 : 503);
  return out({ content: r.content });
}
