import React from "react";

// The mark beside a chat (and on the Dashboard), like Claude's:
//   working: a hollow circle that blinks while the AI writes
//   unread:  a blue dot when the answer is ready and you haven't looked
//   out:     a red warning triangle when it stopped because the credits ran out
export default function StatusMark({ status, className = "" }) {
  if (status === "working")
    return <span className={`inline-block w-2.5 h-2.5 shrink-0 rounded-full border-2 border-indigo-300 animate-pulse ${className}`} role="img" aria-label="The AI is answering" title="The AI is answering" />;
  if (status === "unread")
    return <span className={`inline-block w-2.5 h-2.5 shrink-0 rounded-full bg-sky-400 ${className}`} role="img" aria-label="New answer" title="New answer" />;
  if (status === "out")
    return (
      <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-red-500 ${className}`} role="img" aria-label="Stopped: out of credits">
        <title>Stopped: out of credits</title>
        <path fill="currentColor" d="M12 2 1 21h22L12 2zm1 15h-2v2h2v-2zm0-7h-2v5h2v-5z" />
      </svg>
    );
  return null;
}
