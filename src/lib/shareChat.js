// Makes a share link for a chat (functions/.../chat-share.js) and copies it.
import { base44 } from "@/api/base44Client";
import { showNotice } from "@/lib/dialogs";

export async function shareChat({ kind = "chat", title, messages }) {
  try {
    const r = await base44.functions.invoke("chat-share", { action: "create", kind, title, messages });
    const url = r.data.url;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      /* clipboard blocked: the link is shown instead */
    }
    const who = kind === "code" ? "Friends need an account, and Pro or higher, to open a Nebulux Code chat." : "Friends need a Nebulux AI account to open it.";
    await showNotice(`${copied ? "Link copied!" : "Here's your link:"}\n\n${url}\n\nIt shows a copy of this chat as it is now. ${who}`);
  } catch (e) {
    await showNotice(e?.response?.data?.error || "Couldn't make a share link. Please try again.");
  }
}
