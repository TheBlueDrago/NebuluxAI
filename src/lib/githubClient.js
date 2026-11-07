// Pushes a site or game to the person's own GitHub repository straight from the browser, with
// a GitHub access token they create for it (github.com → Settings → Developer settings →
// Fine-grained tokens, "Contents: Read and write" on the repos they pick). It used to go
// through Base44's GitHub connector, which stopped with the Base44 allowance.
// The token stays in this browser (localStorage) and only ever goes to api.github.com.
const TOKEN_KEY = "bh-github-token";
const REPO_KEY = (name) => `bh-github-repo:${name || "_"}`;
const PATH_KEY = (name) => `bh-github-path:${name || "_"}`;
const API = "https://api.github.com";

const get = (k) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
const set = (k, v) => {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    // Storage blocked: the connection lasts until the page closes.
  }
};

export const savedToken = () => get(TOKEN_KEY);
export const forgetToken = () => set(TOKEN_KEY, "");
export const savedRepo = (name) => get(REPO_KEY(name));
export const rememberRepo = (name, repo) => set(REPO_KEY(name), repo);
// The file a project was opened from (Open from GitHub), so Push writes back to it.
export const savedPath = (name) => get(PATH_KEY(name)) || "index.html";
export const rememberPath = (name, path) => set(PATH_KEY(name), path === "index.html" ? "" : path);

// What went wrong, in plain words. GitHub also answers 403 for things that aren't about the token (a
// file over 1 MB read the default way, too many requests), so only real permission answers say "token".
function ghError(status, data) {
  const msg = String((data && data.message) || "");
  if (status === 401) return "GitHub didn't accept that token. It may have expired: make a new one.";
  if (status === 404 || (status === 403 && /not accessible|permission|must have|forbidden/i.test(msg)))
    return "This token can't use that repository. Give it \"Contents: Read and write\" for this repo.";
  if (status === 403 && /rate limit|secondary/i.test(msg)) return "GitHub says there have been too many requests. Wait a minute and try again.";
  if (status === 409) return "The repository changed while saving. Try again.";
  if (status === 422 && /too large|size/i.test(msg)) return "That file is too big for GitHub to take this way.";
  return msg ? `GitHub: ${msg}` : `GitHub error ${status}`;
}
async function gh(token, path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(ghError(res.status, data));
    e.status = res.status;
    e.ghMessage = data && data.message;
    throw e;
  }
  return data;
}
// "object" answers with a file's details (its sha) for files up to 100 MB; the default answer stops at 1 MB
const OBJECT = { headers: { Accept: "application/vnd.github.object+json" } };

// Checks a token and remembers it. Returns the GitHub username.
export async function connect(token) {
  const t = String(token || "").trim();
  if (!/^(github_pat_|ghp_|gho_)[A-Za-z0-9_]{20,}$/.test(t)) throw new Error("That doesn't look like a GitHub token. They start with github_pat_ or ghp_.");
  const me = await gh(t, "/user");
  set(TOKEN_KEY, t);
  return me.login;
}

export async function listRepos(token) {
  const repos = await gh(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
  return repos.filter((r) => !r.archived).map((r) => ({ full_name: r.full_name, private: r.private, branch: r.default_branch }));
}

// The repo's web pages (.html files), for Open from GitHub. Folders like node_modules are skipped.
export async function listPages(token, fullName, branch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new Error("Pick a repository.");
  const tree = await gh(token, `/repos/${fullName}/git/trees/${encodeURIComponent(branch || "HEAD")}?recursive=1`).catch((e) => {
    if (e.status === 409) return { tree: [] }; // an empty repo
    throw e;
  });
  return (tree.tree || [])
    .filter((f) => f.type === "blob" && /\.html?$/i.test(f.path) && !/(^|\/)(node_modules|\.git|vendor)\//.test(f.path) && f.size < 20_000_000)
    .map((f) => f.path)
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
    .slice(0, 300);
}

// Every file in the repo (for Nebulux Code's file list), skipping big files and folders like node_modules.
export async function listFiles(token, fullName, branch) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new Error("Pick a repository.");
  const tree = await gh(token, `/repos/${fullName}/git/trees/${encodeURIComponent(branch || "HEAD")}?recursive=1`).catch((e) => {
    if (e.status === 409) return { tree: [] };
    throw e;
  });
  return (tree.tree || [])
    .filter((f) => f.type === "blob" && !/(^|\/)(node_modules|\.git|vendor|dist|build)\//.test(f.path) && f.size < 400_000)
    .map((f) => f.path)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 1000);
}

// One text file from the repo (UTF-8). Resolves "" when it doesn't exist. Asked for "raw", so files
// over 1 MB come back too.
export async function readFile(token, fullName, path) {
  const res = await fetch(`${API}/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    headers: { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (res.status === 404) return "";
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const e = new Error(ghError(res.status, data));
    e.status = res.status;
    throw e;
  }
  return new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
}

// UTF-8 safe base64 for the contents API.
const b64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// Creates or updates a file (index.html unless told) in the repo. Returns the file's GitHub address.
export async function pushFile(token, fullName, html, message, path = "index.html") {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new Error("Pick a repository.");
  const url = `/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  // the file's current version (any size up to 100 MB); none yet means this creates it
  const current = async () => {
    try {
      return (await gh(token, url, OBJECT)).sha;
    } catch (e) {
      if (e.status === 404) return undefined;
      throw e;
    }
  };
  const content = b64(html);
  const put = async (sha) => gh(token, url, { method: "PUT", body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }) });
  let out;
  try {
    out = await put(await current());
  } catch (e) {
    // it changed in between (or GitHub wants the latest version): look again and try once more
    if (e.status !== 409 && !(e.status === 422 && /sha/i.test(e.ghMessage || ""))) throw e;
    out = await put(await current());
  }
  return out?.content?.html_url || `https://github.com/${fullName}`;
}
