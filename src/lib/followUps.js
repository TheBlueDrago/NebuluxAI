// Quick follow-ups under the latest answer in the chat (tap one to send it). Chosen from the
// answer itself, with no extra AI call: code gets code follow-ups, long answers "make it
// shorter", explanations "quiz me". Errors and cut-off answers get none.
const hasCode = (t) => /```/.test(t);
const words = (t) => t.split(/\s+/).filter(Boolean).length;

export function followUps(question, answer) {
  // Settings → Capabilities → Suggested follow-ups.
  try { if (localStorage.getItem("nx-followups") === "off") return []; } catch { /* fine */ }
  const a = String(answer || "");
  const q = String(question || "");
  if (!a.trim() || a.startsWith("⚠") || /_\(stopped\)_\s*$/.test(a) || /Sorry, something went wrong/.test(a)) return [];
  const out = [];
  if (/```quiz/.test(a)) {
    out.push("Quiz me again, a bit harder", "Make flashcards");
  } else if (/```flashcards/.test(a)) {
    out.push("Make 10 more flashcards", "Quiz me on this");
  } else if (hasCode(a)) {
    out.push("Explain this code step by step");
    out.push("Add comments to the code");
    if (!/\bbug|fix|error\b/i.test(q)) out.push("How could this code go wrong?");
  } else {
    const n = words(a);
    if (n < 25) return []; // "Hi! How can I help?" needs no follow-ups
    if (n > 60) out.push("Explain it more simply");
    const studyable = n > 40 && !/\b(poem|story|email|letter|essay|joke|song)\b/i.test(q);
    out.push(studyable ? "Make flashcards" : "Give me an example");
    if (studyable) out.push("Quiz me on this");
    if (n > 180) out.push("Make it shorter");
    if (/\b(poem|story|email|letter|essay|post|caption)\b/i.test(q)) {
      out.length = 0;
      out.push("Make it shorter", "Make it funnier", "Make it more formal");
    }
  }
  return out.slice(0, 3);
}
