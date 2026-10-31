// Kept apart (no imports) so scripts/test-whatsapp.mjs can check it in Node.
// "Send this to my WhatsApp" in a chat: { last } sends the last answer, { body } sends what follows
// "WhatsApp:", { after } sends the answer to the rest of the message once it's written. Only the person's
// own WhatsApp: "text my mom on WhatsApp" isn't this.
const WA_ASK = /\b(send|forward|share|text|message)\b[^.?!\n]{0,40}?\b(?:to\s+(?:my\s+)?whats\s?app|on\s+my\s+whats\s?app|to\s+me\s+on\s+whats\s?app)\b/i;
export function waIntent(text) {
  const t = String(text || "").trim();
  if (!WA_ASK.test(t)) return null;
  const colon = /whats\s?app\s*:\s*([\s\S]+)$/i.exec(t);
  if (colon && colon[1].trim()) return { body: colon[1].trim() };
  const rest = t
    .replace(WA_ASK, "")
    .replace(/\b(please|pls|now|thanks|thank you|can you|could you|would you|ok|okay|it|this|that|the (?:answer|reply|last (?:one|message|answer|reply)))\b/gi, "")
    .replace(/[^a-z0-9]+/gi, "");
  return rest ? { after: true } : { last: true };
}
