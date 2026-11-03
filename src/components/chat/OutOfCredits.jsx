import React from "react";
import SessionLimit from "@/components/chat/SessionLimit";

// Shown above the message box when the chosen AI can't answer. Every AI now shares one pool with a
// 5-hour and a weekly limit, like Claude (cloudflare-lib/creditSession.js; owner, 2026-11-03), so the
// only reason is a used-up limit: SessionLimit says which one and when it resets. (`tier` and
// `canSwitch` are no longer needed: switching AIs doesn't help.)
// eslint-disable-next-line no-unused-vars
export default function OutOfCredits({ tier, canSwitch }) {
  return <SessionLimit />;
}
