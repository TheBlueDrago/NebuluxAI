import React from "react";

// An email address that breaks after the @ when it doesn't fit on a small phone
// (break-all split it as "support@nebuluxai.co" / "m").
export default function EmailText({ email, className = "" }) {
  const at = String(email).indexOf("@");
  return (
    <span className={`min-w-0 [overflow-wrap:anywhere] ${className}`}>
      {at > 0 ? <>{email.slice(0, at + 1)}<wbr />{email.slice(at + 1)}</> : email}
    </span>
  );
}
