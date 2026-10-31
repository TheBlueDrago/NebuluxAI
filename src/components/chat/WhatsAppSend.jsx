import React, { useEffect, useState } from "react";
import { Send, Check, Loader2 } from "lucide-react";
import { appsOn, waLinked, whatsappLink, sendToWhatsApp, whatsappError } from "@/lib/connectors";
import { showNotice } from "@/lib/dialogs";

// With the WhatsApp connector on (Settings → Connectors), a reply can go to WhatsApp. With the person's
// own number linked, pressing it sends the reply straight to their WhatsApp; otherwise it opens WhatsApp
// with the reply ready, and they pick the chat and send it there.
export default function WhatsAppSend({ text }) {
  const [on, setOn] = useState(() => appsOn().includes("whatsapp"));
  const [linked, setLinked] = useState(waLinked);
  const [state, setState] = useState("");
  useEffect(() => {
    const f = () => { setOn(appsOn().includes("whatsapp")); setLinked(waLinked()); };
    window.addEventListener("nx-apps", f);
    return () => window.removeEventListener("nx-apps", f);
  }, []);
  if (!on) return null;
  const cls = "p-1 rounded-md text-slate-500 hover:text-slate-200";
  if (!linked) {
    return (
      <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer" title="Send to WhatsApp" aria-label="Send to WhatsApp" className={cls}>
        <Send className="w-3.5 h-3.5" />
      </a>
    );
  }
  const send = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      await sendToWhatsApp(text);
      setState("sent");
      setTimeout(() => setState(""), 2500);
    } catch (e) {
      setState("");
      showNotice(whatsappError(e).replace(/ \[Open WhatsApp\]\(.*\)$/, ""));
    }
  };
  const label = state === "sent" ? "Sent to your WhatsApp" : "Send to my WhatsApp";
  return (
    <button type="button" onClick={send} title={label} aria-label={label} className={cls}>
      {state === "busy" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === "sent" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Send className="w-3.5 h-3.5" />}
    </button>
  );
}
