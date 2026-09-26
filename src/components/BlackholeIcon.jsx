import React from "react";

// The Nebulux AI logo (a nebula), used in headers, the chat and loading spinners. It's never
// shown bigger than 80px, so a 160px copy (5 KB) is used instead of the 512px logo.png (385 KB).
export default function BlackholeIcon({ className = "" }) {
  return <img src="/logo-small.jpg" alt="" aria-hidden="true" draggable="false" className={`rounded-[22%] object-cover select-none ${className}`} />;
}
