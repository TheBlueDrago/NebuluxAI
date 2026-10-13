import React from "react";
import { Send, Square } from "lucide-react";

// Stop while the AI is answering; with busySend (Chat, Code) it's Send again once something's typed,
// so a new message can go in while it's still answering.
export default function SendOrStopButton({ loading, focused, queued, canSend, onSend, onStop, busySend = false, gradient = "from-indigo-500 to-fuchsia-500" }) {
  if (loading && !(busySend && canSend)) {
    return (
      <button onClick={onStop} className="m-1.5 p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 transition-colors shrink-0" title="Stop generating">
        <Square className="w-5 h-5" />
      </button>
    );
  }
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSend}
      disabled={!canSend}
      className={`m-1.5 p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0`}
      title="Send"
    >
      <Send className="w-5 h-5" />
    </button>
  );
}