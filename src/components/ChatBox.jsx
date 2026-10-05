import React, { useState, useRef, useEffect } from "react";
import { askConfirm } from "@/lib/dialogs";
import Markdown, { CopyButton } from "@/components/chat/Markdown";
import ReadAloud, { speakText, unlockSpeech } from "@/components/chat/ReadAloud";
import { historyBlock } from "@/lib/chatHistory";
import { readAboutMe, aboutMeBlock } from "@/lib/aboutMe";
import AboutMeButton from "@/components/chat/AboutMeButton";
import StudyModeButton from "@/components/chat/StudyModeButton";
import { studyModeOn, studyBlock } from "@/lib/studyMode";
import ReportReply from "@/components/chat/ReportReply";
import { Plus, RotateCcw, Pencil, ImagePlus } from "lucide-react";
import AttachedFile from "@/components/chat/AttachedFile";
import BlackholeIcon from "@/components/BlackholeIcon";
import AiChooser from "@/components/AiChooser";
import QueueList from "@/components/chat/QueueList";
import SendOrStopButton from "@/components/chat/SendOrStopButton";
import useMessageQueue from "@/hooks/useMessageQueue";
import useBuildMode, { BUILD_NOTE, ANSWER_NOTE, resolveIntent } from "@/hooks/useBuildMode";
import ModeToggle from "@/components/chat/ModeToggle";
import { OUT_OF_CREDITS_NOTE } from "@/lib/creditCost";
import { TIER_OF_AI } from "@/lib/creditRefresh";
import OutOfCredits from "@/components/chat/OutOfCredits";
import { useEffort, effortFor } from "@/lib/effort";
import { streamChat } from "@/lib/aiStream";
import { chatTitle } from "@/lib/chatTitle";
import { addNotification } from "@/lib/notifications";
import { followUps } from "@/lib/followUps";
import { wantsFlashcards, FLASHCARD_NOTE } from "@/lib/flashcards";
import { wantsQuiz, QUIZ_NOTE } from "@/lib/quiz";
import { shrinkImage } from "@/lib/siteImages";
import EffortPicker from "@/components/chat/EffortPicker";
import VoiceInput from "@/components/chat/VoiceInput";
import { useAppShell } from "@/components/AppShellContext";
import useStickToBottom from "@/hooks/useStickToBottom";
import { privateInfoIn } from "@/lib/privateInfo";
import { isNetworkError, OFFLINE_NOTE } from "@/lib/netError";
import useReplyAnnouncer from "@/hooks/useReplyAnnouncer";
import LiveCost from "@/components/chat/LiveCost";
import { setViewing, clearOut } from "@/lib/aiActivity";
import { waitText, nextRefresh } from "@/lib/creditRefresh";

// "Continue this answer when my credits come back": { [conversationId]: { ai, resetsAt } }.
const CONTINUE_KEY = "nx-continue-later";
const readContinue = () => {
  try {
    return JSON.parse(localStorage.getItem(CONTINUE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const writeContinue = (v) => {
  try {
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(v));
  } catch {
    // Private mode: the box just won't remember.
  }
};


const CODE_SYS = "You are Nebulux Code Assistant. Help with programming. Give clear, correct code with brief explanations.";
const FABLE_SYS = "You are Space, Nebulux AI's premium creative model. Be imaginative and high-quality.";
const AI_NAMES = { ai: "Nebulux AI", code: "Nebulux Code", opus5: "Galaxy", fable: "Space" };
const MODELS = { ai: "automatic", code: "claude_sonnet_4_6", opus5: "claude_opus_4_8", fable: "claude-sonnet-5" };
// Shown in an empty chat so new people see what they can make right away.
// Sent when an answer stopped at the length limit (the server marks it "more").
const KEEP_GOING = "Keep going from exactly where you stopped.";


// claude: the full-page home screen look (like Claude's): a big greeting with the message box in the
// middle when the chat is empty, replies as plain text, and the message box at the bottom after that.
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function ChatBox({ conversation, createConversation, addMessage, removeMessage, renameConversation, plan, exhausted, remaining, spend, userInitial, claude = false }) {
  // ?ask=... (from the Ideas page or a guide): the question starts typed in the box, not sent,
  // so nothing is charged until the person presses send. Taken out of the address after.
  const [input, setInput] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get("ask") || "").slice(0, 500);
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("ask")) return;
    url.searchParams.delete("ask");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedAi, setSelectedAi] = useState("ai");
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  // Pasted screenshots and dropped pictures are attached like the + button's (up to 10 files).
  const attach = (list) => {
    const fs = Array.from(list || []).filter((f) => f && f.size > 0);
    if (fs.length) setFiles((prev) => [...prev, ...fs].slice(0, 10));
    return fs.length > 0;
  };
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const buildMode = useBuildMode(selectedAi);
  const [effort, setEffort] = useEffort();
  const [live, setLive] = useState("");
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);
  // Talk-back: a question asked with the mic gets its answer read out loud.
  const spokenRef = useRef(false);
  const talkBackRef = useRef(false);
  const convIdRef = useRef(null);
  const shell = useAppShell();

  const messages = conversation?.messages || [];
  const isExhausted = !!exhausted?.[selectedAi];
  // Out of credits in this chat: when they come back, and whether to carry on by itself then.
  const [outAt, setOutAt] = useState(null);
  const [later, setLater] = useState(readContinue);

  // This chat is on screen: a finished answer here isn't "unread".
  useEffect(() => {
    setViewing(conversation?.id ? `chat:${conversation.id}` : null);
    setOutAt(null);
    return () => setViewing(null);
  }, [conversation?.id]);

  // `before`: how many of the chat's messages come before this question (Try again leaves out
  // the answer it replaces); by default all of them.
  const runPrompt = async (text, ai, before = messages.length) => {
    const history = (ai === "ai" ? studyBlock(studyModeOn()) : "") + aboutMeBlock(readAboutMe(shell?.currentUser?.id)) + historyBlock(messages.slice(0, before));
    let convId = conversation?.id || convIdRef.current;
    const isFirst = !convId || messages.length === 0;
    if (!convId) convId = createConversation();
    convIdRef.current = convId;

    addMessage(convId, { role: "user", content: text + (files.length ? ` (attached: ${files.map((f) => f.name).join(", ")})` : "") });
    setInput("");
    setLoading(true);
    setLive("");
    const myId = ++reqIdRef.current;
    // Attached images are processed after the busy state is set, so a quick second
    // tap on Send is queued instead of starting a parallel request.
    // Up to 3 attached images go to the AI itself (shrunk first); other files by name.
    const imageFiles = files.filter((f) => /^image\//.test(f.type)).slice(0, 3);
    const otherFiles = files.filter((f) => !imageFiles.includes(f));
    const images = [];
    for (const f of imageFiles) {
      try {
        const dataUrl = await shrinkImage(f, 1280);
        const [, mimeType, data] = dataUrl.match(/^data:([^;]+);base64,(.*)$/) || [];
        if (data) images.push({ mimeType, data });
        else otherFiles.push(f);
      } catch {
        otherFiles.push(f);
      }
    }
    setFiles([]);
    const fileNote = otherFiles.length ? `\n[Attached files (names only): ${otherFiles.map((f) => f.name).join(", ")}]` : "";
    const sys = ai === "code" ? CODE_SYS : ai === "fable" ? FABLE_SYS : "";
    const intent = ai !== "ai" ? resolveIntent(text, buildMode.mode) : { build: true };
    const modeNote = ai !== "ai" ? (intent.build ? BUILD_NOTE : ANSWER_NOTE) + "\n\n" : "";
    const cardNote = ai !== "ai" ? "" : wantsFlashcards(text) ? FLASHCARD_NOTE : wantsQuiz(text) ? QUIZ_NOTE : "";
    const fullPrompt = `${sys ? sys + "\n\n" : ""}${modeNote}${cardNote}${history}${text}${fileNote}`;
    if (reqIdRef.current !== myId) return;
    try {
      const eff = effortFor(effort, text, { build: ai !== "ai" && intent.build });
      // Streamed so the reply appears as it's written.
      // Aborted by Stop, which also ends the reply on the server (see aiStream.js).
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      clearOut(`chat:${convId}`);
      const res = await streamChat({ prompt: fullPrompt, question: text, model: MODELS[ai] || "automatic", effort: eff, ...(images.length ? { images } : {}) }, (soFar) => {
        if (reqIdRef.current === myId) setLive(soFar);
      }, { signal: abort.signal, activity: { key: `chat:${convId}`, where: "chat", label: conversation?.title || chatTitle(text), question: text, ai: AI_NAMES[ai] } });
      if (reqIdRef.current !== myId) return;
      setLive("");
      if (res.cut) setOutAt(new Date(nextRefresh()).toISOString());
      // The server charged the credits (cutting the reply off if they ran out); show its new status.
      spend?.[ai]?.(res.credits);
      const content = res.content ?? "";
      addMessage(convId, { role: "ai", content: res.cut ? `${content.trimEnd()}…\n\n${OUT_OF_CREDITS_NOTE}` : content, ...(res.more ? { more: true } : {}) });
      if (talkBackRef.current) speakText(content);
      // Away on another tab: ring the bell and play the chime.
      if (typeof document !== "undefined" && document.hidden) addNotification({ kind: "ai", text: `Nebulux AI finished: ${text.slice(0, 60)}`, link: "/chat" });
      talkBackRef.current = false;
      if (isFirst) renameConversation(convId, chatTitle(text));
    } catch (e) {
      talkBackRef.current = false;
      if (reqIdRef.current !== myId) return;
      setLive("");
      const data = e?.response?.data;
      if (data?.credits) spend?.[ai]?.(data.credits);
      if (data?.outOfCredits) setOutAt(new Date(nextRefresh()).toISOString());
      // Out-of-credits and "AI is busy" come back with a message worth showing as-is.
      addMessage(convId, { role: "ai", content: data?.error ? `⚠ ${data.error}` : isNetworkError(e) ? `⚠ ${OFFLINE_NOTE}` : "⚠ Sorry, something went wrong. Please try again." });
    } finally {
      if (reqIdRef.current === myId) {
        setLoading(false);
        q.runNext();
      }
    }
  };

  const q = useMessageQueue({ run: runPrompt, remaining, names: AI_NAMES, selectedAi, onChangeAi: setSelectedAi });

  // Carry on by itself once the credits are back, if the box was ticked (checked every 20 seconds
  // while this chat is open).
  const pending = conversation?.id ? later[conversation.id] : null;
  useEffect(() => {
    if (!pending || loading) return undefined;
    const go = () => {
      if (Date.parse(pending.resetsAt || 0) > Date.now()) return;
      const next = { ...readContinue() };
      delete next[conversation.id];
      writeContinue(next);
      setLater(next);
      setOutAt(null);
      runPrompt(KEEP_GOING, pending.ai || selectedAi);
    };
    go();
    const t = setInterval(go, 20000);
    return () => clearInterval(t);
  }, [pending?.resetsAt, loading, conversation?.id]);
  const toggleLater = (on) => {
    const next = { ...readContinue() };
    if (on) next[conversation.id] = { ai: selectedAi, resetsAt: outAt };
    else delete next[conversation.id];
    writeContinue(next);
    setLater(next);
  };


  const sentCount = messages.filter((m) => m.role === "user").length;
  useStickToBottom(scrollRef, [messages, loading, live, q.queue.length], `${conversation?.id}:${sentCount}`);

  useEffect(() => {
    convIdRef.current = conversation?.id || null;
  }, [conversation?.id]);

  const stop = () => {
    reqIdRef.current++;
    abortRef.current?.abort();
    // The server settles the charge for what was written once it notices; re-read credits then.
    setTimeout(() => spend?.[selectedAi]?.(), 2500);
    setLoading(false);
    const convId = conversation?.id;
    // Keep what was already written (it's charged); with nothing written, drop the question.
    if (convId && live.trim()) {
      addMessage(convId, { role: "ai", content: `${live.trimEnd()}\n\n_(stopped)_` });
      setLive("");
    } else if (convId && messages.length && messages[messages.length - 1].role === "user") {
      removeMessage?.(convId, messages.length - 1);
    }
    setInput("");
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    // A card number, secret key, password, phone number or home address: check first (the text
    // stays in the box if not).
    const risky = privateInfoIn(text);
    if (risky && !await askConfirm(`This looks like it has ${risky} in it. It's safer not to share that with the AI (or anyone online). Send it anyway?`)) return;
    if (q.shouldQueue(loading)) {
      q.push(text);
      setInput("");
      if (!loading) q.runNext();
      return;
    }
    if (isExhausted) return;
    talkBackRef.current = spokenRef.current;
    spokenRef.current = false;
    if (talkBackRef.current) unlockSpeech();
    runPrompt(text, selectedAi);
  };

  // Ask the last question again: drops the last reply (and the question, which
  // runPrompt adds back) and sends it with the currently selected AI. Attachments
  // aren't kept in the chat, so they aren't resent.
  const retryLast = () => {
    const convId = conversation?.id;
    const n = messages.length;
    if (!convId || loading || n < 2 || messages[n - 1].role !== "ai" || messages[n - 2].role !== "user") return;
    if (isExhausted) return;
    const question = messages[n - 2].content.replace(/ \(attached: [^)]*\)$/, "");
    removeMessage?.(convId, n - 1);
    removeMessage?.(convId, n - 2);
    runPrompt(question, selectedAi, n - 2);
  };

  // Edit your last question: it goes back into the box (with its answer removed) to fix and
  // send again. Nothing is charged until it's sent.
  const editLast = () => {
    const convId = conversation?.id;
    const n = messages.length;
    if (!convId || loading) return;
    const at = messages[n - 1]?.role === "user" ? n - 1 : messages[n - 2]?.role === "user" ? n - 2 : -1;
    if (at < 0) return;
    const question = messages[at].content.replace(/ \(attached: [^)]*\)$/, "");
    for (let k = n - 1; k >= at; k--) removeMessage?.(convId, k);
    setInput(question);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(question.length, question.length);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Keyboard shortcuts: Esc stops the answer being written, "/" jumps to the message box,
  // Ctrl+Shift+O (Cmd+Shift+O on a Mac) starts a new chat.
  const stopRef = useRef(stop);
  stopRef.current = loading ? stop : null;
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      if (document.querySelector('[aria-modal="true"]')) return; // a dialog handles its own keys
      if (e.key === "Escape" && stopRef.current) {
        e.preventDefault();
        stopRef.current();
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        shell?.newChat?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shell]);

  const queued = loading || q.paused;
  const canSend = input.trim().length > 0 && (queued || !isExhausted);

  const announce = useReplyAnnouncer(messages, loading, conversation?.id);

  const empty = claude && messages.length === 0 && !loading;
  const firstName = String(shell?.currentUser?.full_name || "").trim().split(/\s+/)[0];
  return (
    <div className={claude ? "w-full h-full flex flex-col" : "w-full max-w-3xl px-3 sm:px-4"}>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* No backdrop blur, smooth scrolling or scroll trapping here: on phones (iPhones especially)
          they got in the way of scrolling the messages. At either end, a swipe scrolls the page. */}
      <div
        className={
          claude
            ? `relative flex-1 min-h-0 flex flex-col ${empty ? "justify-center" : ""} ${dragging ? "ring-2 ring-[var(--cl-accent)]/60" : ""}`
            : `relative bg-slate-900/80 border rounded-3xl overflow-hidden shadow-2xl ${dragging ? "border-indigo-400" : "border-slate-700/50"}`
        }
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setDragging(false);
          attach(e.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-indigo-200">
            <ImagePlus className="w-8 h-8" />
            <p className="text-sm font-medium">Drop pictures to ask about them</p>
          </div>
        )}
        <div
          ref={scrollRef}
          className={
            claude
              ? empty
                ? "flex-none px-4 pb-6"
                : "flex-1 min-h-0 overflow-y-auto overscroll-y-auto pt-14 pb-6 space-y-6 px-[max(1rem,calc((100%_-_48rem)/2))]"
              : "h-[55vh] sm:h-96 overflow-y-auto overscroll-y-auto p-4 sm:p-6 space-y-4"
          }
        >
          {empty && (
            <div className="flex items-center justify-center gap-3 text-center">
              <BlackholeIcon className="keep-color w-9 h-9 sm:w-10 sm:h-10" />
              <h1 className="font-serif text-[30px] sm:text-[40px] leading-tight text-[var(--cl-text)] tracking-tight">
                {greeting()}{firstName ? `, ${firstName}` : ""}
              </h1>
            </div>
          )}
          {!claude && messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="keep-color w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center mb-3">
                <BlackholeIcon className="w-full h-full" />
              </div>
              <p className="text-slate-300 font-medium">Ask me anything</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  claude
                    ? m.role === "user"
                      ? "max-w-[80%] min-w-0 px-4 py-2.5 rounded-2xl whitespace-pre-wrap bg-[var(--cl-hover)] text-[var(--cl-text)] text-[15px] leading-relaxed"
                      : "w-full min-w-0 text-[var(--cl-text)] text-[15.5px] leading-[1.7] font-serif"
                    : `max-w-[80%] min-w-0 px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        m.role === "user"
                          ? "whitespace-pre-wrap bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm"
                          : "bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/50"
                      }`
                }
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <>
                    <Markdown text={m.content} />
                    {i === messages.length - 1 && !loading && !isExhausted && m.content.startsWith("⚠") && (
                      <button
                        type="button"
                        onClick={retryLast}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-[#fff]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Try again
                      </button>
                    )}
                    <div className="flex flex-wrap justify-end gap-1 mt-1 -mb-1">
                      {i === messages.length - 1 && !loading && !isExhausted && (
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
                      <ReadAloud text={m.content} />
                      <CopyButton getText={() => m.content} label="Copy reply" className="p-1 rounded-md text-slate-500 hover:text-slate-200" />
                      <ReportReply question={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""} reply={m.content} />
                    </div>
                    {i === messages.length - 1 && !loading && !isExhausted && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(m.more ? [KEEP_GOING] : followUps(messages[i - 1]?.role === "user" ? messages[i - 1].content : "", m.content)).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => runPrompt(f, selectedAi)}
                            className="px-2.5 py-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 text-[12px] text-indigo-200 hover:bg-indigo-500/20 transition-colors"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {m.role === "user" && !loading && (i === messages.length - 1 || i === messages.length - 2) && (
                <button
                  type="button"
                  onClick={editLast}
                  title="Edit this message"
                  aria-label="Edit this message"
                  className="order-first self-center p-1 rounded-md text-slate-500 hover:text-slate-200"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {m.role === "user" && !claude && (
                <div className="keep-color w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {userInitial || "U"}
                </div>
              )}
            </div>
          ))}

          {loading && live && (
            <div className="flex justify-start">
              <div className="max-w-[80%] min-w-0 px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-slate-800 text-slate-100 border border-slate-700/50">
                <Markdown text={live} />
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-indigo-400 animate-pulse" />
                <LiveCost activityKey={conversation?.id ? `chat:${conversation.id}` : null} className="mt-1" />
              </div>
            </div>
          )}

          {loading && !live && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2.5">
                <BlackholeIcon className="w-5 h-5 animate-spin" />
                <span className="text-slate-300 text-sm animate-pulse">
                  Thinking...{q.queue.length > 0 ? ` (${q.queue.length} queued)` : ""}
                </span>
                <LiveCost activityKey={conversation?.id ? `chat:${conversation.id}` : null} />
              </div>
            </div>
          )}

          {outAt && !loading && conversation?.id && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <p className="font-semibold">⚠ You ran out of credits.</p>
              <p className="mt-1 text-red-100/90">
                They come back at {new Date(outAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} (in {waitText(Date.parse(outAt) - Date.now())}).
              </p>
              <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={!!pending} onChange={(e) => toggleLater(e.target.checked)} />
                Continue this answer by itself when my credits come back (while this chat is open)
              </label>
              {Object.keys(AI_NAMES).some((k) => k !== selectedAi && (remaining?.[k] ?? 0) > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-red-100/80">Or carry on now with:</span>
                  {Object.keys(AI_NAMES)
                    .filter((k) => k !== selectedAi && (remaining?.[k] ?? 0) > 0)
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setSelectedAi(k);
                          setOutAt(null);
                          runPrompt(KEEP_GOING, k);
                        }}
                        className="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-[12px] font-semibold text-[#fff]"
                      >
                        {AI_NAMES[k]}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={claude ? "w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3" : "border-t border-slate-700/50 p-3"}>
          <QueueList q={q} loading={loading} />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <AttachedFile key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => setFiles((fs) => fs.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          {isExhausted && !loading && <OutOfCredits tier={TIER_OF_AI[selectedAi]} />}
          <div className={claude ? "claude-composer bg-[var(--cl-card)] border border-[var(--cl-border)] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,.25)] focus-within:border-[var(--cl-focus)] transition-colors" : ""}>
          <div className={claude ? "flex items-end gap-2" : "flex items-end gap-2 bg-slate-800/70 rounded-2xl border border-slate-700/50 focus-within:border-indigo-500/50 transition-colors"}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (!e.target.value.trim()) spokenRef.current = false;
              }}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                // A copied screenshot or picture: attach it (text pastes as usual).
                const pics = Array.from(e.clipboardData?.files || []);
                if (pics.length && attach(pics) && !e.clipboardData.getData("text")) e.preventDefault();
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={queued ? "Type to queue your next message…" : claude ? "How can I help you today?" : "Message Nebulux AI..."}
              rows={claude && empty ? 2 : 1}
              className={claude ? "flex-1 bg-transparent resize-none outline-none text-[var(--cl-text)] placeholder:text-[var(--cl-faint)] px-4 pt-3.5 pb-1 max-h-60 text-[15px]" : "flex-1 bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 max-h-32 text-sm"}
            />
            <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} {...(claude ? { gradient: "from-[var(--cl-accent)] to-[var(--cl-accent2)]" } : {})} />
          </div>
          <div className={claude ? "flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1" : "flex flex-wrap items-center gap-x-2 gap-y-1 mt-2"}>
            {/* Like Claude's: files, microphone, AI, strength, then credits and context on the right. */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach pictures or files (or paste or drop them here)"
              aria-label="Attach files"
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <VoiceInput
              onText={(t) => {
                spokenRef.current = true;
                setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t));
              }}
            />
            <AiChooser value={selectedAi} onChange={setSelectedAi} plan={plan} allowFable={true} />
            <EffortPicker value={effort} onChange={setEffort} />
            <AboutMeButton userId={shell?.currentUser?.id} />
            {selectedAi === "ai" && <StudyModeButton />}
            {buildMode.visible && <ModeToggle mode={buildMode.mode} onChange={buildMode.setMode} />}
          </div>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (attach(e.target.files)) {
                setInput((cur) => cur.trim() || "Help me with this question. Explain it step by step so I understand it.");
                inputRef.current?.focus();
              }
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              attach(e.target.files);
              e.target.value = "";
            }}
          />
          <p className={claude ? `text-center text-[11.5px] text-[var(--cl-faint)] mt-2 ${empty ? "hidden" : ""}` : "text-center text-xs text-slate-600 mt-2"}>Nebulux AI can make mistakes. Check important info, and never share passwords or card numbers with it.</p>
        </div>
      </div>
    </div>
  );
}