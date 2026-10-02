// Writes the AI's reply to an email sent to support@nebuluxai.com. Called only by the support
// email Worker (workers/nebulux-support-mail), which proves it with the SUPPORT_KEY secret.
// The Worker sends the reply and forwards the email to the owner too, so a person sees everything.
const MAX_IN = 6000;
const PER_SENDER_PER_DAY = 5;

export const SUPPORT_RULES =
  "You are the support assistant for Nebulux AI (nebuluxai.com), writing a reply to an email sent to support@nebuluxai.com. " +
  "About Nebulux AI: an AI assistant for answers, homework, writing and code that also builds websites and games from a description. " +
  "Plans: right now everyone is on the Free plan ($0: every month 100 Nebulux AI, 75 Code, 50 Galaxy and 25 Space credits, 3 websites and unlimited games). Paid plans (Pro $15 a month, Team $20 a month, Enterprise $20-$30 a seat) and credit packs are coming soon in a later update and can't be bought yet. " +
  "There is no free trial. " +
  "Sign-in help: to reset a password, use 'Forgot password' at nebuluxai.com/login. Sign-up codes come by email: check spam, or ask for a new code on the sign-up page. " +
  "Nebulux AI has a new sign-in system, so an old password no longer works: the person just logs in once (or uses Forgot password) and gets an email with a link to choose a new password; their account, credits, websites and games are all still there. " +
  "Signing in with Google also works; if they never had a password, Google sends them the same choose-a-password email first. " +
  "Safety: people can report a page with the Report link on it, or at nebuluxai.com/report. Guides: nebuluxai.com/guides. " +
  "Rules: be warm, clear and short (under 150 words), in the language the email is written in. Answer what you can from the facts above; never make up facts, prices or features. " +
  "Never ask for passwords, card numbers or other private details, and tell them not to send those. Never promise refunds, account changes, bans, unbans or deleting data: " +
  "say a person from the team will look at it and reply. If the email is angry, a complaint, legal, about money charged, or you aren't sure, say the team will get back to them soon. " +
  "If someone may be in danger or talks about hurting themselves, answer with care and tell them to contact local emergency services (in the US, call or text 988). " +
  "Don't use Markdown. Start with 'Hi,' and end with: 'Nebulux AI Support'.";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// Counts replies per sender per day in Cloudflare's free cache (no KV writes).
async function allowSender(from) {
  try {
    const key = new Request(`https://nebuluxai.com/__internal/support/${encodeURIComponent(from)}/${new Date().toISOString().slice(0, 10)}`);
    const hit = await caches.default.match(key);
    const n = hit ? Number(await hit.text()) || 0 : 0;
    if (n >= PER_SENDER_PER_DAY) return false;
    await caches.default.put(key, new Response(String(n + 1), { headers: { "cache-control": "max-age=86400" } }));
  } catch {
    // No cache: allow.
  }
  return true;
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get("x-support-key") || "";
  if (!env.SUPPORT_KEY || key.length < 20 || key !== env.SUPPORT_KEY) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  const from = String(body.from || "").toLowerCase().slice(0, 200);
  const subject = String(body.subject || "").slice(0, 300);
  const text = String(body.text || "").slice(0, MAX_IN);
  if (!from || !text.trim()) return json({ reply: "" });
  if (!(await allowSender(from))) return json({ reply: "", limited: true });

  const prompt = `Email from: ${from}\nSubject: ${subject}\n\n${text}\n\nWrite the reply.`;
  for (const model of ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUPPORT_RULES }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700 },
        }),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const reply = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      if (reply) return json({ reply });
    } catch {
      // Try the next model.
    }
  }
  return json({ reply: "" });
}
