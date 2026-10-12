import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FolderGit2, Loader2, X, Lock, ExternalLink, FileCode2, ChevronDown } from "lucide-react";
import { useExportAccess } from "@/lib/exportAccess";
import { askConfirm } from "@/lib/dialogs";
import { savedToken, forgetToken, connect, listRepos, listPages, readFile, rememberRepo, rememberPath } from "@/lib/githubClient";
import { inlineRepoFiles } from "@/lib/repoPage";
import useEscape from "@/hooks/useEscape";

const NEW_TOKEN_URL = "https://github.com/settings/personal-access-tokens/new";

// Website Designer, on a computer: open a page from the person's own GitHub repository so the AI
// can edit it, then push it back with the GitHub button (it remembers the repo and file).
// Same plans as Push to GitHub (Pro and up, not the trial). lib/githubClient.js does the calls.
export default function GitHubOpen({ siteName, plan, onUpgrade, hasPage, onOpen }) {
  const access = useExportAccess(plan);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState(savedToken);
  const [tokenInput, setTokenInput] = useState("");
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState("");
  const [pages, setPages] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    setToken(savedToken());
  }, [open]);

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

  const pickRepo = async (fullName) => {
    setRepo(fullName);
    setPages(null);
    setError("");
    if (!fullName) return;
    setBusy("pages");
    try {
      const r = repos.find((x) => x.full_name === fullName);
      setPages(await listPages(token, fullName, r?.branch));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

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

  const openPage = async (path) => {
    if (busy) return;
    if (hasPage && !(await askConfirm(`Open ${path} from ${repo}? It becomes the page you're editing (your current version stays in the undo history).`))) return;
    setBusy(path);
    setError("");
    try {
      const raw = await readFile(token, repo, path);
      if (!raw.trim()) throw new Error("That file is empty.");
      const { html, inlined, missing } = await inlineRepoFiles(raw, path, (p) => readFile(token, repo, p));
      rememberRepo(siteName, repo);
      rememberPath(siteName, path);
      const parts = [`Opened ${path} from ${repo}.`];
      if (inlined.length) parts.push(`Its files ${inlined.join(", ")} were put into the page so it shows here.`);
      if (missing.length) parts.push(`Not found in the repo: ${missing.join(", ")}.`);
      parts.push("Ask for changes, then use the GitHub button to push them back.");
      onOpen(html, parts.join(" "));
      setOpen(false);
    } catch (e) {
      setError(e.message || "Couldn't open that file.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {/* Computer only: editing a whole repo's pages isn't something to do on a phone. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={access.allowed ? "Open a page from your GitHub repository so the AI can edit it" : access.why}
        className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/50 text-slate-200 text-sm font-medium hover:bg-slate-700/70 transition-colors"
      >
        {access.allowed ? <FolderGit2 className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
        <span>Open repo</span>
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="bh-ghopen-title" className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5">
              <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="w-4 h-4" />
              </button>
              <h2 id="bh-ghopen-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                <FolderGit2 className="w-5 h-5 text-slate-300" /> Open from GitHub
              </h2>
              <p className="mt-1 text-sm text-slate-400">Pick a page from your repository. The AI edits it here, and the GitHub button pushes your changes back to the same file.</p>

              {!access.allowed ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-sm mb-3">{access.why}</p>
                  <button onClick={onUpgrade} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-md shadow-fuchsia-500/25 text-[#fff] text-sm font-medium hover:opacity-90">
                    See plans
                  </button>
                </div>
              ) : !token ? (
                <form onSubmit={handleConnect} className="mt-4">
                  <ol className="text-sm text-slate-300 list-decimal pl-5 space-y-1">
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
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-[#fff] text-sm font-medium disabled:opacity-40"
                  >
                    {busy === "connect" && <Loader2 className="w-4 h-4 animate-spin" />} Connect GitHub
                  </button>
                  <p className="mt-2 text-[11px] text-slate-500">The token stays in this browser and is only sent to GitHub.</p>
                </form>
              ) : busy === "repos" ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div className="mt-4 flex flex-col min-h-0">
                  <div className="relative">
                    <select
                      value={repo}
                      onChange={(e) => pickRepo(e.target.value)}
                      aria-label="Repository"
                      className="w-full appearance-none bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 pr-8 text-sm text-white outline-none focus:border-indigo-500/50"
                    >
                      <option value="">Choose a repository…</option>
                      {repos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.full_name}
                          {r.private ? " (private)" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {!repos.length && <p className="mt-2 text-xs text-slate-500">No repositories this token can use. Give it access to one on GitHub, then reopen this.</p>}
                  {busy === "pages" && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                  )}
                  {pages && !pages.length && <p className="mt-3 text-sm text-slate-400">This repository has no .html pages yet. Build one here and push it to start.</p>}
                  {pages && pages.length > 0 && (
                    <ul className="mt-3 overflow-y-auto min-h-0 max-h-[45vh] rounded-lg border border-slate-800 divide-y divide-slate-800">
                      {pages.map((p) => (
                        <li key={p}>
                          <button
                            type="button"
                            onClick={() => openPage(p)}
                            disabled={!!busy}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {busy === p ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <FileCode2 className="w-4 h-4 text-slate-400 shrink-0" />}
                            <span className="font-mono truncate">{p}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
