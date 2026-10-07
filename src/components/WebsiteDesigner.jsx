import React, { useState, useRef, useEffect, useMemo } from "react";
import useRestartWhenShown from "@/hooks/useRestartWhenShown";
import PageSize from "@/components/designer/PageSize";
import Markdown from "@/components/chat/Markdown";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Globe, Search, RefreshCw, Plus, X, Crown, Rocket, Paperclip, RotateCcw } from "lucide-react";
import BlackholeIcon from "@/components/BlackholeIcon";
import QueueList from "@/components/chat/QueueList";
import SendOrStopButton from "@/components/chat/SendOrStopButton";
import useMessageQueue from "@/hooks/useMessageQueue";
import useBuildMode, { DISCUSS_NOTE, resolveIntent } from "@/hooks/useBuildMode";
import { base44 } from "@/api/base44Client";
import { showNotice as showNoticeLater } from "@/lib/dialogs";
import AiChooser from "@/components/AiChooser";
import CustomDomain from "@/components/designer/CustomDomain";
import DownloadZip from "@/components/designer/DownloadZip";
import VisualEditor from "@/components/designer/VisualEditor";
import SiteDashboard from "@/components/designer/SiteDashboard";
import SheetSelect from "@/components/SheetSelect";
import ThemeToggle from "@/components/ThemeToggle";
import { siteLimit } from "@/lib/publishLimits";
import { withPreviewShim, PREVIEW_SANDBOX } from "@/lib/previewShim";
import { OUT_OF_CREDITS_NOTE } from "@/lib/creditCost";
import { TIER_OF_AI } from "@/lib/creditRefresh";
import OutOfCredits from "@/components/chat/OutOfCredits";
import { useEffort, effortFor } from "@/lib/effort";
import { streamChat } from "@/lib/aiStream";
import LiveReply from "@/components/chat/LiveReply";
import EffortPicker from "@/components/chat/EffortPicker";
import VoiceInput from "@/components/chat/VoiceInput";
import { EXPLAIN_NOTE, splitBuildReply, editReplyNote, introBeforeCode, looksCut, CONTINUE_NOTE, joinContinuation } from "@/lib/buildReply";
import { syncSiteProducts } from "@/lib/siteProducts";
import SaveStatus from "@/components/designer/SaveStatus";
import ShareLink from "@/components/designer/ShareLink";
import { isPlaceholderName, withTitle } from "@/lib/siteNaming";
import QrDialog, { QrButton } from "@/components/designer/QrDialog";
import { EDIT_NOTE, hasEditBlocks, applyEdits } from "@/lib/htmlEdits";
import { DESIGNER_STORE_KEY } from "@/lib/designerStore";
import { saveBuilds, loadBuilds } from "@/lib/buildHistory";
import { loadImages, onImagesChange, addImageFile, expandImages, packImages } from "@/lib/siteImages";
import { hasProFeatures, hasSpace } from "@/lib/plans";
import { useAppShell } from "@/components/AppShellContext";
import useEscape from "@/hooks/useEscape";
import useDialogFocus from "@/hooks/useDialogFocus";
import { isNetworkError, OFFLINE_NOTE } from "@/lib/netError";
import { privateInfoOnPage } from "@/lib/privateInfo";

const STORE_KEY = DESIGNER_STORE_KEY;
const TAKEN_KEY = "infinity-ai-taken-sites";
const MODEL = "claude_sonnet_4_6";
const MODELS = { ai: "automatic", code: MODEL, opus5: "claude_opus_4_8", fable: "claude-sonnet-5" };
const AI_NAMES = { ai: "Nebulux AI", code: "Nebulux Code", opus5: "Galaxy", fable: "Space" };

const RESERVED = ["home", "www", "admin", "api", "mail", "infinity", "ai", "app", "login", "register", "support", "blog"];

// One-tap improvements shown under the latest version of the site.
const SITE_TWEAKS = ["Make it look more modern", "Add a contact form", "Improve the wording", "Make it better on phones", "Add a new section"];

const SYSTEM = `You are Nebulux AI Website Designer. The user describes a website and you build it.
BRANDING: this platform is Nebulux AI (sites live at name.nebuluxai.com). Never write "Blackhole", "Blackhole AI" or "blackhole-ai-tech.com" anywhere in a page, including comments; when editing a page that has them, change them to Nebulux AI / nebuluxai.com (keep ids like blackhole-products as nebulux-products).
ALWAYS build a single complete, self-contained HTML document: include <!DOCTYPE html>, <html>, <head> with inline <style> CSS, and <body> with inline <script> for any interactivity.
Make it modern, responsive, and visually polished — clean typography, good spacing, a tasteful color palette, and smooth interactions. Use placeholder content that fits the site's purpose.
FINDABLE AND FOR EVERYONE: give the page <html lang="en"> (or the site's language), a <meta name="viewport" content="width=device-width, initial-scale=1">, a specific <title> and a <meta name="description"> of one sentence about the site, one <h1>, and headings in order. Give every image an alt text that says what it shows, keep text readable against its background (strong contrast), make buttons and links big enough to tap on a phone, and never use text as an image.
Every button, link, tab, menu and form must actually do something when clicked — scroll to its section, switch views, open/close menus and modals, validate and "submit" forms with a confirmation message. Never leave a button with no behaviour.
FORMS: when the site is published, whatever visitors enter in a form is delivered to the site owner's Messages inbox automatically. Give every field a clear <label> (or a name attribute) such as "Name", "Email", "Phone", "Date" or "Message", keep the on-page confirmation message, and never ask for passwords, card numbers or ID numbers.
SIGN IN WITH GOOGLE: when the user asks for sign in, log in, sign up, accounts, members or "Google login", ALWAYS build it — never say you can't. Every published Nebulux site has a built-in Google sign-in, ready to use with no setup and no API keys (never use Firebase, Auth0, Supabase, Google's own SDK or a password form):
- A sign-in button: <button data-nx-signin>Sign in with Google</button> (style it like a real Google button: white, a "G" logo made in inline SVG, rounded). A sign-out button: <button data-nx-signout>Sign out</button>.
- Parts only for signed-in visitors get data-nx-signed-in; parts only for signed-out visitors get data-nx-signed-out (they're shown/hidden automatically).
- Show who's signed in with <span data-nx-user="name"></span>, <span data-nx-user="email"></span> and <img data-nx-user="picture" alt="Profile picture">.
- In JavaScript: NebuluxAuth.user is null or { email, name, picture }; NebuluxAuth.signIn() and NebuluxAuth.signOut(); NebuluxAuth.onChange(function(user){ ... }) runs now and on every change. Use it for members-only pages, personal greetings, saving things per visitor in localStorage under their email, etc.
- The site's owner sees everyone who signed in under Dashboard → Sign in.
AI CHAT FOR VISITORS: when the user wants an AI chatbot, assistant, helper or anything that answers visitors with AI on their site, build it with the built-in NebuluxAI (never an OpenAI/Gemini key or any other AI service): \`NebuluxAI.chat("question")\` or \`NebuluxAI.chat([{ role: "user", content: "..." }, { role: "assistant", content: "..." }, ...])\` returns a Promise of the reply text. Show a typing indicator while waiting, keep the conversation in an array, and catch errors with a friendly message. Then tell the user, outside the code: "To make it answer for real, turn on AI for visitors in Dashboard → AI. Replies are paid from your API balance on the Nebulux Platform."
Put the complete HTML document inside ONE \`\`\`html code block, with your explanation outside it (see EXPLAIN YOUR WORK).
When the user asks for changes to an existing site, follow the EDIT MODE instructions if given; otherwise output the FULL updated HTML document.

PAYMENTS: never add a checkout, billing, payment or "buy" page unless the user explicitly asks for one — a normal site has no products, no prices and no payment buttons. Only when the user asks for a billing, checkout, pricing, payment or "buy" page, use Blackhole's built-in payment system — the same hosted checkout this platform uses. Never use Stripe, PayPal, or your own card form, and never ask the buyer for card numbers.
1) Declare the products inside the document exactly like this:
<script type="application/json" id="nebulux-products">[{"id":"basic","name":"Basic","price":"9.99","currency":"USD"}]</script>
Product ids are lowercase letters, numbers and hyphens; price is major units as a string and must be at least 0.50.
2) Every buy button must call: parent.postMessage({ type: 'nebulux-checkout', productId: 'basic', quantity: 1 }, '*')
Nebulux AI then opens the secure hosted checkout, collects the buyer's card, email and address, and the site owner is paid out after platform fees and taxes. Design the page beautifully, but never collect payment details yourself.`;

function extractHtml(text) {
  if (!text) return "";
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

// `text: true` marks plain chat replies (discuss mode, errors, out-of-credits) so a reply
// that merely mentions a tag like <nav> is never mistaken for a new version of the site.
const isHtmlMsg = (m) => m.role === "ai" && !m.text && /<[a-z!][\s\S]*>/i.test(m.content);

// Sites are single documents, so the "pages" are their sections: ids used as in-page
// link targets (href="#pricing") or on <section> elements. Picking one jumps the
// preview there (see "nebulux-goto" in lib/previewShim.js).
function detectSections(html) {
  const ids = new Set();
  if (html) {
    const declared = new Set();
    let m;
    const idRe = /\sid=["']([A-Za-z][\w-]*)["']/g;
    while ((m = idRe.exec(html))) declared.add(m[1]);
    // In-page links, and view switches wired to a clickable element (onclick="showView('pricing')").
    const linkRe = /href=["']#([A-Za-z][\w-]*)["']|onclick="[^"]*?showView\(\s*'([A-Za-z][\w-]*)'|onclick='[^']*?showView\(\s*"([A-Za-z][\w-]*)"/g;
    while ((m = linkRe.exec(html))) {
      const id = m[1] || m[2] || m[3];
      if (declared.has(id) || !m[1]) ids.add(id);
    }
    const sectionRe = /<section[^>]*\sid=["']([A-Za-z][\w-]*)["']/gi;
    while ((m = sectionRe.exec(html))) ids.add(m[1]);
  }
  return ["", ...Array.from(ids)];
}

// Only the newest HTML version is worth keeping — older copies are huge and blow the
// browser storage quota, which is what made saves silently fail. Older builds keep
// just their explanation so the chat history still reads correctly.
function trimForStorage(messages) {
  let keptHtml = false;
  return [...messages]
    .reverse()
    .map((m) => {
      if (!isHtmlMsg(m)) return m;
      if (keptHtml) return { role: "ai", content: "", note: m.note || "", built: true };
      keptHtml = true;
      return m;
    })
    .reverse();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { siteName: p.siteName || p.name || "my-site", messages: p.messages || [], members: p.members || [], projectId: p.projectId || genId() };
    }
  } catch {}
  return { siteName: "my-site", messages: [], members: [], projectId: genId() };
}

function genId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
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
  if (!n || RESERVED.includes(n)) return true;
  const o = ownerOf(n);
  return !!o && o !== projectId;
}

function suggestNames(n, projectId) {
  const base = n || "my-site";
  const out = [];
  let i = 1;
  while (out.length < 3 && i < 30) {
    const c = `${base}-${i}`;
    if (!isTakenFor(c, projectId)) out.push(c);
    i++;
  }
  return out;
}

function sanitizeSite(s) {
  return s.toLowerCase().replace(/[^a-z-]+/g, "-").replace(/^-+|-+$/g, "");
}

function capFor(plan) {
  if (plan === "secret" || plan === "enterprise") return 5;
  if (plan === "team" || plan === "pro") return 3;
  return 2;
}

function initialOf(s) {
  return (s || "?").trim().charAt(0).toUpperCase();
}

export default function WebsiteDesigner({ onToggleSidebar, onOpenProfile, onUpgrade, aiExhausted, onSpendAI, aiCodeExhausted, onSpendAICode, galaxy5Exhausted, onSpendGalaxy5, space5Exhausted, onSpendSpace5, remaining, plan, lightMode, onToggleLight }) {
  const shell = useAppShell();
  const initial = loadState();
  const [projectId, setProjectId] = useState(initial.projectId);
  const [siteName, setSiteName] = useState(initial.siteName);
  const [messages, setMessages] = useState(initial.messages);
  const [members, setMembers] = useState(initial.members);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [pagePath, setPagePath] = useState("");
  const [previewMode, setPreviewMode] = useState("preview");
  const [reloadKey, setReloadKey] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteErr, setInviteErr] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  useEscape(showPublish, () => setShowPublish(false));
  const dialogRef = useDialogFocus(showPublish);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishErr, setPublishErr] = useState("");
  const [publishUrl, setPublishUrl] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [nameTaken, setNameTaken] = useState(false);
  const [isRepublish, setIsRepublish] = useState(false);
  const opusAllowed = hasProFeatures(plan);
  // Custom domains: everyone.
  const domainAllowed = true; // every plan, Free included (owner, 2026-09-27)
  const [domainInput, setDomainInput] = useState("");
  const [domainOpen, setDomainOpen] = useState({ key: 0, host: "" });
  const fableAllowed = hasSpace(plan);
  const [selectedAi, setSelectedAi] = useState(fableAllowed ? "fable" : opusAllowed ? "opus5" : "ai");
  const [files, setFiles] = useState([]);
  const [focused, setFocused] = useState(false);
  const buildMode = useBuildMode(selectedAi);
  const [effort, setEffort] = useEffort();
  const [live, setLive] = useState("");
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const location = useLocation();
  const navigate = useNavigate();

  // Attached images: the chat holds bhimg: placeholders, and previewHtml (used for the
  // preview, publishing, download and GitHub) has the real images (lib/siteImages.js).
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
  // Checked only while the publish window is open (it parses the whole page).
  const pageSecret = useMemo(() => (showPublish ? privateInfoOnPage(previewHtml) : ""), [showPublish, previewHtml]);

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

  // Buy buttons in the page ask the host to start checkout. In the designer that's a
  // preview, so say where checkout actually happens instead of silently ignoring it.
  const previewRef = useRef(null);
  const [previewNotice, setPreviewNotice] = useState("");
  useEffect(() => {
    let t;
    const onMsg = (e) => {
      if (e.source !== previewRef.current?.contentWindow || !/^(nebulux|blackhole)-checkout$/.test(e.data?.type || "")) return;
      setPreviewNotice("Buy buttons open secure checkout on your published website.");
      clearTimeout(t);
      t = setTimeout(() => setPreviewNotice(""), 4000);
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      clearTimeout(t);
    };
  }, []);

  // Handoff from the Website Designer dashboard: a prompt typed there gets sent automatically once.
  useEffect(() => {
    const initialPrompt = location.state?.initialPrompt;
    if (initialPrompt && messagesRef.current.length === 0) {
      navigate(location.pathname, { replace: true, state: {} });
      runPrompt(initialPrompt, selectedAi);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: persist the project a moment after every change, and again on exit.
  useEffect(() => {
    setSaveState("saving");
    const save = () => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ siteName, messages: trimForStorage(messages), members, projectId }));
      } catch {}
    };
    const t = setTimeout(() => {
      save();
      setSaveState("saved");
    }, 600);
    window.addEventListener("beforeunload", save);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, [siteName, messages, members, projectId]);

  // Account autosave (functions/.../site-draft.js): the site being worked on, published or not,
  // also goes to the account, so it comes back on another device or after this browser's data is
  // cleared. Restored only when this browser has no project of its own yet.
  const [hadLocal] = useState(() => {
    try {
      return !!localStorage.getItem(STORE_KEY);
    } catch {
      return true;
    }
  });
  const draftReadyRef = useRef(false);
  const siteTurns = useMemo(() => messages.filter((m) => m.role === "user").map((m) => m.content), [messages]);
  useEffect(() => {
    let alive = true;
    if (hadLocal) {
      draftReadyRef.current = true;
      return;
    }
    base44.functions
      .invoke("site-draft", { action: "load" })
      .then((r) => {
        const d = r.data?.draft;
        if (!alive || !d || !d.html || messagesRef.current.length) return;
        if (d.siteName) setSiteName(d.siteName);
        const next = [...(d.userTurns || []).map((t) => ({ role: "user", content: t })), { role: "ai", content: d.html }];
        messagesRef.current = next;
        setMessages(next);
      })
      .catch(() => {})
      .finally(() => {
        draftReadyRef.current = true;
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!draftReadyRef.current || !previewHtml) return;
    const t = setTimeout(() => {
      base44.functions.invoke("site-draft", { action: "save", siteName, html: previewHtml, userTurns: siteTurns, projectId }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [siteName, previewHtml, siteTurns, projectId]);

  // Earlier builds live in IndexedDB (see lib/buildHistory.js). After a reload, put
  // their HTML back into the chat so each one can be restored; skipped if the stored
  // history doesn't line up with this chat.
  const buildsLoadedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    buildsLoadedRef.current = false;
    loadBuilds(projectId)
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
    // One entry per build, in order; builds whose HTML is already gone are kept as ""
    // so the positions still line up with the chat when it's reloaded.
    const builds = messages.filter((m) => isHtmlMsg(m) || m.built).map((m) => (m.built ? "" : m.content));
    if (!builds.some(Boolean)) return;
    const t = setTimeout(() => saveBuilds(projectId, builds).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [messages, projectId]);

  const restoreBuild = (m) => {
    pushMsg({ role: "ai", content: m.content, note: "Restored an earlier version." });
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, live]);

  // A published name is claimed forever, unless it's your own site being republished.
  useEffect(() => {
    const n = sanitizeSite(siteName || "");
    if (!showPublish || !n) {
      setNameTaken(false);
      setIsRepublish(false);
      return;
    }
    if (RESERVED.includes(n)) {
      setNameTaken(true);
      setIsRepublish(false);
      return;
    }
    let alive = true;
    base44.entities.PublishedSite.filter({ name: n })
      .then((rows) => {
        if (!alive) return;
        setNameTaken((rows || []).some((s) => s.created_by_id !== user?.id));
        setIsRepublish((rows || []).some((s) => s.created_by_id === user?.id));
      })
      .catch(() => {
        if (!alive) return;
        setNameTaken(false);
        setIsRepublish(false);
      });
    return () => {
      alive = false;
    };
  }, [siteName, showPublish, user?.id]);

  const effPlan = plan;
  const cap = capFor(plan);
  const ownerInitial = initialOf(user?.full_name || user?.email || "U");
  const canAdd = members.length < cap - 1;

  const isCodeAi = selectedAi === "code";
  const isGalaxy = selectedAi === "opus5";
  const isSpace = selectedAi === "fable";
  const sendExhausted = isCodeAi ? aiCodeExhausted : isGalaxy ? galaxy5Exhausted : isSpace ? space5Exhausted : aiExhausted;

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
        ? `\n[Attached images. Use them in the page with exactly these src values (they are already hosted — never replace them with other URLs, and keep them in any later version): ${placed.join(", ")}]`
        : "") + (others.length ? `\n[Attached files: ${others.map((f) => f.name).join(", ")}]` : "");
    if (reqIdRef.current !== myId) return;
    const spendFor = { ai: onSpendAI, code: onSpendAICode, opus5: onSpendGalaxy5, fable: onSpendSpace5 };
    // Normal Nebulux AI always builds; the code AIs can also just answer a question.
    const intent = resolveIntent(text, "build"); // a question never changes the page
    try {
      const lastHtml = prior.filter(isHtmlMsg).pop()?.content || "";
      // Only the last few requests are sent: a long history on top of a big page makes the
      // model take longer than the 120s request window and the generation fails.
      const userTurns = prior.filter((m) => m.role === "user").map((m) => m.content).slice(-6);
      const discuss = !intent.build;
      const editMode = !discuss && !!lastHtml;
      const prompt =
        `${SYSTEM}\n\n` +
        (discuss ? `${DISCUSS_NOTE}\n\n` : `${EXPLAIN_NOTE}\n\n`) +
        (editMode ? `${EDIT_NOTE}\n\n` : "") +
        (lastHtml ? `Current website HTML:\n${lastHtml}\n\n` : "") +
        `Recent requests:\n${userTurns.length ? userTurns.map((u, i) => `${i + 1}. ${u}`).join("\n") : "(none)"}\n\n` +
        `Latest request: ${text}${fileNote}\n\n` +
        (discuss
          ? "Reply in plain text only — do not output HTML."
          : editMode
            ? "Output your short intro, then the edit blocks, then the \"What I did:\" summary."
            : "Output your short intro, then the complete updated HTML document in one ```html code block, then the \"What I did:\" summary.");
      const model = MODELS[ai] || "automatic";
      const eff = effortFor(effort, text, { build: !discuss });
      // Streamed so the explanation (and build progress) shows while the AI writes.
      // Aborted by Stop, which also ends the reply on the server (see aiStream.js).
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const res = await streamChat({ prompt, question: text, model, effort: eff }, (soFar) => {
        if (reqIdRef.current === myId) setLive(soFar);
      }, { signal: abort.signal, activity: { key: "website", where: "website", question: text } });
      if (reqIdRef.current !== myId) return;
      setLive("");
      // The server charged the credits (cutting the reply off if they ran out); show its new status.
      spendFor[ai]?.(res.credits);
      let content = res.content ?? "";
      let cut = res.cut;
      // The AI ran out of room before the page was finished: ask it to carry on from where it
      // stopped (up to 3 times), so a half-written site (broken, blank) isn't shown.
      let more = res.more;
      for (let k = 0; !discuss && !editMode && !cut && k < 3 && (more || looksCut(content)); k++) {
        const sofar = content;
        const next = await streamChat(
          { prompt: prompt + "\n\n" + CONTINUE_NOTE + sofar.slice(-4000), question: "continue", model, effort: eff },
          (soFar) => {
            if (reqIdRef.current === myId) setLive(joinContinuation(sofar, soFar));
          },
          { signal: abort.signal, activity: { key: "website", where: "website", question: text } }
        );
        if (reqIdRef.current !== myId) return;
        spendFor[ai]?.(next.credits);
        content = joinContinuation(sofar, next.content ?? "");
        more = next.more;
        cut = next.cut;
      }
      setLive("");
      if (!discuss && !editMode && !cut && looksCut(content)) {
        pushMsg({
          role: "ai",
          text: true,
          content: "⚠ This website got too long for the AI to finish, so it wasn't shown (a half-finished page would be broken). Your previous version is kept. Try again, pick a higher effort, or ask for a simpler version.",
        });
        return;
      }
      if (cut) {
        // A half-written build would break the site, so only the explanation so far is shown.
        const said = discuss ? content.trim() : introBeforeCode(content);
        pushMsg({ role: "ai", text: true, content: [said, OUT_OF_CREDITS_NOTE].filter(Boolean).join("\n\n") });
        return;
      }
      if (discuss) {
        pushMsg({ role: "ai", text: true, content });
        return;
      }
      if (editMode && hasEditBlocks(content)) {
        const { html, failed } = applyEdits(lastHtml, content);
        const note = editReplyNote(content);
        if (html !== lastHtml) pushMsg({ role: "ai", content: html, note });
        else if (note) pushMsg({ role: "ai", text: true, content: note });
        if (failed.length) pushMsg({ role: "ai", text: true, content: `${failed.length} of the changes couldn't be placed in the page — ask again for just that part.` });
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
      const timedOut = /timeout|timed out|504|took too long/i.test(why);
      pushMsg({
        role: "ai",
        text: true,
        content: timedOut
          ? "That took too long to generate — your website is big, so rewriting the whole page can run past the time limit. Ask for one smaller change at a time (e.g. \"change the pricing section\") and it will go through."
          : data?.outOfCredits || e?.response?.status === 503
            ? `⚠ ${why}`
            : isNetworkError(e)
              ? `⚠ ${OFFLINE_NOTE}`
              : `Sorry, something went wrong generating your website.${why ? ` (${why})` : ""} Please try again.`,
      });
    } finally {
      if (reqIdRef.current === myId) {
        setLoading(false);
        q.runNext();
      }
    }
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

  const addMember = () => {
    const e = inviteEmail.trim().toLowerCase();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setInviteErr("Enter a valid email.");
      return;
    }
    if (members.includes(e)) {
      setInviteErr("Already added.");
      return;
    }
    if (!canAdd) {
      setInviteErr(`Your ${effPlan} plan allows ${cap} people total (including you).`);
      return;
    }
    setMembers((m) => [...m, e]);
    setInviteEmail("");
    setInviteErr("");
    setShowInvite(false);
  };

  const confirmPublish = async () => {
    const n = sanitizeSite(siteName).toLowerCase();
    if (!n) { setPublishErr("Enter a website name."); return; }
    if (isPlaceholderName(n)) { setPublishErr("Give your website its own name first. It becomes its web address."); return; }
    if (!previewHtml) { setPublishErr("Generate a website first."); return; }
    setPublishErr("");
    setPublishing(true);
    try {
      const existing = await base44.entities.PublishedSite.filter({ name: n });
      const mine = existing.find((s) => s.created_by_id === user?.id);
      if (existing.length && !mine) {
        setPublishErr("That name is taken. Try another.");
        return;
      }
      const ownerName = user?.full_name || "";
      if (!mine) {
        // Websites are a lifetime allowance per plan; deleting one frees a slot.
        const lim = siteLimit(plan);
        const owned = await base44.entities.PublishedSite.filter({ created_by_id: user?.id });
        if ((owned || []).length >= lim) {
          setPublishErr(`Your ${plan} plan allows ${lim} website${lim === 1 ? "" : "s"}. Delete one in Settings → Published Websites or upgrade.`);
          return;
        }
      }
      // Handled by the Cloudflare function at functions/api/apps/<appId>/functions/publish-site.js.
      // The page's tab title is the site's name unless it already has a real one.
      const html = withTitle(previewHtml, n);
      await base44.functions.invoke("publish-site", { name: n, html, ownerName });
      // Mirror any products the page sells so checkout prices are server-side and sales are tracked.
      await syncSiteProducts(n, html, user).catch(() => {});
      const list = getTaken().filter((e) => e.name !== n);
      list.push({ name: n, projectId });
      localStorage.setItem(TAKEN_KEY, JSON.stringify(list));
      setPublishUrl(`https://${n}.nebuluxai.com`);
      // Typed a custom domain in the publish box (Pro and up): connect it now and show the DNS steps.
      if (domainAllowed && domainInput.trim()) setDomainOpen({ key: Date.now(), host: domainInput.trim() });
      setShowPublish(false);
      setPublished(true);
      setTimeout(() => setPublished(false), 8000);
    } catch (e) {
      setPublishErr(e?.response?.data?.error || e?.message || "Could not publish.");
    } finally {
      setPublishing(false);
    }
  };

  const reload = () => setReloadKey((k) => k + 1);
  // The visual editor is for Pro and up (like Nebulux Code): others get the upgrade popup.
  const openEditor = () => {
    if (shell?.codeAllowed === false) {
      shell.setUpgradeOpen({ title: "Upgrade to use the editor", text: "Dragging blocks, typing on the page and styling it yourself is included with Pro and higher plans. You can still change your site any time by asking the AI in the chat." });
      return;
    }
    if (!previewHtml) return showNoticeLater("Build a site first, then you can edit it here.");
    setPreviewMode("edit");
  };
  const saveEdits = async (html) => {
    const packed = await packImages(html);
    setMessages((m) => [...m, { role: "ai", content: packed, edited: true }]);
    setPreviewMode("preview");
  };
  // Every version the AI or the editor made, for the dashboard.
  const versions = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => isHtmlMsg(m))
    .map(({ m, i }) => {
      const ask = [...messages.slice(0, i)].reverse().find((x) => x.role === "user");
      return { index: i, content: m.content, label: m.edited ? "Edited in the visual editor" : m.restored ? "Restored an earlier version" : ask ? `"${String(ask.content).slice(0, 80)}"` : "Built by the AI" };
    });
  const [qrUrl, setQrUrl] = useState("");
  const previewBoxRef = useRestartWhenShown(reload);

  const taken = nameTaken;
  const sections = detectSections(previewHtml);
  const currentSection = sections.includes(pagePath) ? pagePath : "";
  const goToSection = (id) => {
    setPagePath(id);
    previewRef.current?.contentWindow?.postMessage({ type: "nebulux-goto", id }, "*");
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px]" />

      {/* Top bar */}
      {/* On phones the bar wraps to a second row so Publish/Download stay on screen. */}
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
          className="keep-color w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white hover:opacity-90 transition-opacity shrink-0"
        >
          {ownerInitial}
        </button>
        <span className="h-6 w-px bg-slate-500/60 shrink-0" />
        <ThemeToggle light={lightMode} onToggle={onToggleLight} />
        <input
          value={siteName}
          onChange={(e) => setSiteName(sanitizeSite(e.target.value))}
          placeholder="my-site"
          title="Website name (letters and hyphens only)"
          className="bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50 w-28 sm:w-40 font-medium shrink-0"
        />

        <SaveStatus state={saveState} />

        {/* Page path / search bar */}
        <div className="hidden sm:flex flex-1 justify-center px-2 min-w-0">
          <div className="flex items-center w-full max-w-md bg-slate-800/70 rounded-lg border border-slate-700/50 focus-within:border-indigo-500/50 transition-colors">
            <Search className="w-4 h-4 text-slate-500 ml-2.5 shrink-0" />
            <SheetSelect
              value={currentSection}
              onChange={goToSection}
              name="Go to section"
              options={sections.map((s) => ({ value: s, label: s ? `#${s}` : "Top of page" }))}
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

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          <div className="hidden sm:flex items-center -space-x-2">
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900"
              title="You"
            >
              {ownerInitial}
            </div>
            {members.map((m, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 ring-2 ring-slate-900"
                title={m}
              >
                {initialOf(m)}
              </div>
            ))}
            {canAdd && (
              <button
                onClick={() => setShowInvite((s) => !s)}
                title="Invite people"
                className="w-8 h-8 rounded-full bg-slate-800 border border-dashed border-slate-600 flex items-center justify-center text-slate-300 hover:text-white hover:border-indigo-500 ring-2 ring-slate-900 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={onUpgrade}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-700 to-orange-700 text-[#fff] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Crown className="w-4 h-4" /> Upgrade
          </button>
          <CustomDomain siteName={siteName} plan={plan} onUpgrade={onUpgrade} openKey={domainOpen.key} initialHost={domainOpen.host} />
          <DownloadZip html={previewHtml} name={siteName} plan={plan} onUpgrade={onUpgrade} />
          <button
            onClick={() => setShowPublish(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-[#fff] text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Rocket className="w-4 h-4" /> Publish
          </button>
        </div>
      </header>

      {/* Invite popover */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-4 top-16 z-30 w-72 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-white">Invite to project</p>
              <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              {effPlan} plan · {cap} people max (incl. you) · {members.length + 1}/{cap} used
            </p>
            <div className="flex items-center gap-2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addMember();
                }}
                placeholder="email@example.com"
                className="flex-1 bg-slate-800/70 border border-slate-700/50 rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={addMember}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-[#fff] text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Add
              </button>
            </div>
            {inviteErr && <p className="text-xs text-red-400 mt-2">{inviteErr}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat */}
        <section className="md:w-[40%] w-full md:h-full h-[45%] flex flex-col border-b md:border-b-0 md:border-r border-slate-700/50 bg-slate-900/40">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
            {messages.length === 0 && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mb-3">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <p className="text-slate-300 font-medium">Describe your website</p>
                <p className="text-slate-500 text-sm mt-1">Nebulux AI will build it live</p>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-sm">
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
                        <span className="block text-emerald-300 font-medium">✓ Website updated</span>
                        {m === lastAi && !loading && !sendExhausted && (
                          // One tap to improve the site (each is a normal message, so it's charged like one).
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {SITE_TWEAKS.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => runPrompt(t, selectedAi)}
                                className="px-2.5 py-1 rounded-full border border-sky-500/40 bg-sky-500/10 text-[12px] text-sky-200 hover:bg-sky-500/20 transition-colors"
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        {isHtmlMsg(m) && m !== lastAi && !loading && (
                          <button
                            onClick={() => restoreBuild(m)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                            title="Make this version the current website again"
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

            {loading && live && <LiveReply text={live} accent="text-emerald-300" label="Building your website" />}
            {loading && !live && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
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
            <div className="flex items-end gap-2 bg-slate-800/70 rounded-2xl border border-slate-700/50 focus-within:border-sky-500/50 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={queued ? "Type to queue your next message…" : "Describe the website you want..."}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 max-h-32 text-sm"
              />
              <SendOrStopButton loading={loading} focused={focused} queued={queued} canSend={canSend} onSend={send} onStop={stop} gradient="from-sky-500 to-indigo-500" />
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

        {/* Preview / Dashboard */}
        <section className="md:flex-1 w-full md:h-full h-[55%] flex flex-col bg-slate-950">
          <div className="flex items-center gap-1 px-3 h-10 border-b border-slate-700/50 bg-slate-900/60">
            <button
              onClick={() => setPreviewMode("preview")}
              className={`px-3 py-2 sm:py-1 rounded-md text-xs font-medium transition-colors ${
                previewMode === "preview" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Preview
            </button>
            <button
              onClick={openEditor}
              title="Edit the page visually (Pro and up)"
              className={`px-3 py-2 sm:py-1 rounded-md text-xs font-medium transition-colors ${
                previewMode === "edit" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setPreviewMode("dashboard")}
              className={`px-3 py-2 sm:py-1 rounded-md text-xs font-medium transition-colors ${
                previewMode === "dashboard" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Dashboard
            </button>
          </div>

          <div ref={previewBoxRef} className="flex-1 relative overflow-hidden bg-white">
            {previewMode === "edit" && previewHtml ? (
              <div className="max-sm:fixed max-sm:inset-0 max-sm:z-[60] max-sm:pt-[env(safe-area-inset-top)] w-full h-full bg-slate-950">
                {/* full screen on phones while editing */}
                <VisualEditor key={lastAi?.content?.length || 0} html={previewHtml} onSave={saveEdits} onCancel={() => setPreviewMode("preview")} />
              </div>
            ) : previewMode === "dashboard" ? (
              <SiteDashboard
                siteName={siteName}
                onRename={(n) => setSiteName(sanitizeSite(n))}
                html={previewHtml}
                plan={plan}
                onUpgrade={onUpgrade}
                user={user}
                members={members}
                cap={cap}
                canAdd={canAdd}
                onInvite={() => setShowInvite(true)}
                onPublish={() => setShowPublish(true)}
                builds={versions}
                onRestore={(content) => { setMessages((m) => [...m, { role: "ai", content, restored: true }]); setPreviewMode("preview"); }}
                onEdit={openEditor}
              />
            ) : previewHtml ? (
              <iframe
                key={reloadKey}
                ref={previewRef}
                srcDoc={withPreviewShim(previewHtml)}
                title="Website preview"
                sandbox={PREVIEW_SANDBOX}
                className="w-full h-full bg-white"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mb-3">
                  <Globe className="w-7 h-7 text-white" />
                </div>
                <p className="text-slate-300 font-medium">Your website preview will appear here</p>
                <p className="text-slate-500 text-sm mt-1">Describe what you want to build in the chat</p>
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
              aria-label="Publish your website"
              className="w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6"
            >
              <h3 className="text-lg font-semibold text-white">{isRepublish ? "Re-publish your website" : "Publish your website"}</h3>
              <label htmlFor="bh-publish-name" className="block text-slate-300 text-sm mt-3 font-medium">Website name</label>
              <input
                id="bh-publish-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. joes-bakery"
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full bg-slate-800 border border-slate-700/50 focus:border-indigo-500/60 rounded-xl px-3 py-2 text-sm text-white outline-none"
              />
              {isPlaceholderName(sanitizeSite(siteName || "")) && (
                <p role="alert" className="mt-1.5 text-xs text-amber-300">Give your website its own name, like joes-bakery or sam-portfolio. It becomes its web address.</p>
              )}
              <p className="text-slate-400 text-sm mt-3">Your website will be live at:</p>
              <div className="mt-3 flex items-center gap-2 bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2.5">
                <Globe className="w-4 h-4 text-sky-300 shrink-0" />
                <span className="text-slate-100 text-sm font-mono truncate">
                  {sanitizeSite(siteName || "your-site")}<span className="text-sky-300">.nebuluxai.com</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-2">You pick the name — the .nebuluxai.com ending always stays.</p>
              {/* Their own domain (Pro and up). Grey with an Upgrade button on the free plan. */}
              <div className="mt-4">
                <p className={`text-sm ${domainAllowed ? "text-slate-300" : "text-slate-500"}`}>Connect your custom domain</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    disabled={!domainAllowed}
                    placeholder="www.yourdomain.com"
                    aria-label="Your custom domain"
                    spellCheck={false}
                    className={`flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none border ${domainAllowed ? "bg-slate-800 border-slate-700/50 focus:border-indigo-500/60 text-white" : "bg-slate-800/40 border-slate-700/30 text-slate-500 placeholder:text-slate-600 cursor-not-allowed"}`}
                  />
                  {!domainAllowed && (
                    <button type="button" onClick={onUpgrade} className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-2 text-xs font-semibold text-[#fff] hover:opacity-90">
                      Upgrade
                    </button>
                  )}
                </div>
                <p className="text-slate-500 text-xs mt-1.5">
                  {domainAllowed
                    ? "Optional. After you publish, we'll show the one setting to add where you bought the domain."
                    : "Use your own address (like www.mybakery.com) with Pro and higher plans."}
                </p>
                {domainAllowed && (
                  <button type="button" onClick={() => setDomainOpen({ key: Date.now(), host: "" })} className="mt-1 text-xs text-indigo-300 hover:text-indigo-200 underline">
                    Already connected one? Check or change your domain
                  </button>
                )}
              </div>
              <p className="text-slate-400 text-xs mt-2">
                Anyone on the internet can see it, so leave out private things like your home address, passwords or card numbers.
              </p>
              {pageSecret && (
                <p role="alert" className="mt-2 text-xs text-amber-300">
                  Your page seems to show {pageSecret}. Take it out before you publish (ask the AI to remove it).
                </p>
              )}

              {taken && (
                <div className="mt-3">
                  <p className="text-amber-300 text-xs">
                    That name is taken. Try one of these:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {suggestNames(siteName || "my-site", projectId).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSiteName(s)}
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
                  disabled={!siteName || isPlaceholderName(sanitizeSite(siteName)) || publishing || !previewHtml || taken}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-[#fff] font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

      {/* Preview notice (e.g. a buy button clicked in the preview) */}
      <AnimatePresence>
        {previewNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-600 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl text-sm"
          >
            {previewNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish toast */}
      <AnimatePresence>
        {published && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-50 bg-emerald-700 text-[#fff] px-4 py-2.5 rounded-xl shadow-2xl flex flex-wrap items-center gap-2 text-sm font-medium"
          >
            <Rocket className="w-4 h-4" /> {isRepublish ? "Website updated!" : "Website published!"}
            {publishUrl && (
              <a href={publishUrl} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                View {publishUrl.replace(/^https:\/\//, "")}
              </a>
            )}
            {publishUrl && <ShareLink url={publishUrl} title={publishUrl.replace(/^https:\/\//, "")} />}
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
      <QrDialog url={qrUrl} title="Open my website" onClose={() => setQrUrl("")} />
    </div>
  );
}