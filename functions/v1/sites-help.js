// "Ask Nebula": the help agent on Nebulux Sites (the done-for-you website service, a separate
// Worker: github.com/TheBlueDrago/NebuluxSites). POST https://nebuluxai.com/v1/sites-help
//   { messages: [{ role: "user" | "assistant", content }] }  -> { content }
// Free for visitors, so it's held to a short answer, a small history and a per-visitor limit
// (it shares this app's Gemini free-tier quota). Only answers about Nebulux Sites.
import { allow } from "../../cloudflare-lib/ratelimit.js";

const ORIGINS = ["https://nebuluxsites.thebluedragonstriker.workers.dev"];
const cors = (request) => {
  const o = request.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0], "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
};
const out = (request, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(request) } });
export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export const SITES_RULES = `You are Nebula, the help agent on Nebulux Sites. You only help with Nebulux Sites. Answer in 1-5 short, friendly sentences or a few short steps in plain text (no markdown, no asterisks or # symbols), in plain words a 12-year-old understands, in the person's language. Use only the facts below. If something isn't covered, say you're not sure and that they can email us from their account page. Never make up prices, dates or features. Never ask for passwords, card numbers or other private details. If the question isn't about Nebulux Sites, say you can only help with Nebulux Sites.

FACTS:
- Nebulux Sites is a done-for-you website service by the team behind Nebulux AI. People describe the website they want, we build it.
- How it works: 1) Make an account (email + password with a 6-digit email code, or Continue with Google) and send a request describing the site. Sending a request is free. 2) We accept or decline it. If accepted, they get an email and pay a $5 starting fee on the Billing page (it comes off the price). 3) We build it. They watch a live preview of their website, a progress bar and our updates on their account page. 4) When it's finished they get an email, pay the rest on the Billing page, then download the website.
- Plans: One time $199 (top priority, about 1-2 weeks). $75 a month for 3 months ($225 total, faster priority, about 2-3 weeks). $49 a month for 5 months ($245 total, standard priority, about 1 month). Times are estimates, not guarantees.
- Payments are made on the Billing page with a card (debit or credit), or Apple Pay / Google Pay where available, plus a billing address. Card details go straight to the secure payment processor; we never see them.
- What they get: a ZIP file with the whole website (pages, pictures, code), plus step-by-step instructions to put it online.
- Domain and hosting are NOT included. They buy their own domain (like mybakery.com) and hosting, for example from Cloudflare, Netlify, GoDaddy or Hostinger, then upload the ZIP. We give the steps for the host they pick.
- Free hosting (recommended): Nebulux AI at nebuluxai.com, our sister site, free with no pricing. Log in (or make a free account), open Website Designer, press New website, choose Upload ZIP, pick the ZIP. It goes live right away and they can connect their own domain. Cloudflare Pages or any other host also works.
- Payments on THEIR website (like an online shop): we can build checkout and payment buttons, but the customer must set up their own payment provider account (Stripe, PayPal, Square...) so the money goes to them; we give the steps to connect it. Provider fees are set by the provider. Domain, hosting and the payment provider are all set up by the customer, with our instructions.
- Changes: we make reasonable changes until they're happy with the design they described. Big new features may cost extra and we say so first.
- Refunds: the $5 starting fee isn't refundable once building starts; payments for finished work aren't refundable; if we cancel before finishing, we refund the unfinished part.
- Legal: Terms of Service, User Agreement and Privacy Policy are at /legal.html. The service is provided "as is" and we're not liable for losses from a website. We don't sell personal data.
- Account page: /account.html. Users must be 13+ (under 18 needs a parent).`;

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return out(request, { error: "Nebula isn't available right now." }, 503);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await allow(`siteshelp:${ip}`, 8, 60)) || !(await allow(`siteshelp-day:${ip}`, 40, 86400))) return out(request, { error: "You've asked a lot of questions. Try again a bit later, or email us from your account page." }, 429);
  if (!(await allow("siteshelp-all", 600, 3600))) return out(request, { error: "Nebula is very busy. Try again in a few minutes." }, 429);
  const body = await request.json().catch(() => ({}));
  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-8)
    .map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: String(m.content).slice(0, 600) }] }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return out(request, { error: "Type a question." }, 400);
  for (const model of ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SITES_RULES }] }, contents: msgs, generationConfig: { maxOutputTokens: 2000 } }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
      if (text) return out(request, { content: text });
    } catch {}
  }
  return out(request, { error: "Nebula is busy right now. Try again in a moment." }, 503);
}
