// nebulux-support-mail: handles email sent to support@nebuluxai.com (Cloudflare Email Routing
// sends it here). Every email is forwarded to the owner's inbox. Emails from real people also get
// an automatic reply written by the AI (functions/api/support-reply.js on the Pages app), sent
// back from "Nebulux AI Support". Automatic emails (no-reply senders, mailing lists, bounces,
// other auto-replies) never get a reply, so two robots can't answer each other forever.
import PostalMime from "postal-mime";
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";
import { isAutomatic } from "./automatic.js";
import { watchdog } from "./watchdog.js";
import { notify } from "./notify.js";

const OWNER = "thebluedragonstriker@gmail.com";
const SUPPORT = "support@nebuluxai.com";
const API = "https://nebuluxai.pages.dev/api/support-reply";


export default {
  // Contact page messages to the owner's inbox (notify.js).
  async fetch(request, env) {
    return notify(request, env);
  },
  // The site watchdog (watchdog.js), run by the cron trigger.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(watchdog(env));
  },
  async email(message, env, ctx) {
    // The owner always gets the email.
    await message.forward(OWNER).catch(() => {});
    if (isAutomatic(message.from, message.headers)) return;

    let parsed;
    try {
      parsed = await new PostalMime().parse(message.raw);
    } catch {
      return;
    }
    const text = (parsed.text || String(parsed.html || "").replace(/<[^>]+>/g, " ")).trim();
    if (!text) return;

    let reply = "";
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json", "x-support-key": env.SUPPORT_KEY },
        body: JSON.stringify({ from: message.from, subject: parsed.subject || "", text }),
      });
      reply = (await res.json()).reply || "";
    } catch {
      return;
    }
    if (!reply) return;

    const msg = createMimeMessage();
    const id = message.headers.get("Message-ID");
    if (id) {
      msg.setHeader("In-Reply-To", id);
      msg.setHeader("References", id);
    }
    msg.setHeader("Auto-Submitted", "auto-replied");
    msg.setSender({ name: "Nebulux AI Support", addr: SUPPORT });
    msg.setRecipient(message.from);
    const subj = parsed.subject || "Your message";
    msg.setSubject(/^re:/i.test(subj) ? subj : `Re: ${subj}`);
    msg.addMessage({
      contentType: "text/plain",
      data: `${reply}\n\n--\nThis reply was written by Nebulux AI's assistant. If you need a person, just reply and the team will get back to you.`,
    });
    await message.reply(new EmailMessage(SUPPORT, message.from, msg.asRaw())).catch(() => {});
  },
};
