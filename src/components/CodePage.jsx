import React, { useState, useRef, useEffect } from "react";
import { askConfirm, askText, showNotice } from "@/lib/dialogs";
import Markdown, { CopyButton } from "@/components/chat/Markdown";
import ReportReply from "@/components/chat/ReportReply";
import { RotateCcw, Globe, Github, X, Search, ArrowLeft, ExternalLink, Loader2, FileCode, Upload, LogOut, Code, Maximize2, Minimize2 } from "lucide-react";
import { OUT_OF_CREDITS_NOTE } from "@/lib/creditCost";
import OutOfCredits from "@/components/chat/OutOfCredits";
import { useEffort, effortFor } from "@/lib/effort";
import { streamChat } from "@/lib/aiStream";
import EffortPicker from "@/components/chat/EffortPicker";
import BlackholeIcon from "@/components/BlackholeIcon";
import QueueList from "@/components/chat/QueueList";
import SendOrStopButton from "@/components/chat/SendOrStopButton";
import useMessageQueue from "@/hooks/useMessageQueue";
import useBuildMode, { BUILD_NOTE, DISCUSS_NOTE, resolveIntent } from "@/hooks/useBuildMode";
import useStickToBottom from "@/hooks/useStickToBottom";
import { isNetworkError, OFFLINE_NOTE } from "@/lib/netError";
import { secretKeyIn } from "@/lib/privateInfo";
import { historyBlock } from "@/lib/chatHistory";
import { followUps } from "@/lib/followUps";
import { readAboutMe, aboutMeBlock } from "@/lib/aboutMe";
import AboutMeButton from "@/components/chat/AboutMeButton";
import VoiceInput from "@/components/chat/VoiceInput";
import AiChooser from "@/components/AiChooser";
import { useAppShell } from "@/components/AppShellContext";
import useReplyAnnouncer from "@/hooks/useReplyAnnouncer";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Cloud, Monitor, ChevronDown, Check } from "lucide-react";
import CodeStats, { recordSession, recordMessage } from "@/components/code/CodeStats";
import { GitBranch, FolderGit2 } from "lucide-react";
import NebuluxBrowser from "@/components/code/NebuluxBrowser";
import { savedToken, forgetToken, savedRepo, rememberRepo, connect, listRepos, listFiles, readFile, pushFile } from "@/lib/githubClient";

// Nebulux Code, laid out like the Claude-style chat. Two side panels:
// - Browser: search the web and open pages (functions/.../web-browse.js). While it's open, each
//   question is looked up first and the AI gets the results (or the page you opened) to work from.
// - GitHub (only here, not in the designers): connect your account with a token, pick a repo, add
//   files to the chat, and save the AI's code back to the repo.
const MODELS = { ai: "automatic", code: "claude_sonnet_4_6", opus5: "claude_opus_4_8", fable: "claude-sonnet-5" };
const AI_NAMES = { ai: "AI", code: "Nebulux Code", opus5: "Galaxy", fable: "Space" };
// A full web page in a reply (an html code block), to run in the Nebulux Browser.
const htmlOf = (text) => {
  const m = String(text || "").match(/```html?\s*\n([\s\S]*?)```/i);
  return m && /<(html|body|canvas|div|script)\b/i.test(m[1]) ? m[1] : "";
};
const PREVIEW_NOTE = "Websites, games and apps you write as one HTML file open and run in the Nebulux Browser next to this chat automatically, so never tell the person to copy the code into a file or explain how to open it in a browser.";
const lastCodeBlock = (text) => {
  const all = [...String(text || "").matchAll(/```[^\n]*\n([\s\S]*?)```/g)];
  return all.length ? all[all.length - 1][1] : "";
};

// The AI can ask the person something with a box of choices (like Claude does):
//   ```ask
//   {"question": "...", "options": ["...", "..."]}
//   ```
const ASK_NOTE = 'When you need the person to decide something before going on, ask with ONE block exactly like this at the end of your reply, with 2 to 4 short options (they can also type their own answer):\n```ask\n{"question": "Which style do you want?", "options": ["Dark and neon", "Clean and white"]}\n```';
const askOf = (text) => {
  const m = String(text || "").match(/```ask\s*\n([\s\S]*?)```/i);
  if (!m) return null;
  try {
    const a = JSON.parse(m[1]);
    const options = (Array.isArray(a.options) ? a.options : []).map(String).filter(Boolean).slice(0, 6);
    return a.question ? { question: String(a.question), options, rest: text.replace(m[0], "").trim() } : null;
  } catch {
    return null;
  }
};

function AskBox({ ask, onAnswer, disabled }) {
  const [other, setOther] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] p-3 font-sans">
      <p className="text-[14px] font-medium text-[var(--cl-text)] mb-2">{ask.question}</p>
      <div className="space-y-1.5">
        {ask.options.map((o, i) => (
          <button key={i} disabled={disabled} onClick={() => onAnswer(o)} className="w-full text-left flex items-center gap-2 rounded-lg border border-[var(--cl-border)] px-3 py-2 text-[13.5px] text-[var(--cl-text)] hover:bg-[var(--cl-hover)] disabled:opacity-50">
            <span className="w-5 h-5 rounded-md bg-[var(--cl-hover)] text-[11px] flex items-center justify-center text-[var(--cl-muted)]">{i + 1}</span>
            {o}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (other.trim()) onAnswer(other.trim()); }} className="flex gap-1.5">
          <input value={other} onChange={(e) => setOther(e.target.value)} disabled={disabled} placeholder="Other…" className="flex-1 rounded-lg border border-[var(--cl-border)] bg-transparent px-3 py-2 text-[13.5px] outline-none text-[var(--cl-text)] focus:border-[var(--cl-focus)]" />
          <button disabled={disabled || !other.trim()} className="rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] px-3 text-[13px] font-medium disabled:opacity-40">Send</button>
        </form>
      </div>
    </div>
  );
}

// Cloud sessions run on the server (nebulux-cloud-jobs), so a reply still finishes if this device
// goes offline or the tab closes; it is picked up when the page is back.
const PENDING_KEY = "nx-code-pending";
const callJob = async (payload) => {
  const token = localStorage.getItem("base44_access_token") || appParams.token;
  const res = await fetch(`/api/apps/${appParams.appId}/functions/cloud-job`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-App-Id": String(appParams.appId), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.status) throw Object.assign(new Error(data.error || "Cloud session failed"), { response: { status: res.status, data } });
  return data;
};
const waitForJob = async (id, signal) => {
  for (;;) {
    if (signal?.aborted) throw Object.assign(new Error("stopped"), { name: "AbortError" });
    try {
      const j = await callJob({ action: "get", id });
      if (j.status === "done" || j.status === "error" || j.status === "missing") return j;
    } catch {
      // Offline or a blip: the job keeps running on the server, so just try again.
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
};

function PanelButton({ icon: Icon, label, on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] border transition-colors ${
        on ? "bg-[var(--cl-card)] border-[var(--cl-border)] text-[var(--cl-text)]" : "border-transparent text-[var(--cl-muted)] hover:bg-[var(--cl-card)]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export default function CodePage({ userInitial }) {
  const shell = useAppShell();
  const credits = shell?.credits || {};
  const userId = shell?.currentUser?.id;
  const plan = shell?.effPlan;
  const u = shell?.currentUser;
  const firstName = String(u?.full_name || u?.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  const buildMode = useBuildMode("code");
  const [effort, setEffort] = useEffort();
  const [ai, setAi] = useState("code");
  const remaining = { ai: credits.aiRemaining, code: credits.aiCodeRemaining, opus5: credits.galaxy5Remaining, fable: credits.space5Remaining };
  const exhausted = { ai: credits.aiExhausted, code: credits.aiCodeExhausted, opus5: credits.galaxy5Exhausted, fable: credits.space5Exhausted }[ai];
  const spend = (c) => credits.sync?.(c) ?? credits.spendAICode?.(c);
  const [live, setLive] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [panel, setPanel] = useState(""); // "", "browser", "github"
  // Both kinds can open the Nebulux Browser. Cloud: the chat is kept with your account. Local: the
  // session stays in this browser only.
  const [session, setSession] = useState(() => { try { return localStorage.getItem("nx-code-session") || "cloud"; } catch { return "cloud"; } });
  const [sessionMenu, setSessionMenu] = useState(false);
  const pickSession = async (v) => {
    setSessionMenu(false);
    if (v === "cloud" && session !== "cloud" && !(await askConfirm("Switch to a cloud session?\n\nIt runs on Nebulux's servers, so it keeps working even if you close this tab or go offline. It can open the Nebulux Browser and look things up on the web for you.\n\nThe cloud browser is separate from yours: it is NOT signed in to your accounts, so it can't use sites you're logged into."))) return;
    setSession(v);
    try { localStorage.setItem("nx-code-session", v); } catch { /* fine */ }
  };
  const scrollRef = useRef(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);

  // ---- browser ----
  const browserRef = useRef(null);
  const pendingPreview = useRef(null);
  const openPreview = (html, title) => {
    setPanel("browser");
    if (browserRef.current) browserRef.current.preview(html, title);
    else pendingPreview.current = [html, title];
  };
  useEffect(() => {
    if (panel === "browser" && browserRef.current && pendingPreview.current) {
      browserRef.current.preview(...pendingPreview.current);
      pendingPreview.current = null;
    }
  });
  const [wide, setWide] = useState(false);
  const [browsing, setBrowsing] = useState(false);

  // ---- github ----
  const [ghToken, setGhToken] = useState(savedToken);
  const [ghUser, setGhUser] = useState("");
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState(() => savedRepo("code"));
  const [files, setFiles] = useState([]);
  const [fileFilter, setFileFilter] = useState("");
  const [attached, setAttached] = useState([]); // [{ path, text }]
  const [ghBusy, setGhBusy] = useState("");
  const [ghErr, setGhErr] = useState("");
  useEffect(() => {
    if ((panel !== "github" && messages.length) || !ghToken || repos.length) return;
    setGhBusy("repos");
    listRepos(ghToken)
      .then(setRepos)
      .catch((e) => setGhErr(e.message))
      .finally(() => setGhBusy(""));
  }, [panel, ghToken]);
  useEffect(() => {
    if (panel !== "github" || !ghToken || !repo) return;
    const r = repos.find((x) => x.full_name === repo);
    setGhBusy("files");
    listFiles(ghToken, repo, r?.branch)
      .then(setFiles)
      .catch((e) => setGhErr(e.message))
      .finally(() => setGhBusy(""));
  }, [panel, ghToken, repo, repos]);
  // Sign in with GitHub in a small window; /github/callback hands the token back here.
  const ghConnect = () => {
    setGhErr("");
    setGhBusy("connect");
    const w = window.open("/github/login", "nx-github", "width=620,height=760");
    if (!w) window.location.href = "/github/login";
  };
  useEffect(() => {
    const got = (t) => {
      if (!t) return;
      setGhBusy("");
      setGhToken(t);
      connect(t).then(setGhUser).catch((e) => setGhErr(e.message));
    };
    const onMsg = (e) => e.origin === window.location.origin && e.data?.type === "nx-github" && got(e.data.token);
    const onStore = (e) => e.key === "bh-github-token" && got(e.newValue);
    window.addEventListener("message", onMsg);
    window.addEventListener("storage", onStore);
    return () => { window.removeEventListener("message", onMsg); window.removeEventListener("storage", onStore); };
  }, []);
  const toggleFile = async (path) => {
    if (attached.some((f) => f.path === path)) return setAttached((a) => a.filter((f) => f.path !== path));
    if (attached.length >= 6) return showNotice("You can add up to 6 files at a time.");
    setGhBusy(path);
    try {
      const text = await readFile(ghToken, repo, path);
      setAttached((a) => [...a, { path, text: text.slice(0, 30000) }]);
    } catch (e) {
      setGhErr(e.message);
    } finally {
      setGhBusy("");
    }
  };
  const saveToRepo = async (code) => {
    if (!ghToken || !repo) {
      setPanel("github");
      return showNotice("Connect GitHub and pick a repository first.");
    }
    const path = await askText(`Save this code to which file in ${repo}?`, { defaultValue: attached[0]?.path || "index.html", placeholder: "src/app.js" });
    if (!path) return;
    // Nothing goes to GitHub without a yes: show it running first, then ask.
    const html = htmlOf(code) || (/<(html|body|canvas)\b/i.test(code) ? code : "");
    if (html) openPreview(html, `Preview: ${path}`);
    if (!(await askConfirm(`${html ? "This is running in the Nebulux Browser now. " : ""}Push it to ${repo}/${path}?`))) return;
    try {
      const url = await pushFile(ghToken, repo, code, `Update ${path} from Nebulux Code`, path.replace(/^\/+/, ""));
      showNotice(`Saved to ${repo}/${path}.\n${url}`);
    } catch (e) {
      showNotice(e.message);
    }
  };

  // ---- asking ----
  const runPrompt = async (text, before = messages.length, whichAi = ai) => {
    let context = aboutMeBlock(readAboutMe(userId)) + historyBlock(messages.slice(0, before));
    if (attached.length) context += `Files from the GitHub repo ${repo}:\n\n` + attached.map((f) => `${f.path}:\n\`\`\`\n${f.text}\n\`\`\``).join("\n\n") + "\n\n";
    if (before === 0) recordSession(userId);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setLive("");
    const myId = ++reqIdRef.current;
    // The browser is open: look it up first, so the answer can use what's on the web.
    if (!browserRef.current) {
      setPanel("browser");
      await new Promise((r) => setTimeout(r, 80));
    }
    if (browserRef.current) {
      const cur = browserRef.current.current();
      if (cur?.type === "page" && cur.text) context += `The person has this web page open in the Nebulux Browser (${cur.url}):\n${cur.text.slice(0, 8000)}\n\n`;
      else {
        setBrowsing(true);
        const found = await browserRef.current.search(text.slice(0, 200)).finally(() => setBrowsing(false));
        if (found?.length) context += `Web search results from the Nebulux Browser for "${text.slice(0, 200)}":\n` + found.slice(0, 6).map((r, i) => `${i + 1}. ${r.title} (${r.url}) ${r.snippet}`).join("\n") + "\n\nUse these where they help, and give the links you used.\n\n";
      }
    }
    if (reqIdRef.current !== myId) return;
    const intent = resolveIntent(text, "discuss"); // code only when asked for
    try {
      const modeNote = (intent.build ? BUILD_NOTE : DISCUSS_NOTE) + "\n" + PREVIEW_NOTE;
      const eff = effortFor(effort, text, { build: intent.build });
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const req = { prompt: `${modeNote}\n${ASK_NOTE}\n\n${context}${text}`, question: text, model: MODELS[whichAi] || MODELS.code, effort: eff };
      let res;
      if (session === "cloud") {
        const id = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9-]/g, "");
        await callJob({ action: "start", id, body: req });
        try { localStorage.setItem(PENDING_KEY, JSON.stringify({ id, text })); } catch { /* fine */ }
        const j = await waitForJob(id, abort.signal);
        try { localStorage.removeItem(PENDING_KEY); } catch { /* fine */ }
        if (j.status !== "done") throw Object.assign(new Error(j.error || "Cloud session failed"), { response: { data: { error: j.error || "The cloud session lost this reply. Please try again.", credits: j.credits } } });
        res = j;
      } else {
        res = await streamChat(req, (soFar) => {
          if (reqIdRef.current === myId) setLive(soFar);
        }, { signal: abort.signal });
      }
      if (reqIdRef.current !== myId) return;
      setLive("");
      spend(res.credits);
      const content = res.content ?? "";
      recordMessage(userId, whichAi, text.length + content.length);
      setMessages((m) => [...m, { role: "ai", content: res.cut ? `${content.trimEnd()}…\n\n${OUT_OF_CREDITS_NOTE}` : content, ...(res.more ? { more: true } : {}) }]);
      // Built a page: run it in the Nebulux Browser right away.
      const page = htmlOf(content);
      if (page) openPreview(page, text.slice(0, 40));
    } catch (e) {
      if (reqIdRef.current !== myId) return;
      setLive("");
      const data = e?.response?.data;
      if (data?.credits) spend(data.credits);
      setMessages((m) => [...m, { role: "ai", content: data?.error ? `⚠ ${data.error}` : isNetworkError(e) ? `⚠ ${OFFLINE_NOTE}` : "⚠ Sorry, something went wrong. Please try again." }]);
    } finally {
      if (reqIdRef.current === myId) {
        setLoading(false);
        q.runNext();
      }
    }
  };

  // A cloud reply that was still running when the page closed: pick it up.
  useEffect(() => {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch { /* fine */ }
    if (!p?.id) return;
    setMessages((m) => (m.length ? m : [{ role: "user", content: p.text || "" }]));
    setLoading(true);
    waitForJob(p.id).then((j) => {
      try { localStorage.removeItem(PENDING_KEY); } catch { /* fine */ }
      if (j.credits) spend(j.credits);
      setMessages((m) => [...m, { role: "ai", content: j.status === "done" ? j.content || "" : `⚠ ${j.error || "The cloud session lost this reply. Please try again."}` }]);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = useMessageQueue({ run: (t) => runPrompt(t), remaining: { [ai]: remaining[ai] ?? (exhausted ? 0 : Infinity) }, names: AI_NAMES, selectedAi: ai });
  useStickToBottom(scrollRef, [messages, loading, live, q.queue.length], messages.filter((m) => m.role === "user").length);

  const stop = () => {
    reqIdRef.current++;
    abortRef.current?.abort();
    setTimeout(() => spend(), 2500);
    setLoading(false);
    setInput("");
    if (live.trim()) {
      setMessages((m) => [...m, { role: "ai", content: `${live.trimEnd()}\n\n_(stopped)_` }]);
      setLive("");
    }
  };

  const answer = (text) => {
    if (loading || exhausted) return;
    runPrompt(text);
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (secretKeyIn(text) && !(await askConfirm("This looks like it has a secret key (like an API key or access token) in it. Anyone who gets it can use that account, so replace it with something like YOUR_API_KEY first. Send it anyway?"))) return;
    if (q.shouldQueue(loading)) {
      q.push(text);
      setInput("");
      if (!loading) q.runNext();
      return;
    }
    if (exhausted) return;
    runPrompt(text);
  };

  const retryLast = () => {
    const n = messages.length;
    if (loading || exhausted || n < 2 || messages[n - 1].role !== "ai" || messages[n - 2].role !== "user") return;
    const question = messages[n - 2].content;
    setMessages((m) => m.slice(0, -2));
    runPrompt(question, n - 2);
  };

  const queued = loading || q.paused;
  const canSend = input.trim().length > 0 && (queued || !exhausted);
  const announce = useReplyAnnouncer(messages, loading, "code");
  const empty = messages.length === 0 && !loading;
  const shownFiles = files.filter((f) => !fileFilter || f.toLowerCase().includes(fileFilter.toLowerCase())).slice(0, 300);

  return (
    <div className="w-full h-full flex">
      <div className="flex-1 min-w-0 h-full flex flex-col relative">
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        {/* top bar: the two panels */}
        <div className="h-12 shrink-0 flex items-center justify-end gap-1 px-3 pl-14 sm:pl-3">
          <PanelButton icon={Globe} label="Browser" on={panel === "browser"} onClick={() => setPanel((p) => (p === "browser" ? "" : "browser"))} />
          <PanelButton icon={Github} label={ghToken ? (repo ? repo.split("/")[1] : "GitHub") : "Connect GitHub"} on={panel === "github"} onClick={() => setPanel((p) => (p === "github" ? "" : "github"))} />
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={scrollRef} className={empty ? "flex-1 min-h-0 overflow-y-auto px-4 pb-6" : "flex-1 min-h-0 overflow-y-auto pt-2 pb-6 space-y-6 px-[max(1rem,calc((100%_-_48rem)/2))]"}>
            {empty && (
              <div className="w-full max-w-3xl mx-auto pt-4">
                <div className="flex items-center gap-2.5 mb-8">
                  <BlackholeIcon className="w-8 h-8" />
                  <h1 className="text-[24px] sm:text-[28px] text-[var(--cl-text)] tracking-tight">What's up next, {firstName}?</h1>
                </div>
                <CodeStats userId={userId} names={AI_NAMES} />
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={m.role === "user" ? "max-w-[80%] min-w-0 px-4 py-2.5 rounded-2xl whitespace-pre-wrap bg-[var(--cl-hover)] text-[var(--cl-text)] text-[15px] leading-relaxed" : "w-full min-w-0 text-[var(--cl-text)] text-[15.5px] leading-[1.7] font-serif"}>
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <>
                      {(() => {
                        const ask = askOf(m.content);
                        if (!ask) return <Markdown text={m.content} />;
                        return (
                          <>
                            {ask.rest && <Markdown text={ask.rest} />}
                            <AskBox ask={ask} onAnswer={answer} disabled={i !== messages.length - 1 || loading} />
                          </>
                        );
                      })()}
                      {i === messages.length - 1 && !loading && !exhausted && m.content.startsWith("⚠") && (
                        <button type="button" onClick={retryLast} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--cl-text)] px-3 py-1.5 text-xs font-semibold text-[var(--cl-bg)]">
                          <RotateCcw className="w-3.5 h-3.5" /> Try again
                        </button>
                      )}
                      <div className="flex flex-wrap justify-end gap-1 mt-1 -mb-1 font-sans">
                        {htmlOf(m.content) && (
                          <button type="button" onClick={() => openPreview(htmlOf(m.content), "Preview")} title="Run it in the Nebulux Browser" className="inline-flex items-center gap-1 p-1 rounded-md text-[12px] text-[var(--cl-faint)] hover:text-[var(--cl-text)]">
                            ▶ Preview
                          </button>
                        )}
                        {lastCodeBlock(m.content) && (
                          <button type="button" onClick={() => saveToRepo(lastCodeBlock(m.content))} title="Save this code to your GitHub repo" className="inline-flex items-center gap-1 p-1 rounded-md text-[12px] text-[var(--cl-faint)] hover:text-[var(--cl-text)]">
                            <Upload className="w-3.5 h-3.5" /> Save to GitHub
                          </button>
                        )}
                        {i === messages.length - 1 && !loading && !exhausted && (
                          <button type="button" onClick={retryLast} title="Try again (uses credits)" aria-label="Try again" className="p-1 rounded-md text-[var(--cl-faint)] hover:text-[var(--cl-text)]">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <CopyButton getText={() => m.content} label="Copy reply" className="p-1 rounded-md text-[var(--cl-faint)] hover:text-[var(--cl-text)]" />
                        <ReportReply question={messages[i - 1]?.role === "user" ? messages[i - 1].content : ""} reply={m.content} />
                      </div>
                      {i === messages.length - 1 && !loading && !exhausted && (
                        <div className="flex flex-wrap gap-1.5 mt-2 font-sans">
                          {(m.more ? ["Keep going from exactly where you stopped."] : followUps(messages[i - 1]?.role === "user" ? messages[i - 1].content : "", m.content)).map((f) => (
                            <button key={f} type="button" onClick={() => runPrompt(f)} className="px-2.5 py-1 rounded-lg border border-[var(--cl-border)] text-[12.5px] text-[var(--cl-muted)] hover:bg-[var(--cl-card)]">
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && live && (
              <div className="w-full min-w-0 text-[var(--cl-text)] text-[15.5px] leading-[1.7] font-serif">
                <Markdown text={live.replace(/```ask[\s\S]*$/i, "")} />
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-[var(--cl-accent)] animate-pulse" />
              </div>
            )}
            {loading && !live && (
              <div className="flex items-center gap-2.5 text-[var(--cl-muted)]">
                <BlackholeIcon className="w-5 h-5 animate-spin" />
                <span className="text-sm animate-pulse">{browsing ? "Searching the web…" : "Thinking…"}{q.queue.length > 0 ? ` (${q.queue.length} queued)` : ""}</span>
              </div>
            )}
          </div>

          {/* message box */}
          <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 pb-3">
            <QueueList q={q} loading={loading} />
            {empty && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[14px]">
                <div className="relative">
                  <button onClick={() => setSessionMenu((o) => !o)} className="flex items-center gap-1.5 rounded-lg bg-[var(--cl-card)] px-2.5 py-1 text-[var(--cl-text)]">
                    {session === "cloud" ? <Cloud className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                    {session === "cloud" ? "Cloud" : "Local"}
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--cl-muted)]" />
                  </button>
                  {sessionMenu && (
                    <div className="absolute z-30 left-0 mt-1 w-72 rounded-xl border border-[var(--cl-border)] bg-[var(--cl-card)] shadow-xl p-1 text-left">
                      {[
                        ["local", Monitor, "Local", "Runs in this tab while it's open."],
                        ["cloud", Cloud, "Cloud", "Runs on Nebulux's servers. Keeps working if you close the tab or go offline."],
                      ].map(([v, Icon, l, d]) => (
                        <button key={v} onClick={() => pickSession(v)} className="w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[var(--cl-hover)]">
                          <Icon className="w-4 h-4 mt-0.5 text-[var(--cl-muted)]" />
                          <span className="flex-1">
                            <span className="block text-[13.5px] text-[var(--cl-text)]">{l}</span>
                            <span className="block text-[12px] text-[var(--cl-muted)]">{d}</span>
                          </span>
                          {session === v && <Check className="w-4 h-4 mt-0.5 text-[var(--cl-text)]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {ghToken ? (
                  <select value={repo} onChange={(e) => { setRepo(e.target.value); rememberRepo("code", e.target.value); setAttached([]); }} className="rounded-lg bg-[var(--cl-card)] px-2.5 py-1.5 outline-none text-[var(--cl-text)] max-w-[16rem]">
                    <option value="">{ghBusy === "repos" ? "Loading repositories…" : "No repository"}</option>
                    {repos.map((r) => (
                      <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <button onClick={ghConnect} className="flex items-center gap-1.5 rounded-lg bg-[var(--cl-card)] px-2.5 py-1 text-[var(--cl-text)]">
                    <Github className="w-4 h-4" /> Sign in with GitHub
                  </button>
                )}
                {ghToken && repo && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-[var(--cl-card)] px-2.5 py-1 text-[var(--cl-text)]">
                    <GitBranch className="w-4 h-4 text-[var(--cl-muted)]" />
                    {repos.find((r) => r.full_name === repo)?.branch || "main"}
                  </span>
                )}
              </div>
            )}
            {exhausted && !loading && <OutOfCredits tier={{ ai: "ai", code: "aiCode", opus5: "galaxy5", fable: "space5" }[ai]} />}
            {attached.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attached.map((f) => (
                  <span key={f.path} className="inline-flex items-center gap-1 rounded-lg border border-[var(--cl-border)] bg-[var(--cl-card)] px-2 py-1 text-[12.5px] text-[var(--cl-muted)]">
                    <FileCode className="w-3.5 h-3.5" />
                    {f.path}
                    <button onClick={() => setAttached((a) => a.filter((x) => x.path !== f.path))} aria-label={`Remove ${f.path}`} className="hover:text-[var(--cl-text)]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="claude-composer bg-[var(--cl-card)] border border-[var(--cl-border)] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,.25)] focus-within:border-[var(--cl-focus)] transition-colors">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={queued ? "Type to queue your next message…" : panel === "browser" ? "Ask anything: Nebulux looks it up on the web first…" : "Describe a task or ask a question"}
                  rows={empty ? 2 : 1}
                  className="flex-1 bg-transparent resize-none outline-none text-[var(--cl-text)] placeholder:text-[var(--cl-faint)] px-4 pt-3.5 pb-1 max-h-60 text-[15px]"
                />
                <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} gradient="from-[var(--cl-accent)] to-[var(--cl-accent2)]" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1">
                <VoiceInput onText={(t) => setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t))} />
                <AboutMeButton userId={userId} />
                <span className="flex-1" />
                <AiChooser value={ai} onChange={setAi} plan={plan} allowFable={true} />
                <EffortPicker value={effort} onChange={setEffort} />
              </div>
            </div>
            {!empty && <p className="text-center text-[11.5px] text-[var(--cl-faint)] mt-2">Nebulux AI can make mistakes. Check important info, and never share passwords or card numbers with it.</p>}
          </div>
        </div>
      </div>

      {/* side panel */}
      {panel && (
        <aside className={`${wide ? "fixed inset-0 z-50" : "fixed inset-0 z-40 sm:static sm:z-auto sm:w-[50%] sm:max-w-[760px]"} h-full flex flex-col bg-[var(--cl-side)] border-l border-[var(--cl-border)] text-[var(--cl-text)]`}>
          <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--cl-border)]">
            {panel === "browser" ? <Globe className="w-4 h-4 text-[var(--cl-muted)]" /> : <Github className="w-4 h-4 text-[var(--cl-muted)]" />}
            <span className="text-[14px] font-medium flex-1">{panel === "browser" ? "Nebulux Browser" : "GitHub"}</span>
            <button onClick={() => setWide((w) => !w)} className="hidden sm:block p-1.5 rounded-lg hover:bg-[var(--cl-card)] text-[var(--cl-muted)]" title={wide ? "Back to normal size" : "Full screen"} aria-label={wide ? "Back to normal size" : "Full screen"}>
              {wide ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setPanel("")} className="p-1.5 rounded-lg hover:bg-[var(--cl-card)] text-[var(--cl-muted)]" aria-label="Close panel">
              <X className="w-4 h-4" />
            </button>
          </div>

          {panel === "browser" ? (
            <NebuluxBrowser ref={browserRef} />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
              {!ghToken ? (
                <div className="space-y-2.5 text-[13.5px] text-[var(--cl-muted)]">
                  <p>Connect your GitHub account to work on your repositories here: add their files to the chat, and save the AI's code back.</p>
                  <button onClick={ghConnect} className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--cl-text)] text-[var(--cl-bg)] py-2 font-medium">
                    <Github className="w-4 h-4" /> {ghBusy === "connect" ? "Waiting for GitHub…" : "Sign in with GitHub"}
                  </button>
                  <p className="text-[12px]">You log in on GitHub and approve access to your repositories. Nothing to copy or paste.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[13px] text-[var(--cl-muted)]">
                    <Github className="w-4 h-4" />
                    <span className="flex-1">Connected{ghUser ? ` as ${ghUser}` : ""}</span>
                    <button onClick={() => { forgetToken(); setGhToken(""); setRepos([]); setFiles([]); setAttached([]); }} className="flex items-center gap-1 hover:text-[var(--cl-text)]">
                      <LogOut className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  </div>
                  <select value={repo} onChange={(e) => { setRepo(e.target.value); rememberRepo("code", e.target.value); setAttached([]); }} className="w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-2 text-[13.5px] outline-none text-[var(--cl-text)]">
                    <option value="">{ghBusy === "repos" ? "Loading repositories…" : "Pick a repository"}</option>
                    {repos.map((r) => (
                      <option key={r.full_name} value={r.full_name}>{r.full_name}{r.private ? " (private)" : ""}</option>
                    ))}
                  </select>
                  {repo && (
                    <>
                      <input value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} placeholder="Find a file" className="w-full rounded-lg bg-[var(--cl-card)] border border-[var(--cl-border)] px-3 py-1.5 text-[13px] outline-none text-[var(--cl-text)] placeholder:text-[var(--cl-faint)]" />
                      <p className="text-[11.5px] text-[var(--cl-faint)] -mt-1">Click files to add them to the chat. Code in the AI's replies can be saved back with "Save to GitHub".</p>
                      <div className="flex-1 min-h-0 overflow-y-auto -mx-1">
                        {ghBusy === "files" && <p className="flex items-center gap-2 px-1 text-[13px] text-[var(--cl-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Loading files…</p>}
                        {shownFiles.map((f) => {
                          const on = attached.some((a) => a.path === f);
                          return (
                            <button key={f} onClick={() => toggleFile(f)} className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] ${on ? "bg-[var(--cl-card)] text-[var(--cl-text)]" : "text-[var(--cl-muted)] hover:bg-[var(--cl-card)]"}`}>
                              {ghBusy === f ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{f}</span>
                              {on && <span className="ml-auto text-[11px] text-[var(--cl-accent)]">added</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
              {ghErr && <p className="text-[12.5px] text-red-400">{ghErr}</p>}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
