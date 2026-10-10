// Content check for Monitor → Published sites & games. Reads a page's HTML and flags it:
//   red    — inappropriate for kids / adult content, copyright clone, phishing, crypto
//            miner or wallet scam, or a malware score of 50% or more
//   yellow — might be harmful: hidden/scrambled code, outside scripts, redirects, hacking
//            or cheat talk, gambling/drugs, a brand name (possible copyright)
//   green  — nothing suspicious found
// It's a quick pattern check, not a guarantee; Monitor also offers an "AI check" that
// has Gemini read the page (reviewPage below).
import { findCredentialForm, findCredentialLeak } from "./phishing.js";

const FLAG_RANK = { red: 0, yellow: 1, green: 2 };
export const flagRank = (f) => FLAG_RANK[f] ?? 2;

const ADULT = /\b(porn\w*|xxx|nsfw|nudes?|naked|sex(?:y|ual)?|hentai|onlyfans|camgirls?|escorts?|strip ?club|erotic\w*)\b/gi;
const PROFANITY = /\b(fuck\w*|shit\w*|bitch\w*|cunt|dick(?:head)?|asshole|motherf\w+|bastard)\b/gi;
const GAMBLING = /\b(casino|betting|bet now|slots?|jackpot|poker|roulette|sportsbook)\b/gi;
const DRUGS = /\b(cocaine|heroin|meth(?:amphetamine)?|weed|marijuana|cannabis|vape shop|lsd|mdma)\b/gi;
const VIOLENCE = /\b(gore|behead\w*|suicide|self[- ]harm|massacre|terroris\w+)\b/gi;
const HACKING = /\b(hack(?:s|ed|er|ing)?|cheats?|aimbot|wallhack|keylogger|free robux|free v-?bucks|robux generator|account generator|crack(?:ed)? (?:version|software)|ddos|token grabber|password stealer)\b/gi;
const EXECUTABLE = /href\s*=\s*["'][^"']+\.(exe|apk|msi|bat|scr|dmg|jar|vbs|ps1)["']/gi;
const MINER = /\b(coinhive|coin-hive|cryptonight|crypto-?loot|webminer|coinimp|jsecoin|minero\.cc|deepminer|webmine\.pro)\b/i;
// Crypto scams: "type your wallet's recovery phrase to claim free coins" (whoever has the
// phrase or private key owns the wallet), and code asking a wallet to send money or hand
// over control of its tokens (a "wallet drainer").
const SEED_ASK = /\b(?:seed|recovery|mnemonic|wallet|backup)\s+phrases?\b|\bprivate\s+keys?\b/i;
const CRYPTO = /\b(?:wallets?|crypto\w*|bitcoin|btc|ethereum|eth|metamask|trust ?wallet|phantom|coinbase|binance|nfts?|tokens?|airdrops?|solana|usdt|coins?)\b/i;
const WALLET_SPEND = /\b(?:eth_sendTransaction|eth_signTypedData(?:_v\d)?|personal_sign|setApprovalForAll|increaseAllowance|signAllTransactions|signAndSendTransaction)\b/;
const BRANDS = /\b(nintendo|pok[eé]mon|disney|pixar|marvel|star wars|netflix|spotify|youtube|tiktok|instagram|facebook|roblox|minecraft|fortnite|apple|google|microsoft|amazon|paypal|playstation|xbox|mario|sonic)\b/gi;

function count(re, text) {
  return (text.match(re) || []).length;
}

function distinct(re, text) {
  return new Set((text.match(re) || []).map((m) => m.toLowerCase())).size;
}

// Visible words only (tags, scripts and styles removed) for the content checks.
function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ");
}

function externalHosts(html, attrRe) {
  const hosts = new Set();
  let m;
  while ((m = attrRe.exec(html))) {
    try {
      const h = new URL(m[1]).hostname.toLowerCase();
      if (!h.endsWith("nebuluxai.com")) hosts.add(h);
    } catch {
      // Relative URL: fine.
    }
  }
  return [...hosts];
}

// Well-known libraries and font hosts that are normal for generated pages.
const TRUSTED_SCRIPT_HOSTS = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com|code\.jquery\.com|ajax\.googleapis\.com|threejs\.org|cdn\.skypack\.dev)$/;

export function scanPage(html) {
  const src = String(html || "");
  const text = visibleText(src);
  const reasons = [];
  let malware = 0; // 0-100
  let red = false;
  let yellow = false;
  // Red reasons serious enough to refuse publishing outright (a brand name alone isn't:
  // kids make fan pages all the time, so that stays a Monitor flag for a human to judge).
  const block = [];

  const phish = findCredentialForm(src);
  if (phish) {
    red = true;
    malware += 60;
    reasons.push(`Phishing: ${phish}`);
  }
  // Stricter: passwords or card numbers sent away by script, or a fake Nebulux AI sign-in.
  // Refused at publish; only flagged (not taken down) for pages that are already live.
  const leak = !phish && findCredentialLeak(src);
  if (leak) {
    red = true;
    malware += 60;
    reasons.push(`Phishing: ${leak}`);
    block.push(leak);
  }
  if (MINER.test(src)) {
    red = true;
    malware += 70;
    reasons.push("Contains a crypto-mining script");
    block.push("a crypto-mining script");
  }

  if (SEED_ASK.test(text) && CRYPTO.test(text) && /<(?:input|textarea)\b/i.test(src)) {
    red = true;
    malware += 60;
    reasons.push("Asks for a crypto wallet's recovery phrase or private key (a common scam)");
    block.push("a box asking for a crypto wallet's recovery phrase or private key");
  }
  if (WALLET_SPEND.test(src)) {
    red = true;
    malware += 40;
    reasons.push("Asks a crypto wallet to send money or give up control of its coins (check it isn't a scam)");
  }

  const evalUse = count(/\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]/g, src);
  const decode = count(/\batob\s*\(|unescape\s*\(|String\.fromCharCode\s*\(/g, src);
  const longEncoded = count(/["'`][A-Za-z0-9+/=]{400,}["'`]|(?:\\x[0-9a-f]{2}){40,}/gi, src);
  if (evalUse) {
    malware += Math.min(30, evalUse * 10);
    yellow = true;
    reasons.push(`Runs code built from text (eval) ×${evalUse}`);
  }
  if (decode >= 3 || longEncoded) {
    malware += Math.min(30, decode * 3 + longEncoded * 15);
    yellow = true;
    reasons.push("Hidden or scrambled code");
  }

  const scriptHosts = externalHosts(src, /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi).filter((h) => !TRUSTED_SCRIPT_HOSTS.test(h));
  if (scriptHosts.length) {
    malware += Math.min(25, scriptHosts.length * 10);
    yellow = true;
    reasons.push(`Loads scripts from ${scriptHosts.slice(0, 3).join(", ")}`);
  }
  const frameHosts = externalHosts(src, /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi).filter((h) => !/youtube(-nocookie)?\.com$|vimeo\.com$|google\.com$/.test(h));
  if (frameHosts.length) {
    malware += 10;
    yellow = true;
    reasons.push(`Embeds other websites (${frameHosts.slice(0, 2).join(", ")})`);
  }
  if (/(?:window\.|document\.|top\.)location(?:\.href)?\s*=\s*["'`]https?:\/\/(?!([a-z0-9-]+\.)*nebuluxai\.com)/i.test(src) || /<meta[^>]+http-equiv\s*=\s*["']?refresh[^>]+url\s*=\s*https?:\/\//i.test(src)) {
    malware += 20;
    yellow = true;
    reasons.push("Sends visitors to another website automatically");
  }
  const exes = count(EXECUTABLE, src);
  if (exes) {
    malware += Math.min(40, exes * 20);
    yellow = true;
    reasons.push("Offers program downloads (.exe/.apk)");
  }
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(src) && !phish) {
    yellow = true;
    reasons.push("Has a password box (check it isn't a fake login)");
  }
  const hacking = distinct(HACKING, text);
  if (hacking) {
    malware += Math.min(30, hacking * 8);
    yellow = true;
    reasons.push("Talks about hacking, cheats or free-currency generators");
  }

  const adult = distinct(ADULT, text);
  const adultHits = count(ADULT, text);
  if (adult >= 2 || adultHits >= 3) {
    red = true;
    reasons.push("Adult content (not appropriate for kids)");
    block.push("adult content");
  } else if (adultHits) {
    yellow = true;
    reasons.push("Mentions adult topics");
  }
  const swears = count(PROFANITY, text);
  if (swears >= 5) {
    red = true;
    reasons.push("Lots of swearing");
    block.push("lots of swearing");
  } else if (swears) {
    yellow = true;
    reasons.push("Some swearing");
  }
  if (count(VIOLENCE, text)) {
    yellow = true;
    reasons.push("Violent or self-harm topics");
  }
  if (count(GAMBLING, text) >= 2) {
    yellow = true;
    reasons.push("Gambling");
  }
  if (count(DRUGS, text)) {
    yellow = true;
    reasons.push("Drugs");
  }

  // A page that heavily uses one big brand is likely a copy of that brand's site/game.
  const brandCounts = {};
  for (const b of text.match(BRANDS) || []) brandCounts[b.toLowerCase()] = (brandCounts[b.toLowerCase()] || 0) + 1;
  const [topBrand, topCount] = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0] || [];
  if (topCount >= 6) {
    red = true;
    reasons.push(`Looks like a copy of ${topBrand} (copyright)`);
  } else if (topCount) {
    yellow = true;
    reasons.push(`Uses the name "${topBrand}" (possible copyright)`);
  }

  malware = Math.min(100, malware);
  if (malware >= 50) {
    red = true;
    reasons.push(`Malware score ${malware}%`);
  }
  // Blocking needs a higher bar than the red flag: a calculator using eval plus a
  // game decoding a few strings can reach 50 without being harmful.
  if (malware >= 70) block.push("code that looks harmful (hidden scripts, downloads or redirects)");
  return { flag: red ? "red" : yellow ? "yellow" : "green", malware, reasons, block };
}

// "AI check": Gemini reads the page and judges it. Returns { flag, reasons } or throws.
export async function reviewPage(apiKey, html, what) {
  const prompt = [
    `You are a safety reviewer for a website builder used by kids. Review this ${what}'s HTML and decide a flag:`,
    '- "red": inappropriate for kids (adult, very violent, hateful), a copy of a copyrighted site/game/brand, phishing or scams, or clearly malicious code (malware, miners, data stealing) — or more than 50% likely to be malware.',
    '- "yellow": might be harmful: suspicious or hidden code, hacking/cheat content, mature themes, possible copyright use, collecting personal info.',
    '- "green": safe and appropriate for kids.',
    'Reply with ONLY JSON: {"flag": "red"|"yellow"|"green", "reasons": ["short reason", ...]} (at most 4 reasons; empty for green).',
    "",
    "HTML:",
    String(html || "").slice(0, 60000),
  ].join("\n");
  for (const model of ["gemini-3.6-flash", "gemini-3.8-flash"]) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048, responseMimeType: "application/json" } }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
        .map((p) => (p.thought ? "" : p.text || ""))
        .join("");
      const out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if (!["red", "yellow", "green"].includes(out.flag)) continue;
      return { flag: out.flag, reasons: (Array.isArray(out.reasons) ? out.reasons : []).map(String).slice(0, 4) };
    } catch {
      // Try the next model.
    }
  }
  throw new Error("The AI check is busy right now. Try again in a minute.");
}
