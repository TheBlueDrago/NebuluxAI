// Contact page messages to the owner's inbox: the Pages app's contact function
// (functions/.../contact.js) posts each new message here, proven with the SUPPORT_KEY secret, and
// it's emailed to the owner from support@nebuluxai.com with Reply-To set to the person who wrote,
// so pressing Reply in Gmail answers them. (Cloudflare only lets free accounts send to the
// owner's own verified address, which is exactly what this needs.)
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";

const FROM = "support@nebuluxai.com";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export async function notify(request, env) {
  if (request.method !== "POST" || new URL(request.url).pathname !== "/notify") return new Response("Not found", { status: 404 });
  const key = request.headers.get("x-support-key") || "";
  if (!env.SUPPORT_KEY || key.length < 20 || key !== env.SUPPORT_KEY) return new Response("forbidden", { status: 403 });
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || "").trim().slice(0, 200);
  const name = String(b.name || "").replace(/[\r\n<>"]/g, " ").trim().slice(0, 80);
  const topic = String(b.topic || "other").replace(/[\r\n]/g, " ").slice(0, 60);
  const message = String(b.message || "").slice(0, 5000);
  if (!message || !env.WATCHDOG_MAIL) return new Response("skipped", { status: 200 });
  const msg = createMimeMessage();
  msg.setSender({ name: "Nebulux AI Contact form", addr: FROM });
  msg.setRecipient(env.WATCHDOG_TO);
  if (EMAIL_RE.test(email)) msg.setHeader("Reply-To", name ? `"${name}" <${email}>` : email);
  msg.setSubject(`Contact form (${topic}): ${message.replace(/\s+/g, " ").slice(0, 60)}`);
  msg.addMessage({
    contentType: "text/plain",
    data: `From: ${name ? `${name} ` : ""}<${email || "no email"}>\nTopic: ${topic}\n\n${message}\n\n---\nPress Reply to answer them. The message is also in Monitor, Messages.`,
  });
  await env.WATCHDOG_MAIL.send(new EmailMessage(FROM, env.WATCHDOG_TO, msg.asRaw()));
  return new Response("sent", { status: 200 });
}
