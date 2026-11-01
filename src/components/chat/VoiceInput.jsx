import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { stopSpeaking } from "@/components/chat/ReadAloud";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// Mic button: speak instead of typing. Uses the browser's own speech-to-text (Chrome, Edge,
// Safari); hidden where there isn't one. What you say is added to the message box, not sent.
// In the chat, a message asked this way has its answer read out loud (talk-back).
export default function VoiceInput({ onText, disabled }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef(null);

  useEffect(() => () => rec.current?.abort(), []);

  if (!Recognition) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    setError("");
    // Talking over the AI's voice: stop it so the mic doesn't hear it.
    stopSpeaking();
    const r = new Recognition();
    r.lang = navigator.language || "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Allow the microphone to talk." : "Didn't catch that. Try again.");
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={listening ? "Stop listening" : "Speak your message"}
        aria-label={listening ? "Stop listening" : "Speak your message"}
        className={`tap-area p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
          listening ? "bg-red-500/20 text-red-300 animate-pulse" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      {error && <span className="text-[11px] text-amber-300">{error}</span>}
    </span>
  );
}
