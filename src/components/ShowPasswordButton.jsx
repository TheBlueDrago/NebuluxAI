import React from "react";
import { Eye, EyeOff } from "lucide-react";

// The eye button inside a password box: shows what's been typed, so fewer typing mistakes
// use up sign-in tries (wrong passwords are limited, see cloudflare-lib/authlimit.js).
export default function ShowPasswordButton({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
    >
      {shown ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}
