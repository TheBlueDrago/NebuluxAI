import { useState, useRef, useEffect } from "react";

// A message sent while the AI is writing never waits (owner, 2026-11-02: "stop making the messages
// queue, make them send immediately"): the AI stops, reads the new message along with what it had
// written so far (steerBlock), and does what it says. The list below is only for chats that line up
// prompts themselves; runNext() sends the first one when the AI finishes.
// If the selected AI is out of credits, runNext switches to the AI with the most credits left and sets a notice.
export default function useMessageQueue({ run, remaining, names, selectedAi, onChangeAi }) {
  const [queue, setQueue] = useState([]);
  const steerRef = useRef("");
  const [notice, setNotice] = useState("");
  const qRef = useRef([]);
  const idRef = useRef(0);
  const latest = useRef({});
  latest.current = { run, remaining, names, selectedAi, onChangeAi };

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const commit = (fn) => {
    const next = fn(qRef.current);
    qRef.current = next;
    setQueue(next);
  };

  const push = (text) => commit((q) => [...q, { id: ++idRef.current, text }]);

  const runNext = () => {
    if (!qRef.current.length) return false;
    const { run, remaining, names, selectedAi, onChangeAi } = latest.current;
    const rem = (id) => (remaining?.[id] ?? Infinity);
    let ai = selectedAi;
    if (rem(ai) <= 0) {
      const best = Object.keys(names).sort((a, b) => rem(b) - rem(a))[0];
      if (rem(best) <= 0) return false;
      setNotice(`You ran out of ${names[ai]} credits so we changed your ai to ${names[best]}`);
      onChangeAi?.(best);
      ai = best;
    }
    const [next, ...rest] = qRef.current;
    commit(() => rest);
    run(next.text, ai);
    return true;
  };

  const setSteer = (partial) => {
    steerRef.current = String(partial || "").trim() || "(nothing yet)";
  };
  // Added to the next prompt once, after an interruption.
  const steerBlock = () => {
    const p = steerRef.current;
    steerRef.current = "";
    if (!p) return "";
    return (
      `[You were answering the previous message and had written this so far:\n"""\n${p.slice(-4000)}\n"""\n` +
      `The user interrupted you with the message below. Read it first: if it changes what they want ("do this instead", a correction, a new detail), do what it says now. ` +
      `If it asks for something once you're done ("after you finish…"), finish what you were doing first, then do that too. ` +
      `If it's just a comment or question, answer it and then carry on with what you were doing.]\n\n`
    );
  };

  return { queue, notice, dismissNotice: () => setNotice(""), push, runNext, setSteer, steerBlock };
}
