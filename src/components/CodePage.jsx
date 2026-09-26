import React, { useState, useRef } from "react";
import { askConfirm } from "@/lib/dialogs";
import Markdown, { CopyButton } from "@/components/chat/Markdown";
import ReportReply from "@/components/chat/ReportReply";
import { Terminal, RotateCcw } from "lucide-react";
import { OUT_OF_CREDITS_NOTE } from "@/lib/creditCost";
import OutOfCredits from "@/components/chat/OutOfCredits";
import { useEffort, effortFor } from "@/lib/effort";
import { streamChat } from "@/lib/aiStream";
import EffortPicker from "@/components/chat/EffortPicker";
import BlackholeIcon from "@/components/BlackholeIcon";
import QueueList from "@/components/chat/QueueList";
import SendOrStopButton from "@/components/chat/SendOrStopButton";
import useMessageQueue from "@/hooks/useMessageQueue";
import useBuildMode, { BUILD_NOTE, ANSWER_NOTE, resolveIntent } from "@/hooks/useBuildMode";
import ModeToggle from "@/components/chat/ModeToggle";
import useStickToBottom from "@/hooks/useStickToBottom";
import { isNetworkError, OFFLINE_NOTE } from "@/lib/netError";
import { secretKeyIn } from "@/lib/privateInfo";
import { historyBlock } from "@/lib/chatHistory";
import { followUps } from "@/lib/followUps";
import { readAboutMe, aboutMeBlock } from "@/lib/aboutMe";
import AboutMeButton from "@/components/chat/AboutMeButton";
import VoiceInput from "@/components/chat/VoiceInput";
import { useAppShell } from "@/components/AppShellContext";
import useReplyAnnouncer from "@/hooks/useReplyAnnouncer";

export default function CodePage({ aiCodeExhausted, aiCodeRemaining, onSpendAICode, userInitial }) {
  const buildMode = useBuildMode("code");
  const [effort, setEffort] = useEffort();
  const [live, setLive] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const userId = useAppShell()?.currentUser?.id;
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);

  // `before`: how many messages come before this question (Try again leaves out the reply it
  // replaces). The recent conversation goes with it, so follow-ups work (lib/chatHistory.js).
  const runPrompt = async (text, before = messages.length) => {
    const history = aboutMeBlock(readAboutMe(userId)) + historyBlock(messages.slice(0, before));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setLive("");
    const myId = ++reqIdRef.current;
    const intent = resolveIntent(text, buildMode.mode);
    try {
      const modeNote = intent.build ? BUILD_NOTE : ANSWER_NOTE;
      const eff = effortFor(effort, text, { build: intent.build });
      // Streamed so the reply appears as it's written.
      // Aborted by Stop, which also ends the reply on the server (see aiStream.js).
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const res = await streamChat({ prompt: `${modeNote}\n\n${history}${text}`, question: text, model: "claude_sonnet_4_6", effort: eff }, (soFar) => {
        if (reqIdRef.current === myId) setLive(soFar);
      }, { signal: abort.signal });
      if (reqIdRef.current !== myId) return;
      setLive("");
      // The server charged the credits (cutting the reply off if they ran out); show its new status.
      onSpendAICode?.(res.credits);
      const content = res.content ?? "";
      setMessages((m) => [...m, { role: "ai", content: res.cut ? `${content.trimEnd()}…\n\n${OUT_OF_CREDITS_NOTE}` : content, ...(res.more ? { more: true } : {}) }]);
    } catch (e) {
      if (reqIdRef.current !== myId) return;
      setLive("");
      const data = e?.response?.data;
      if (data?.credits) onSpendAICode?.(data.credits);
      setMessages((m) => [...m, { role: "ai", content: data?.error ? `⚠ ${data.error}` : isNetworkError(e) ? `⚠ ${OFFLINE_NOTE}` : "⚠ Sorry, something went wrong. Please try again." }]);
    } finally {
      if (reqIdRef.current === myId) {
        setLoading(false);
        q.runNext();
      }
    }
  };

  const q = useMessageQueue({ run: runPrompt, remaining: { code: aiCodeRemaining ?? (aiCodeExhausted ? 0 : Infinity) }, names: { code: "Nebulux Code" }, selectedAi: "code" });

  useStickToBottom(scrollRef, [messages, loading, live, q.queue.length], messages.filter((m) => m.role === "user").length);

  const stop = () => {
    reqIdRef.current++;
    abortRef.current?.abort();
    // The server settles the charge for what was written once it notices; re-read credits then.
    setTimeout(() => onSpendAICode?.(), 2500);
    setLoading(false);
    setInput("");
    // Keep what was already written (it's charged).
    if (live.trim()) {
      setMessages((m) => [...m, { role: "ai", content: `${live.trimEnd()}\n\n_(stopped)_` }]);
      setLive("");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    // Pasted code often carries a real API key or token: check first (the text stays in the box).
    if (secretKeyIn(text) && !await askConfirm("This looks like it has a secret key (like an API key or access token) in it. Anyone who gets it can use that account, so replace it with something like YOUR_API_KEY first. Send it anyway?")) return;
    if (q.shouldQueue(loading)) {
      q.push(text);
      setInput("");
      if (!loading) q.runNext();
      return;
    }
    if (aiCodeExhausted) return;
    runPrompt(text);
  };

  // Ask the last question again, replacing the last reply.
  const retryLast = () => {
    const n = messages.length;
    if (loading || aiCodeExhausted || n < 2 || messages[n - 1].role !== "ai" || messages[n - 2].role !== "user") return;
    const question = messages[n - 2].content;
    setMessages((m) => m.slice(0, -2));
    runPrompt(question, n - 2);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const queued = loading || q.paused;
  const canSend = input.trim().length > 0 && (queued || !aiCodeExhausted);

  const announce = useReplyAnnouncer(messages, loading, "code");

  return (
    <div className="w-full max-w-3xl px-3 sm:px-4">
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* Same as the home chat: no blur, smooth scrolling or scroll trapping, for phones. */}
      <div className="bg-slate-900/80 border border-emerald-700/40 rounded-3xl overflow-hidden shadow-2xl">
        <div ref={scrollRef} className="h-[55vh] sm:h-96 overflow-y-auto overscroll-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="keep-color w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <p className="text-slate-200 font-medium text-lg">Let's start coding</p>
              <p className="text-slate-500 text-sm mt-1">Nebulux Code is ready to build</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] min-w-0 px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-gradient-to-br from-emerald-700 to-emerald-800 text-[#fff] rounded-br-sm"
                    : "bg-slate-800 text-slate-100 rounded-bl-sm border border-emerald-700/40"
                }`}
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <>
                    <Markdown text={m.content} />
                    {i === messages.length - 1 && !loading && !aiCodeExhausted && m.content.startsWith("⚠") && (
                      <button type="button" onClick={retryLast} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-[#fff]">
                        <RotateCcw className="w-3.5 h-3.5" /> Try again
                      </button>
                    )}
                    <div className="flex flex-wrap justify-end gap-1 mt-1 -mb-1">
                      {i === messages.length - 1 && !loading && !aiCodeExhausted && (
                        <button
                          type="button"
                          onClick={retryLast}
                          title="Try again (uses credits)"
                          aria-label="Try again"
                          className="p-1 rounded-md text-slate-500 hover:text-slate-200"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <CopyButton getText={() => m.content} label="Copy reply" className="p-1 rounded-md text-slate-500 hover:text-slate-200" />
                      <ReportReply question={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""} reply={m.content} />
                    </div>
                    {i === messages.length - 1 && !loading && !aiCodeExhausted && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(m.more ? ["Keep going from exactly where you stopped."] : followUps(messages[i - 1]?.role === "user" ? messages[i - 1].content : "", m.content)).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => runPrompt(f)}
                            className="px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[12px] text-emerald-200 hover:bg-emerald-500/20 transition-colors"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {m.role === "user" && (
                <div className="keep-color w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {userInitial || "U"}
                </div>
              )}
            </div>
          ))}

          {loading && live && (
            <div className="flex justify-start">
              <div className="max-w-[80%] min-w-0 px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-slate-800 text-slate-100 border border-emerald-700/40">
                <Markdown text={live} />
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-emerald-400 animate-pulse" />
              </div>
            </div>
          )}

          {loading && !live && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-emerald-700/40 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2.5">
                <BlackholeIcon className="w-5 h-5 animate-spin" />
                <span className="text-slate-300 text-sm animate-pulse">
                  Thinking...{q.queue.length > 0 ? ` (${q.queue.length} queued)` : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-emerald-700/40 p-3">
          <QueueList q={q} loading={loading} />
          {aiCodeExhausted && !loading && <OutOfCredits tier="aiCode" canSwitch={false} />}
          <div className="flex items-end gap-2 bg-slate-800/70 rounded-2xl border border-emerald-700/40 focus-within:border-emerald-500/50 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={queued ? "Type to queue your next message…" : "Message Nebulux AI..."}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 max-h-32 text-sm"
            />
            <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} gradient="from-emerald-500 to-teal-500" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <AboutMeButton userId={userId} />
            <VoiceInput onText={(t) => setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t))} />
            <EffortPicker value={effort} onChange={setEffort} />
            <ModeToggle mode={buildMode.mode} onChange={buildMode.setMode} />
          </div>
          <p className="text-center text-xs text-slate-600 mt-2">Nebulux AI can make mistakes. Check important info, and never share passwords or card numbers with it.</p>
        </div>
      </div>
    </div>
  );
}