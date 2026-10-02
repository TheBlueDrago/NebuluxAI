import useRestartWhenShown from "@/hooks/useRestartWhenShown";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { saveBuilds, loadBuilds, trimForStorage } from "@/lib/buildHistory";
import { RotateCcw } from "lucide-react";
import { findBuiltInGame } from "@/lib/builtInGames";
import PageSize from "@/components/designer/PageSize";
import ShareLink from "@/components/designer/ShareLink";
import { isPlaceholderName } from "@/lib/siteNaming";
import QrDialog, { QrButton } from "@/components/designer/QrDialog";
import Markdown from "@/components/chat/Markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Gamepad2, RefreshCw, Plus, X, Crown, Rocket, Paperclip } from "lucide-react";
import BlackholeIcon from "@/components/BlackholeIcon";
import QueueList from "@/components/chat/QueueList";
import SendOrStopButton from "@/components/chat/SendOrStopButton";
import useMessageQueue from "@/hooks/useMessageQueue";
import useBuildMode, { DISCUSS_NOTE, resolveIntent } from "@/hooks/useBuildMode";
import ModeToggle from "@/components/chat/ModeToggle";
import { base44 } from "@/api/base44Client";
import AiChooser from "@/components/AiChooser";
import GitHubPush from "@/components/designer/GitHubPush";
import DownloadZip from "@/components/designer/DownloadZip";
import { loadImages, onImagesChange, addImageFile, expandImages, packImages } from "@/lib/siteImages";
import SheetSelect from "@/components/SheetSelect";
import ThemeToggle from "@/components/ThemeToggle";
import { useLocation } from "react-router-dom";
import { STARTER_GAME_HTML } from "@/lib/gameTemplate";
import { GAME_TLDS } from "@/lib/blackholeDomain";
import { gameLimit, inThisMonth } from "@/lib/publishLimits";
import PreviewFrame from "@/components/PreviewFrame";
import { OUT_OF_CREDITS_NOTE } from "@/lib/creditCost";
import { TIER_OF_AI } from "@/lib/creditRefresh";
import OutOfCredits from "@/components/chat/OutOfCredits";
import { useEffort, effortFor } from "@/lib/effort";
import { streamChat } from "@/lib/aiStream";
import LiveReply from "@/components/chat/LiveReply";
import EffortPicker from "@/components/chat/EffortPicker";
import VoiceInput from "@/components/chat/VoiceInput";
import { EXPLAIN_NOTE, splitBuildReply, introBeforeCode, looksCut, CONTINUE_NOTE, joinContinuation } from "@/lib/buildReply";
import { GAME_DESIGNER_STORE_KEY } from "@/lib/gameDesignerStore";
import { notifyGamesChanged } from "@/lib/gameEvents";
import { hasProFeatures, hasSpace } from "@/lib/plans";
import { useAppShell } from "@/components/AppShellContext";
import useEscape from "@/hooks/useEscape";
import useDialogFocus from "@/hooks/useDialogFocus";
import { isNetworkError, OFFLINE_NOTE } from "@/lib/netError";

const STORE_KEY = GAME_DESIGNER_STORE_KEY;
const TAKEN_KEY = "infinity-ai-taken-games";
const MODEL = "claude_sonnet_4_6";
const SPACE5_MODEL = "claude-sonnet-5";
const MODELS = { ai: "automatic", code: MODEL, opus5: "claude_opus_4_8", fable: SPACE5_MODEL };
const AI_NAMES = { ai: "Nebulux AI", code: "Nebulux Code", opus5: "Galaxy", fable: "Space" };

const RESERVED = ["home", "www", "admin", "api", "mail", "infinity", "ai", "app", "login", "register", "support", "blog", "game", "games"];

const GENRES = [
  { id: "io", label: ".io" },
  { id: "shooting", label: "Shooting" },
  { id: "horror", label: "Horror" },
  { id: "action", label: "Action" },
  { id: "arcade", label: "Arcade" },
  { id: "puzzle", label: "Puzzle" },
  { id: "racing", label: "Racing" },
  { id: "sports", label: "Sports" },
  { id: "adventure", label: "Adventure" },
  { id: "strategy", label: "Strategy" },
];

const SYSTEM = `You are Nebulux AI Games Designer. The user describes a game and you build it as a fully playable HTML5 game.
BRANDING: this platform is Nebulux AI (games live at name.nebuluxai.com). Never write "Blackhole", "Blackhole AI" or "blackhole-ai-tech.com" anywhere in a game, including comments; when editing a game that has them, change them to Nebulux AI / nebuluxai.com.
ALWAYS respond with a single complete, self-contained HTML document: include <!DOCTYPE html>, <html>, <head> with inline <style> CSS, and <body> with a <canvas> element and inline <script> implementing the entire game.
The game MUST be genuinely playable on computers (keyboard and/or mouse) AND on phones and tablets (touch): include a start screen, a scoring system, increasing difficulty, and a game-over screen with a restart button. Use a smooth requestAnimationFrame loop, a responsive canvas that fills the viewport, and clean neon visuals. No external assets, scripts, or network calls — everything must run offline inside the single document.
PHONES: many players are on phones with no keyboard. Include <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">. On touch devices (matchMedia("(pointer: coarse)") or "ontouchstart" in window) show on-screen controls for every action the keyboard does — e.g. left/right/jump/fire buttons or a virtual joystick — at least 56px, semi-transparent, in the bottom corners, never covering the HUD. Handle touchstart/touchmove/touchend (or pointer events) with preventDefault() and CSS touch-action:none so the page doesn't scroll or zoom, and support several fingers at once. Resize the canvas on resize/orientation change, keep text and buttons readable on a 360px-wide screen, and never require hovering, right-clicking or pointer lock.
Every button and menu (start, pause, restart, settings, mute) must actually work.
SAVE PROGRESS: keep the player's progress in localStorage under one key named after the game (for example JSON with level, coins, unlocks, upgrades, high score and settings), save it whenever it changes, and load it at start, so players carry on where they left off (Nebulux keeps it with their account). Wrap it in try/catch, and add a "Reset progress" option in settings.
NO BLACK SCREENS: the start screen must be visible the moment the page loads. Keep the requestAnimationFrame loop running from the start (it draws the start screen too), so a resize that clears the canvas is redrawn on the next frame. Build the start screen and buttons as HTML elements over the canvas where possible. Start the game with a click, tap or any key (never only on a key press, since phones have no keyboard). Never wait for images, fonts or sounds to load before drawing, and create audio only after the first tap. Size the canvas from window.innerWidth/innerHeight with a fallback (e.g. innerWidth||800) so it never has 0 size. Wrap risky code (saved data, audio) in try/catch so one error can't stop the whole game.
Put the complete HTML document inside ONE \`\`\`html code block, with your explanation outside it (see EXPLAIN YOUR WORK).
When the user asks for changes, output the FULL updated HTML document every time, not just the diff, and keep the phone controls working.`;

function extractHtml(text) {
  if (!text) return "";
  const f = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return f ? f[1].trim() : text.trim();
}

// `text: true` marks plain chat replies (discuss mode, errors, out-of-credits) so a reply
// that merely mentions a tag like <canvas> is never mistaken for a new version of the game.
const isHtmlMsg = (m) => m.role === "ai" && !m.text && /<[a-z!][\s\S]*>/i.test(m.content);

function genId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { gameName: p.gameName || "my-game", title: p.title || "", genre: p.genre || "io", messages: p.messages || [], projectId: p.projectId || genId() };
    }
  } catch {}
  return { gameName: "my-game", title: "", genre: "io", messages: [], projectId: genId() };
}

function getTaken() {
  try {
    return JSON.parse(localStorage.getItem(TAKEN_KEY) || "[]");
  } catch {
    return [];
  }
}

function ownerOf(n) {
  return getTaken().find((e) => e.name === n)?.projectId;
}

function isTakenFor(n, projectId) {
  if (!n || RESERVED.includes(n) || findBuiltInGame(n)) return true;
  const o = ownerOf(n);
  return !!o && o !== projectId;
}

function suggestNames(n, projectId) {
  const base = n || "my-game";
  const out = [];
  let i = 1;
  while (out.length < 3 && i < 30) {
    const c = `${base}-${i}`;
    if (!isTakenFor(c, projectId)) out.push(c);
    i++;
  }
  return out;
}

// Tap-to-fill ideas for an empty game chat.
// One-tap improvements shown under the latest version of the game.
const GAME_TWEAKS = ["Make it harder", "Add sound effects", "Add a high score", "Make it work great on phones", "Add a new level"];

const GAME_IDEAS = [
  "A space shooter with power-ups",
  "A platformer where a cat collects fish",
  "A maze escape against the clock",
  "A two-player air hockey game",
];

function sanitize(s) {
  // Letters, hyphens and dots (so a name like "shooter.io" is allowed); no leading/trailing separators.
  return s.toLowerCase().replace(/[^a-z.-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^[-.]+|[-.]+$/g, "");
}

export default function GamesDesigner({ onToggleSidebar, onOpenProfile, onUpgrade, aiExhausted, onSpendAI, aiCodeExhausted, onSpendAICode, galaxy5Exhausted, onSpendGalaxy5, space5Exhausted, onSpendSpace5, remaining, plan, lightMode, onToggleLight }) {
  const shell = useAppShell();
  const location = useLocation();
  const startFresh = !!location.state?.fresh;
  // "Remix" on a built-in game starts a new project from a copy of it.
  const remix = startFresh && location.state?.remix ? findBuiltInGame(location.state.remix) : null;
  const initial = remix
    ? { gameName: `my-${remix.name}`, title: `${remix.title || remix.name} remix`, genre: remix.genre || "io", messages: [{ role: "ai", content: remix.html }], projectId: genId() }
    : startFresh
    ? { gameName: "my-game", title: "", genre: "io", messages: [{ role: "ai", content: STARTER_GAME_HTML }], projectId: genId() }
    : loadState();
  const projectId = initial.projectId;
  const [gameName, setGameName] = useState(initial.gameName);
  const [title, setTitle] = useState(initial.title);
  const [genre, setGenre] = useState(initial.genre);
  const [messages, setMessages] = useState(initial.messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [previewMode, setPreviewMode] = useState("preview");
  const [reloadKey, setReloadKey] = useState(0);
  const [showPublish, setShowPublish] = useState(false);
  useEscape(showPublish, () => setShowPublish(false));
  const dialogRef = useDialogFocus(showPublish);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState("");
  const [publishUrl, setPublishUrl] = useState("");
  const [nameTaken, setNameTaken] = useState(false);
  const [isRepublish, setIsRepublish] = useState(false);
  const [files, setFiles] = useState([]);
  const [focused, setFocused] = useState(false);
  const opusAllowed = hasProFeatures(plan);
  const fableAllowed = hasSpace(plan);
  const [selectedAi, setSelectedAi] = useState(fableAllowed ? "fable" : opusAllowed ? "opus5" : "ai");
  const buildMode = useBuildMode(selectedAi);
  const [effort, setEffort] = useEffort();
  const [live, setLive] = useState("");
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Attached images: the chat holds bhimg: placeholders; previewHtml (preview, draft,
  // publish, GitHub) has the real images. See lib/siteImages.js.
  const [imagesVersion, setImagesVersion] = useState(0);
  useEffect(() => {
    const off = onImagesChange(() => setImagesVersion((v) => v + 1));
    loadImages();
    return off;
  }, []);
  const lastAi = [...messages].reverse().find(isHtmlMsg);
  const previewHtml = useMemo(
    () => (lastAi ? expandImages(extractHtml(lastAi.content)) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastAi, imagesVersion]
  );

  // HTML that arrives with images embedded (a published site/game opened for editing,
  // a saved draft) gets placeholders instead, so they aren't sent to the AI every time.
  useEffect(() => {
    const cur = messagesRef.current;
    if (!cur.some((m) => isHtmlMsg(m) && m.content.includes(";base64,"))) return;
    let alive = true;
    Promise.all(cur.map(async (m) => (isHtmlMsg(m) ? { ...m, content: await packImages(m.content) } : m))).then((next) => {
      if (!alive || messagesRef.current !== cur) return;
      messagesRef.current = next;
      setMessages(next);
    });
    return () => {
      alive = false;
    };
  }, [messages]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ gameName, title, genre, messages: trimForStorage(messages, isHtmlMsg), projectId }));
    } catch {}
  }, [gameName, title, genre, messages]);

  // Server-side autosave so logging out (which can clear local storage) never loses progress.
  const userTurns = useMemo(() => messages.filter((m) => m.role === "user").map((m) => m.content), [messages]);
  const loadedRef = useRef(false);
  const saveDraftRef = useRef(() => {});
  saveDraftRef.current = () => {
    if (!loadedRef.current) return;
    base44.functions.invoke("game-draft", { action: "save", gameName, title, genre, html: previewHtml, userTurns, projectId }).catch(() => {});
  };

  useEffect(() => {
    const t = setTimeout(() => saveDraftRef.current(), 1500);
    return () => clearTimeout(t);
  }, [gameName, title, genre, previewHtml, userTurns]);

  useEffect(() => {
    const h = () => saveDraftRef.current();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  useEffect(() => {
    (async () => {
      if (startFresh) {
        // Brand new game: forget the previous draft entirely.
        try { localStorage.removeItem(STORE_KEY); } catch {}
        await base44.functions.invoke("game-draft", { action: "clear" }).catch(() => {});
        loadedRef.current = true;
        return;
      }
      try {
        const res = await base44.functions.invoke("game-draft", { action: "load" });
        const d = res.data?.draft;
        if (d && d.html && messages.length === 0) {
          if (d.gameName) setGameName(d.gameName);
          if (d.title) setTitle(d.title);
          if (d.genre) setGenre(d.genre);
          const um = (d.userTurns || []).map((t) => ({ role: "user", content: t }));
          setMessages([...um, { role: "ai", content: d.html }]);
        }
      } catch {}
      loadedRef.current = true;
    })();
    return () => { try { saveDraftRef.current(); } catch {} };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, live]);

  // A published game name is claimed forever, unless it's your own game being re-published.
  useEffect(() => {
    const n = sanitize(gameName || "");
    if (!showPublish || !n) {
      setNameTaken(false);
      setIsRepublish(false);
      return;
    }
    if (RESERVED.includes(n) || findBuiltInGame(n)) {
      setNameTaken(true);
      setIsRepublish(false);
      return;
    }
    let alive = true;
    base44.entities.PublishedGame.filter({ name: n })
      .then((rows) => {
        if (!alive) return;
        setNameTaken((rows || []).some((g) => g.created_by_id !== user?.id));
        setIsRepublish((rows || []).some((g) => g.created_by_id === user?.id));
      })
      .catch(() => {
        if (!alive) return;
        setNameTaken(false);
        setIsRepublish(false);
      });
    return () => {
      alive = false;
    };
  }, [gameName, showPublish, user?.id]);

  const isCodeAi = selectedAi === "code";
  const isGalaxy = selectedAi === "opus5";
  const isSpace = selectedAi === "fable";
  const sendExhausted = isCodeAi ? aiCodeExhausted : isGalaxy ? galaxy5Exhausted : isSpace ? space5Exhausted : aiExhausted;

  // Earlier builds are kept in IndexedDB (lib/buildHistory.js, "game" slot) so they can
  // be restored after a reload; the chat gets their HTML back when it lines up.
  const buildsLoadedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    buildsLoadedRef.current = false;
    loadBuilds(projectId, "game")
      .catch(() => null)
      .then((h) => {
        if (!alive) return;
        buildsLoadedRef.current = true;
        if (!h) return;
        const cur = messagesRef.current;
        if (cur.filter((m) => isHtmlMsg(m) || m.built).length !== h.total) return;
        let k = 0;
        const next = cur.map((m) => {
          if (!(isHtmlMsg(m) || m.built)) return m;
          const html = h.get(k++);
          return m.built && html ? { role: "ai", content: html, note: m.note || "" } : m;
        });
        messagesRef.current = next;
        setMessages(next);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!buildsLoadedRef.current) return;
    const builds = messages.filter((m) => isHtmlMsg(m) || m.built).map((m) => (m.built ? "" : m.content));
    if (!builds.some(Boolean)) return;
    const t = setTimeout(() => saveBuilds(projectId, builds, "game").catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [messages, projectId]);

  const pushMsg = (m) => {
    messagesRef.current = [...messagesRef.current, m];
    setMessages(messagesRef.current);
  };

  const stop = () => {
    reqIdRef.current++;
    abortRef.current?.abort();
    // The server settles the charge for what was written once it notices; re-read credits then.
    setTimeout(() => ({ ai: onSpendAI, code: onSpendAICode, opus5: onSpendGalaxy5, fable: onSpendSpace5 })[selectedAi]?.(), 2500);
    setLoading(false);
    setInput("");
  };

  const runPrompt = async (text, ai) => {
    const prior = messagesRef.current;
    pushMsg({ role: "user", content: text + (files.length ? ` (attached: ${files.map((f) => f.name).join(", ")})` : "") });
    setInput("");
    setLoading(true);
    setLive("");
    const myId = ++reqIdRef.current;
    // Attached images are processed after the busy state is set, so a quick second
    // tap on Send is queued instead of starting a parallel request.
    const images = files.filter((f) => /^image\//.test(f.type));
    const others = files.filter((f) => !/^image\//.test(f.type));
    const placed = [];
    for (const f of images) {
      try {
        placed.push(`bhimg:${await addImageFile(f)} (${f.name})`);
      } catch {
        others.push(f);
      }
    }
    setFiles([]);
    const fileNote =
      (placed.length
        ? `\n[Attached images. Use them in the game with exactly these src values (they are already hosted — never replace them with other URLs, and keep them in any later version): ${placed.join(", ")}]`
        : "") + (others.length ? `\n[Attached files: ${others.map((f) => f.name).join(", ")}]` : "");
    if (reqIdRef.current !== myId) return;
    const spendFor = { ai: onSpendAI, code: onSpendAICode, opus5: onSpendGalaxy5, fable: onSpendSpace5 };
    // Normal Nebulux AI always builds; the code AIs can also just answer a question.
    const intent = ai !== "ai" ? resolveIntent(text, buildMode.mode) : { build: true };
    try {
      const lastHtml = prior.filter(isHtmlMsg).pop()?.content || "";
      const userTurns = prior.filter((m) => m.role === "user").map((m) => m.content).slice(-6);
      const discuss = !intent.build;
      const prompt =
        `${SYSTEM}\n\n` +
        (discuss ? `${DISCUSS_NOTE}\n\n` : `${EXPLAIN_NOTE}\n\n`) +
        (lastHtml ? `Current game HTML:\n${lastHtml}\n\n` : "") +
        `Requests so far:\n${userTurns.length ? userTurns.map((u, i) => `${i + 1}. ${u}`).join("\n") : "(none)"}\n\n` +
        `Latest request: ${text}${fileNote}\n\n` +
        (discuss
          ? "Reply in plain text only — do not output HTML."
          : "Output your short intro, then the complete updated HTML game document in one ```html code block, then the \"What I did:\" summary.");
      const model = MODELS[ai] || "automatic";
      const eff = effortFor(effort, text, { build: !discuss });
      // Streamed so the explanation (and build progress) shows while the AI writes.
      // Aborted by Stop, which also ends the reply on the server (see aiStream.js).
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const res = await streamChat({ prompt, question: text, model, effort: eff }, (soFar) => {
        if (reqIdRef.current === myId) setLive(soFar);
      }, { signal: abort.signal, activity: { key: "game", where: "game", question: text } });
      if (reqIdRef.current !== myId) return;
      setLive("");
      // The server charged the credits (cutting the reply off if they ran out); show its new status.
      spendFor[ai]?.(res.credits);
      let content = res.content ?? "";
      let cut = res.cut;
      // The AI ran out of room before the game was finished: ask it to carry on from where it
      // stopped (up to 3 times), so a half-written game (broken code, a black screen) isn't shown.
      let more = res.more;
      for (let k = 0; !discuss && !cut && k < 3 && (more || looksCut(content)); k++) {
        const sofar = content;
        const next = await streamChat(
          { prompt: prompt + "\n\n" + CONTINUE_NOTE + sofar.slice(-4000), question: "continue", model, effort: eff },
          (soFar) => {
            if (reqIdRef.current === myId) setLive(joinContinuation(sofar, soFar));
          },
          { signal: abort.signal, activity: { key: "game", where: "game", question: text } }
        );
        if (reqIdRef.current !== myId) return;
        spendFor[ai]?.(next.credits);
        content = joinContinuation(sofar, next.content ?? "");
        more = next.more;
        cut = next.cut;
      }
      setLive("");
      if (!discuss && !cut && looksCut(content)) {
        pushMsg({
          role: "ai",
          text: true,
          content: "⚠ This game got too long for the AI to finish, so it wasn't shown (a half-finished game would just be a black screen). Your previous version is kept. Try again, pick a higher effort, or ask for a simpler version.",
        });
        return;
      }
      if (cut) {
        // A half-written game would be broken, so only the explanation so far is shown.
        const said = discuss ? content.trim() : introBeforeCode(content);
        pushMsg({ role: "ai", text: true, content: [said, OUT_OF_CREDITS_NOTE].filter(Boolean).join("\n\n") });
        return;
      }
      if (discuss) {
        pushMsg({ role: "ai", text: true, content });
        return;
      }
      const { html, note } = splitBuildReply(content);
      pushMsg(html ? { role: "ai", content: html, note } : { role: "ai", text: true, content: note });
    } catch (e) {
      if (reqIdRef.current !== myId) return;
      setLive("");
      const data = e?.response?.data;
      if (data?.credits) spendFor[ai]?.(data.credits);
      const why = data?.error || e?.message || "";
      pushMsg({
        role: "ai",
        text: true,
        content:
          data?.outOfCredits || e?.response?.status === 503
            ? `⚠ ${why}`
            : isNetworkError(e)
              ? `⚠ ${OFFLINE_NOTE}`
              : `Sorry, something went wrong generating your game.${why ? ` (${why})` : ""} Please try again.`,
      });
    } finally {
      if (reqIdRef.current === myId) {
        setLoading(false);
        q.runNext();
      }
    }
  };

  // A new build that still shows only a black screen after the preview's quiet reload: ask the AI
  // to fix it straight away (once per build, so a game that can't be fixed doesn't loop).
  const autoFixedRef = useRef("");
  const onPreviewBroken = (error) => {
    if (loading || !previewHtml || autoFixedRef.current === previewHtml || sendExhausted) return;
    autoFixedRef.current = previewHtml;
    runPrompt(
      "The game only shows a black screen" +
        (error ? ` (error: ${error})` : "") +
        ". Find what stops it from drawing and fix it, so it shows the game (or its start screen) straight away.",
      selectedAi
    );
  };

  const q = useMessageQueue({ run: runPrompt, remaining, names: AI_NAMES, selectedAi, onChangeAi: setSelectedAi });

  const send = () => {
    const text = input.trim();
    if (!text) return;
    if (q.shouldQueue(loading)) {
      q.push(text);
      setInput("");
      if (!loading) q.runNext();
      return;
    }
    if (sendExhausted) return;
    runPrompt(text, selectedAi);
  };

  const queued = loading || q.paused;
  const canSend = input.trim().length > 0 && (queued || !sendExhausted);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const confirmPublish = async () => {
    const n = sanitize(gameName).toLowerCase();
    if (!n) {
      setPublishErr("Enter a game name (slug).");
      return;
    }
    if (isPlaceholderName(n)) {
      setPublishErr("Give your game its own name first, like star-catcher. It becomes its web address.");
      return;
    }
    if (!previewHtml) {
      setPublishErr("Generate a game first.");
      return;
    }
    setPublishErr("");
    setPublishing(true);
    try {
      // Games are a monthly allowance per plan; deleting one frees a slot this month.
      const owned = await base44.entities.PublishedGame.filter({ created_by_id: user?.id });
      const isUpdate = (owned || []).some((g) => g.name === n);
      if (!isUpdate) {
        const lim = gameLimit(plan);
        const usedThisMonth = (owned || []).filter((g) => inThisMonth(g.created_date)).length;
        if (usedThisMonth >= lim) {
          setPublishErr(`Your ${plan} plan allows ${lim} new game${lim === 1 ? "" : "s"} per month. Delete one in Settings → Published Games or upgrade.`);
          return;
        }
      }
      const ownerName = user?.full_name || "";
      const dispTitle = title.trim() || n;
      const res = await base44.functions.invoke("publish-game", {
        name: n,
        html: previewHtml,
        title: dispTitle,
        genre,
        ownerName,
      });
      if (res?.data?.error) {
        setPublishErr(res.data.error);
        return;
      }
      const list = getTaken().filter((e) => e.name !== n);
      list.push({ name: n, projectId });
      localStorage.setItem(TAKEN_KEY, JSON.stringify(list));
      setPublishUrl(`${window.location.origin}/play/${n}`);
      setShowPublish(false);
      setPublished(true);
      notifyGamesChanged();
      setTimeout(() => setPublished(false), 8000);
    } catch (e) {
      setPublishErr(e?.response?.data?.error || e?.message || "Could not publish.");
    } finally {
      setPublishing(false);
    }
  };

  const reload = () => setReloadKey((k) => k + 1);
  const [qrUrl, setQrUrl] = useState("");
  const previewBoxRef = useRestartWhenShown(reload);
  const taken = nameTaken;
  const ownerInitial = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-fuchsia-600/15 rounded-full blur-[120px]" />

      {/* Top bar */}
      {/* On phones the bar wraps (genre gets its own row) so Publish stays on screen. */}
      <header className="relative z-20 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 sm:h-[calc(3.5rem+env(safe-area-inset-top))] pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 sm:pt-[env(safe-area-inset-top)] sm:pb-0 px-3 sm:px-4 border-b border-slate-700/50 bg-slate-900/70 backdrop-blur-xl">
        <button onClick={onToggleSidebar} title="Menu" aria-label="Menu: chats and tools" className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0">
          <div className="keep-color w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
            <BlackholeIcon className="w-full h-full" />
          </div>
        </button>
        <span className="h-6 w-px bg-slate-700 shrink-0" />
        <button
          onClick={onOpenProfile}
          title="Account" aria-label="Your profile and settings"
          className="keep-color w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          {ownerInitial}
        </button>
        <span className="h-6 w-px bg-slate-500/60 shrink-0" />
        <ThemeToggle light={lightMode} onToggle={onToggleLight} />
        <input
          value={gameName}
          onChange={(e) => setGameName(sanitize(e.target.value))}
          placeholder="my-game"
          title="Game name (letters, hyphens and dots)"
          className="bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-fuchsia-500/50 w-28 sm:w-40 font-medium shrink-0"
        />

        {/* Genre selector */}
        <div className="order-last basis-full sm:order-none sm:basis-auto flex-1 flex justify-center sm:px-2 min-w-0">
          <div className="flex items-center w-full max-w-md bg-slate-800/70 rounded-lg border border-slate-700/50 focus-within:border-fuchsia-500/50 transition-colors">
            <Gamepad2 className="w-4 h-4 text-fuchsia-400 ml-2.5 shrink-0" />
            <SheetSelect
              value={genre}
              onChange={setGenre}
              name="Genre"
              options={GENRES.map((g) => ({ value: g.id, label: g.label }))}
              className="flex-1 bg-transparent outline-none text-slate-200 px-2 py-1.5 text-sm min-w-0"
            />
            <button
              onClick={reload}
              title="Reload preview"
              className="p-1.5 mr-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          <button
            onClick={onUpgrade}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-700 to-orange-700 text-[#fff] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Crown className="w-4 h-4" /> Upgrade
          </button>
          <GitHubPush html={previewHtml} siteName={gameName} plan={plan} onUpgrade={onUpgrade} />
          <DownloadZip html={previewHtml} name={gameName || "game"} plan={plan} onUpgrade={onUpgrade} />
          <button
            onClick={() => setShowPublish(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-600 text-[#fff] text-sm font-medium hover:bg-fuchsia-500 transition-colors"
          >
            <Rocket className="w-4 h-4" /> Publish
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat */}
        <section className="md:w-[40%] w-full md:h-full h-[45%] flex flex-col border-b md:border-b-0 md:border-r border-slate-700/50 bg-slate-900/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center mb-3">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <p className="text-slate-300 font-medium">Describe your game</p>
                <p className="text-slate-400 text-sm mt-1">Nebulux AI will build it live</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {GAME_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setInput(idea)}
                      className="px-3 py-1.5 rounded-full bg-slate-800/70 border border-slate-700/50 text-slate-300 text-xs hover:bg-slate-700/70 hover:text-white transition-colors"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white text-sm">
                      {m.content}
                    </div>
                  </div>
                );
              }
              const built = isHtmlMsg(m) || m.built;
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] min-w-0 px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-slate-800 text-slate-100 border border-slate-700/50 text-sm">
                    {built ? (
                      <div className="space-y-2">
                        {m.note && <p className="whitespace-pre-wrap">{m.note}</p>}
                        <span className="block text-fuchsia-300 font-medium">✓ Game updated</span>
                        {m === lastAi && i > 0 && !loading && !sendExhausted && (
                          // One tap to improve the game (each is a normal message, so it's charged like one).
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {GAME_TWEAKS.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => runPrompt(t, selectedAi)}
                                className="px-2.5 py-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 text-[12px] text-fuchsia-200 hover:bg-fuchsia-500/20 transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        {isHtmlMsg(m) && m !== lastAi && !loading && (
                          <button
                            onClick={() => pushMsg({ role: "ai", content: m.content, note: "Restored an earlier version." })}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                            title="Make this version the current game again"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore this version
                          </button>
                        )}
                      </div>
                    ) : (
                      <Markdown text={m.content} />
                    )}
                  </div>
                </div>
              );
            })}

            {loading && live && <LiveReply text={live} accent="text-fuchsia-300" label="Building your game" />}
            {loading && !live && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-700/50">
            <QueueList q={q} loading={loading} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-200">
                    <Paperclip className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {sendExhausted && !loading && <OutOfCredits tier={TIER_OF_AI[selectedAi]} />}
            <div className="flex items-end gap-2 bg-slate-800/70 rounded-2xl border border-slate-700/50 focus-within:border-fuchsia-500/50 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={queued ? "Type to queue your next message…" : "Describe the game you want..."}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 max-h-32 text-sm"
              />
              <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} gradient="from-fuchsia-500 to-indigo-500" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach images or files"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <VoiceInput onText={(t) => setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${t}` : t))} />
              <AiChooser value={selectedAi} onChange={setSelectedAi} plan={plan} allowFable={true} />
              <EffortPicker value={effort} onChange={setEffort} />
              {buildMode.visible && <ModeToggle mode={buildMode.mode} onChange={buildMode.setMode} />}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const fs = Array.from(e.target.files || []);
                if (fs.length) setFiles((prev) => [...prev, ...fs]);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        {/* Preview */}
        <section className="md:flex-1 w-full md:h-full h-[55%] flex flex-col bg-slate-950">
          <div className="flex items-center gap-1 px-3 h-10 border-b border-slate-700/50 bg-slate-900/60">
            <button
              onClick={() => setPreviewMode("preview")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${previewMode === "preview" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              Preview
            </button>
            <button
              onClick={() => setPreviewMode("info")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${previewMode === "info" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              Info
            </button>
          </div>

          <div ref={previewBoxRef} className="flex-1 relative overflow-hidden bg-black">
            {previewMode === "info" ? (
              <div className="w-full h-full bg-slate-950 p-6 overflow-y-auto text-slate-200">
                <h2 className="text-lg font-semibold">{title || gameName}</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Genre: <span className="text-slate-200">{GENRES.find((g) => g.id === genre)?.label || genre}</span>
                </p>
                <p className="text-slate-400 text-sm mt-3">
                  Publish your game and it will appear on the Games front page, grouped by genre. The most-played games rise to the Top 5.
                </p>
              </div>
            ) : previewHtml ? (
              <PreviewFrame key={reloadKey} html={previewHtml} title="Game preview" className="w-full h-full bg-black" onBroken={onPreviewBroken} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center mb-3">
                  <Gamepad2 className="w-7 h-7 text-white" />
                </div>
                <p className="text-slate-300 font-medium">Your game preview will appear here</p>
                <p className="text-slate-400 text-sm mt-1">Describe what you want to build in the chat</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Publish dialog */}
      <AnimatePresence>
        {showPublish && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPublish(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Publish your game"
              className="w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white">{isRepublish ? "Re-publish your game" : "Publish your game"}</h3>
              <p className="text-slate-400 text-sm mt-1">Your game will go live on the Games front page at:</p>
              <div className="mt-3 flex items-center gap-2 bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2.5">
                <Gamepad2 className="w-4 h-4 text-fuchsia-300 shrink-0" />
                <span className="text-slate-100 text-sm font-mono truncate">
                  {sanitize(gameName || "my-game")}<span className="text-fuchsia-300">.{GAME_TLDS[genre] || "game"}</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2">The ending comes from the genre you pick.</p>
              <p className="text-slate-400 text-xs mt-2">Anyone can play it, so leave out private things like your full name, home address or school.</p>

              <label htmlFor="publish-game-title" className="block mt-4 text-xs text-slate-400 mb-1">Game title</label>
              <input
                id="publish-game-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Game"
                className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/50"
              />

              <p className="block mt-3 text-xs text-slate-400 mb-1">Genre</p>
              <div className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2.5">
                <SheetSelect
                  value={genre}
                  onChange={setGenre}
                  name="Genre"
                  options={GENRES.map((g) => ({ value: g.id, label: g.label }))}
                  className="w-full bg-transparent outline-none text-slate-200 text-sm"
                />
              </div>

              {taken && (
                <div className="mt-3">
                  <p className="text-amber-300 text-xs">That name is taken. Try one of these:</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {suggestNames(gameName || "my-game", projectId).map((s) => (
                      <button
                        key={s}
                        onClick={() => setGameName(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700/50 text-slate-200 text-xs hover:bg-slate-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowPublish(false)}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-slate-900 border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPublish}
                  disabled={!gameName || isPlaceholderName(sanitize(gameName)) || publishing || !previewHtml || taken}
                  className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 text-[#fff] font-medium hover:bg-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {publishing ? (isRepublish ? "Re-publishing…" : "Publishing…") : isRepublish ? "Re-publish" : "Publish"}
                </button>
              </div>
              <PageSize html={previewHtml} />
              {publishErr && <p className="text-sm text-red-400 mt-3">{publishErr}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-50 bg-emerald-700 text-[#fff] px-4 py-2.5 rounded-xl shadow-2xl flex flex-wrap items-center gap-2 text-sm font-medium"
          >
            <Rocket className="w-4 h-4" /> {isRepublish ? "Game updated!" : "Game published!"}
            {publishUrl && (
              <a href={publishUrl} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                Play
              </a>
            )}
            {publishUrl && <ShareLink url={publishUrl} title={(title || "").trim() || "my game"} />}
            {publishUrl && <QrButton onClick={() => setQrUrl(publishUrl)} />}
            {/* Right after publishing is when people most want to share: invite friends too. */}
            <button
              type="button"
              onClick={() => shell?.openProfile("refer")}
              className="inline-flex items-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1 text-xs font-semibold"
            >
              🎁 Invite friends
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <QrDialog url={qrUrl} title={(title || "").trim() || "Play my game"} onClose={() => setQrUrl("")} />
    </div>
  );
}