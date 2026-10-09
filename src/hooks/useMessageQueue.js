import { useState, useRef, useEffect } from "react";

// "After you finish…" messages wait here; any other message sent while the AI is writing
// interrupts it (Claude-style): the AI stops, reads the new message along with what it had
// written so far (steerBlock), and does what it says.
export const isAfterMsg = (t) => /\b((after|when|once) (you('?re| are) )?(you )?(done|finish(ed)?)|after (that|this)|then (also )?add|next,? (add|do|make))\b/i.test(t);

// Shared message queue for every AI chat. `run(text, ai)` sends one prompt; call `runNext()` when it finishes.
// If the selected AI is out of credits, the queue switches to the AI with the most credits left and sets a notice.
export default function useMessageQueue({ run, remaining, names, selectedAi, onChangeAi }) {
  const [queue, setQueue] = useState([]);
  const [paused, setPaused] = useState(false);
  const steerRef = useRef("");
  const [notice, setNotice] = useState("");
  const qRef = useRef([]);
  const pausedRef = useRef(false);
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
  const update = (id, text) => commit((q) => q.map((x) => (x.id === id ? { ...x, text } : x)));
  const remove = (id) => commit((q) => q.filter((x) => x.id !== id));
  const move = (id, dir) =>
    commit((q) => {
      const i = q.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= q.length) return q;
      const n = [...q];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const runNext = () => {
    if (pausedRef.current || !qRef.current.length) return false;
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

  const togglePause = (loading) => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (!next && !loading) runNext();
  };

  // While the AI is writing: "after you finish…" waits (queue); anything else interrupts.
  const shouldQueue = (loading, text = "") => pausedRef.current || (loading ? isAfterMsg(text) : qRef.current.length > 0);
  const shouldInterrupt = (loading, text = "") => loading && !pausedRef.current && !isAfterMsg(text);
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
      `If it's just a comment or question, answer it and then carry on with what you were doing.]\n\n`
    );
  };

  return { queue, paused, notice, dismissNotice: () => setNotice(""), push, update, remove, move, togglePause, runNext, shouldQueue, shouldInterrupt, setSteer, steerBlock };
}