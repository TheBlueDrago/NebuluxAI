import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { appsOn, whatsappLink } from "@/lib/connectors";

// With the WhatsApp connector on (Settings → Connectors), a reply can go to a WhatsApp chat: this opens
// WhatsApp with the reply ready, and the person picks the chat and sends it there.
export default function WhatsAppSend({ text }) {
  const [on, setOn] = useState(() => appsOn().includes("whatsapp"));
  useEffect(() => {
    const f = () => setOn(appsOn().includes("whatsapp"));
    window.addEventListener("nx-apps", f);
    return () => window.removeEventListener("nx-apps", f);
  }, []);
  if (!on) return null;
  return (
    <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer" title="Send to WhatsApp" aria-label="Send to WhatsApp" className="p-1 rounded-md text-slate-500 hover:text-slate-200">
      <Send className="w-3.5 h-3.5" />
    </a>
  );
}
