// The account's team (functions/.../my-team.js). Two parts of the app want it the moment the app opens
// (the credits meter and the team welcome), so they share one answer for a few seconds instead of asking
// once each: every server call counts toward the free plan's daily requests. Team settings asks directly,
// so it always shows changes right away.
import { base44 } from "@/api/base44Client";

let last = null; // { at, p }

export function myTeam() {
  if (last && Date.now() - last.at < 10000) return last.p;
  const p = base44.functions.invoke("my-team");
  last = { at: Date.now(), p };
  p.catch(() => {
    if (last && last.p === p) last = null;
  });
  return p;
}
