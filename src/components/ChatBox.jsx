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

const CODE_SYS = "You are Nebulux Code Assistant. Help with programming. Give clear, correct code with brief explanations.";
const FABLE_SYS = "You are Space, Nebulux AI's premium creative model. Be imaginative and high-quality.";
const AI_NAMES = { ai: "Nebulux AI", code: "Nebulux Code", opus5: "Galaxy", fable: "Space" };
const MODELS = { ai: "automatic", code: "claude_sonnet_4_6", opus5: "claude_opus_4_8", fable: "claude-sonnet-5" };
// Shown in an empty chat so new people see what they can make right away.
// Sent when an answer stopped at the length limit (the server marks it "more").
const KEEP_GOING = "Keep going from exactly where you stopped.";


export default function ChatBox({ conversation, createConversation, addMessage, removeMessage, renameConversation, plan, exhausted, remaining, spend, userInitial }) {
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
      const res = await streamChat({ prompt: fullPrompt, question: text, model: MODELS[ai] || "automatic", effort: eff, ...(images.length ? { images } : {}) }, (soFar) => {
        if (reqIdRef.current === myId) setLive(soFar);
      }, { signal: abort.signal });
      if (reqIdRef.current !== myId) return;
      setLive("");
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

  return (
    <div className="w-full max-w-3xl px-3 sm:px-4">
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* No backdrop blur, smooth scrolling or scroll trapping here: on phones (iPhones especially)
          they got in the way of scrolling the messages. At either end, a swipe scrolls the page. */}
      <div
        className={`relative bg-slate-900/80 border rounded-3xl overflow-hidden shadow-2xl ${dragging ? "border-indigo-400" : "border-slate-700/50"}`}
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
        <div ref={scrollRef} className="h-[55vh] sm:h-96 overflow-y-auto overscroll-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !loading && (
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
                className={`max-w-[80%] min-w-0 px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-sm"
                    : "bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700/50"
                }`}
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
              {m.role === "user" && (
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
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700/50 p-3">
          <QueueList q={q} loading={loading} />

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <AttachedFile key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => setFiles((fs) => fs.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          {isExhausted && !loading && <OutOfCredits tier={TIER_OF_AI[selectedAi]} />}
          <div className="flex items-end gap-2 bg-slate-800/70 rounded-2xl border border-slate-700/50 focus-within:border-indigo-500/50 transition-colors">
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
              placeholder={queued ? "Type to queue your next message…" : "Message Nebulux AI..."}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 max-h-32 text-sm"
            />
            <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach pictures or files (or paste or drop them here)"
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <AboutMeButton userId={shell?.currentUser?.id} />
            {selectedAi === "ai" && <StudyModeButton />}
            <VoiceInput
              onText={(t) => {
                spokenRef.current = true;
                setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t));
              }}
            />
            <AiChooser value={selectedAi} onChange={setSelectedAi} plan={plan} allowFable={true} />
            <EffortPicker value={effort} onChange={setEffort} />
            {buildMode.visible && <ModeToggle mode={buildMode.mode} onChange={buildMode.setMode} />}
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
          <p className="text-center text-xs text-slate-600 mt-2">Nebulux AI can make mistakes. Check important info, and never share passwords or card numbers with it.</p>
        </div>
      </div>
    </div>
  );
}