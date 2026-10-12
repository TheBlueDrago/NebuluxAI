import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Loader2, Check, X, ChevronDown, Upload, Lock, ExternalLink, LogOut } from "lucide-react";
import { useExportAccess } from "@/lib/exportAccess";
import { savedToken, forgetToken, savedRepo, rememberRepo, savedPath, connect, listRepos, pushFile } from "@/lib/githubClient";

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

// Push the page to the person's own GitHub repository (lib/githubClient.js). The connection
// and the repo picked for each site or game are remembered in this browser.
export default function GitHubPush({ html, siteName, plan, onUpgrade }) {
  const access = useExportAccess(plan);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(savedToken);
  const [tokenInput, setTokenInput] = useState("");
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(() => savedRepo(siteName));
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => setSelectedRepo(savedRepo(siteName)), [siteName]);
  // The file it was opened from (Open repo), else index.html. Re-read on open, since Open repo
  // may have just changed it.
  const [path, setPath] = useState(() => savedPath(siteName));
  useEffect(() => {
    if (!open) return;
    setPath(savedPath(siteName));
    setSelectedRepo(savedRepo(siteName));
    setToken(savedToken());
  }, [open, siteName]);

  useEffect(() => {
    if (!open || !token || !access.allowed || repos.length) return;
    setBusy("repos");
    setError("");
    listRepos(token)
      .then(setRepos)
      .catch((e) => {
        setError(e.message);
        if (e.status === 401) {
          forgetToken();
          setToken("");
        }
      })
      .finally(() => setBusy(""));
  }, [open, token, access.allowed, repos.length]);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    setBusy("connect");
    setError("");
    try {
      await connect(tokenInput);
      setToken(savedToken() || tokenInput.trim());
      setTokenInput("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const disconnect = () => {
    forgetToken();
    setToken("");
    setRepos([]);
    setResult("");
  };

  const handlePush = async () => {
    if (!selectedRepo || !html || busy) return;
    setBusy("push");
    setError("");
    setResult("");
    try {
      const url = await pushFile(token, selectedRepo, html, `Update ${path} from Nebulux AI`, path);
      rememberRepo(siteName, selectedRepo);
      setResult(url);
    } catch (err) {
      setError(err.message || "Push failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={access.allowed ? "Push to GitHub" : access.why}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 text-slate-200 text-sm font-medium hover:bg-slate-700/70 transition-colors"
      >
        {access.allowed ? <Github className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
        <span className="hidden sm:inline">GitHub</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-4 z-40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-slate-300" />
                <p className="text-sm font-semibold text-white">Push to GitHub</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!access.allowed ? (
              <div className="text-center py-2">
                <p className="text-slate-400 text-xs mb-3">{access.why}</p>
                <button
                  onClick={onUpgrade}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-md shadow-fuchsia-500/25 text-[#fff] text-sm font-medium hover:opacity-90"
                >
                  See plans
                </button>
              </div>
            ) : !token ? (
              <form onSubmit={handleConnect}>
                <p className="text-slate-400 text-xs">Connect once and this browser remembers it.</p>
                <ol className="mt-2 text-xs text-slate-300 list-decimal pl-4 space-y-1">
                  <li>
                    <a href={NEW_TOKEN_URL} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline inline-flex items-center gap-0.5">
                      Make a GitHub token <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Pick the repositories to allow, and set <b>Contents</b> to <b>Read and write</b>.</li>
                  <li>Copy the token and paste it here.</li>
                </ol>
                <input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="github_pat_…"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-3 w-full bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 font-mono"
                />
                <button
                  type="submit"
                  disabled={!tokenInput.trim() || !!busy}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 text-white text-sm font-medium border border-slate-600 disabled:opacity-40"
                >
                  {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />} Connect GitHub
                </button>
                <p className="mt-2 text-[11px] text-slate-500">The token stays in this browser and is only sent to GitHub.</p>
              </form>
            ) : busy === "repos" ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-1.5">Repository</p>
                <div className="relative mb-3">
                  <select
                    value={selectedRepo}
                    onChange={(e) => {
                      setSelectedRepo(e.target.value);
                      setResult("");
                    }}
                    className="w-full appearance-none bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 pr-8 text-sm text-white outline-none focus:border-indigo-500/50"
                  >
                    <option value="">Choose a repo…</option>
                    {repos.map((r) => (
                      <option key={r.full_name} value={r.full_name}>
                        {r.full_name}
                        {r.private ? " (private)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {!repos.length && <p className="text-xs text-slate-500 mb-2">No repositories yet: make one on GitHub (an empty one is fine), then reopen this.</p>}

                <button
                  onClick={handlePush}
                  disabled={!selectedRepo || !!busy || !html}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  {busy === "push" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {busy === "push" ? "Pushing…" : `Push ${path}`}
                </button>

                {result && (
                  <div className="mt-3 flex items-start gap-2 bg-emerald-900/30 border border-emerald-500/40 rounded-lg px-3 py-2">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-emerald-200">Pushed. This repo is remembered for {siteName || "this project"}.</p>
                      <a href={result} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 underline truncate block">
                        View on GitHub
                      </a>
                    </div>
                  </div>
                )}
                <button onClick={disconnect} className="mt-3 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
                  <LogOut className="w-3 h-3" /> Disconnect GitHub from this browser
                </button>
              </>
            )}

            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
