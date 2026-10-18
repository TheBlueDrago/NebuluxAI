// Same chat filter as the game server (workers/nebulux-multiplayer/worker.js): used for messages
// between friends on the Games page (functions/.../social.js). Keep the two in step.
// Typed chat. Many players are kids, so every message is checked here before anyone sees it:
// swear words are starred out, and anything that could share personal info or move people off
// the game (links, emails, phone numbers, social media handles, "add me on...") isn't sent at all.
const CHAT_MAX = 80;
const CHAT_GAP_MS = 2000;
const BAD = ["fuck", "shit", "bitch", "cunt", "dick", "pussy", "cock", "bastard", "asshole", "slut", "whore", "nigger", "nigga", "fag", "faggot", "retard", "rape", "porn", "sex", "nude", "nudes", "kys", "kill yourself", "damn", "crap", "piss", "twat", "wanker", "dumbass", "jackass", "motherfucker", "penis", "vagina", "boobs", "tits"];
// Words that are bad with any ending ("fucking", "shitty"); the rest only count as whole words.
const STEMS = ["fuck", "shit", "bitch", "cunt", "fag", "porn", "nigg", "slut", "whore"];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
const plain = (t) => t.toLowerCase().replace(/[0-9@$!]/g, (c) => LEET[c] || c).replace(/[^a-z ]/g, "");
const PERSONAL = [
  /https?:|www\.|\.(com|net|org|gg|io|me|ly|co|xyz|tv)\b/i,
  /\S+@\S+/,
  /(\d[\s.\-()]*){5,}/,
  /\b(discord|snap(chat)?|insta(gram)?|tiktok|whats ?app|telegram|kik|facebook|fb|twitter|youtube|roblox|phone|number|address|password|where do you live|how old|ur age|your age)\b/i,
];
export function cleanChat(raw) {
  let t = String(raw || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
  if (!t) return { ok: false };
  if (PERSONAL.some((re) => re.test(t))) return { ok: false, why: "No links, numbers, accounts or personal info in chat." };
  // Whole phrases ("kill yourself") and letters spaced out to sneak a word through ("f u c k") aren't sent.
  const p = plain(t);
  if (BAD.some((w) => w.includes(" ") && p.includes(w))) return { ok: false, why: "Keep chat friendly." };
  const singles = (p.match(/(?:\b[a-z]\b ?){3,}/g) || []).map((x) => x.replace(/ /g, ""));
  if (singles.some((x) => BAD.some((w) => w.length >= 3 && x.includes(w.replace(/ /g, ""))))) return { ok: false, why: "Keep chat friendly." };
  // Single bad words are starred out (whole words, or words that start with one, like "fucking"),
  // so "grape" or "Dickens" stay as they are.
  t = t
    .split(" ")
    .map((tok) => {
      const q = plain(tok).replace(/ /g, "");
      return BAD.some((w) => !w.includes(" ") && (q === w || (STEMS.includes(w) && q.startsWith(w)))) ? "*".repeat(tok.length) : tok;
    })
    .join(" ");
  return { ok: true, text: t };
}
