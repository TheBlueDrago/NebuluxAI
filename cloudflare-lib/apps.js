// Connectors shared by Nebulux AI and Nebulux Orbit (functions/v1/connect.js): one connection per
// person and app, kept in the orbit_connections table both use, so an app connected in one works in
// the other. Google's apps and GitHub keep their own flows (functions/v1/orbit.js, orbit-google/,
// github/callback/orbit.js); this file has every other app.
//
// Each app here needs the owner to make a developer app at that company and set two secrets on the
// Nebulux AI Pages project: <ENV>_CLIENT_ID and <ENV>_CLIENT_SECRET (docs/connectors-setup.md), with
// https://nebuluxai.com/v1/connect/callback as its redirect address. Until both are set the app shows
// "Coming soon" and nothing is sent anywhere.
//
// What's kept: the app's permission (access and refresh tokens, plus a Discord channel's webhook),
// sealed (seal.js) and tied to the person and app. Reading is what the person (or the AI, for them)
// asks to see; anything that posts or sends runs only with { confirmed: true } after they press Send.
import { seal, unseal } from "./seal.js";

export const CALLBACK = "https://nebuluxai.com/v1/connect/callback";
const UA = "Nebulux/1.0 (+https://nebuluxai.com)";

// ---- small helpers ----
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "")).toString();
const clip = (s, n = 140) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const day = (d) => { const t = new Date(d); return isNaN(t) ? "" : t.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC"; };
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const km = (m) => (m / 1000).toFixed(1) + " km";
const mins = (s) => Math.round(s / 60) + " min";
async function j(url, init = {}) {
  const r = await fetch(url, init).catch(() => null);
  if (!r) return { ok: false, status: 0, data: null };
  const text = await r.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}
const bearer = (tok, more = {}) => ({ headers: { Authorization: "Bearer " + tok, "User-Agent": UA, ...more } });
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const basic = (id, secret) => "Basic " + b64(id + ":" + secret);
// PKCE (X asks for it)
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const verifier = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
export const challenge = async (v) => b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));
const sec = (title, items) => ({ title, items: items.filter(Boolean) });
const item = (t, s, more) => ({ t: clip(t, 160), ...(s ? { s: clip(s, 200) } : {}), ...(more || {}) });
// The words of a chat question worth searching an app for ("what's in my Notion notes about the science
// fair?" -> "science fair"); "" when nothing is left. app: the app's own name, taken out too.
const NOT_SEARCH = /\b(what'?s|what|whats|is|are|was|were|in|on|at|of|about|for|from|to|my|me|i|the|a|an|and|or|any|do|does|did|have|has|show|find|tell|give|read|check|look|see|search|summari[sz]e|please|can|could|you|notes?|pages?|docs?|documents?|files?|write|written|wrote|there|it|this|that|with)\b/gi;
export const searchWords = (q, app) => String(q || "").replace(app || /$^/, " ").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(NOT_SEARCH, " ").replace(/\s+/g, " ").trim().split(" ").filter((w) => w.length > 1).slice(0, 5).join(" ");
// A Notion page's blocks as lines of text (headings, paragraphs, lists, to-dos, quotes).
const notionLines = (blocks) => blocks.map((b) => {
  const v = b && b[b.type];
  const text = ((v && v.rich_text) || []).map((r) => r.plain_text || "").join("").trim();
  if (!text) return "";
  return b.type === "to_do" ? (v.checked ? "[x] " : "[ ] ") + text : /^heading_/.test(b.type) ? text.toUpperCase() : text;
}).filter(Boolean);

// A failed read: 401/403 means the permission is gone (reconnect); anything else is "try again".
class AppError extends Error { constructor(status, msg) { super(msg || "app " + status); this.status = status; } }
const need = (r) => { if (!r.ok) throw new AppError(r.status); return r.data; };

// ---- the apps ----
// auth: the company's permission page; token: where the code is swapped; scope (as that company joins them);
// basic: client id and secret go in a Basic header instead of the body (idInBody: the id goes in both); pkce; idKey: the name of the
// client id parameter (TikTok calls it client_key); account(tok, t): the name shown as "Connected as";
// read(tok, x): what Nebulux shows and the AI reads; write: what can be sent (always after Send).
const MS = "https://graph.microsoft.com/v1.0";
const msAuth = (scope) => ({ env: "MICROSOFT", auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scope: "offline_access User.Read " + scope, extra: { response_mode: "query", prompt: "select_account" }, refreshScope: true,
  account: async (tok) => { const d = (await j(MS + "/me", bearer(tok))).data || {}; return d.mail || d.userPrincipalName || d.displayName || ""; } });

export const APPS = {
  notion: {
    n: "Notion", cat: "Productivity", about: "Search and read your Notion pages",
    env: "NOTION", auth: "https://api.notion.com/v1/oauth/authorize", token: "https://api.notion.com/v1/oauth/token", extra: { owner: "user" }, basic: true, json: true,
    account: (tok, t) => (t && (t.workspace_name || (t.owner && t.owner.user && t.owner.user.name))) || "",
    // q: the chat question. Its key words search the pages, and the two best pages are read, so
    // "what's in my Notion notes about the science fair" sees what the notes say, not only their titles.
    read: async (tok, x, env, q) => {
      const H = bearer(tok, { "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
      const search = (query) => j("https://api.notion.com/v1/search", { method: "POST", ...H, body: JSON.stringify({ ...(query ? { query } : {}), sort: { direction: "descending", timestamp: "last_edited_time" }, page_size: 12 }) });
      const words = searchWords(q, /\bnotion\b/gi);
      let d = need(await search(words));
      const found = !!words && (d.results || []).length > 0;
      if (words && !found) d = need(await search(""));
      const title = (p) => { const props = p.properties || {}; const tp = Object.values(props).find((v) => v && v.type === "title"); const arr = (tp && tp.title) || p.title || []; return arr.map((x) => x.plain_text || "").join("") || "Untitled"; };
      const list = sec(found ? `Pages about "${words}"` : "Recently edited", (d.results || []).map((p) => item(title(p), (p.object === "database" ? "Database · " : "") + "edited " + day(p.last_edited_time), { u: p.url })));
      if (!found) return [list];
      const pages = await Promise.all((d.results || []).filter((p) => p.object === "page").slice(0, 2).map(async (p) => {
        const b = await j(`https://api.notion.com/v1/blocks/${p.id}/children?page_size=60`, H);
        return sec("In " + title(p), notionLines((b.data && b.data.results) || []).slice(0, 14).map((l) => item(l)));
      }));
      return [list, ...pages];
    },
  },
  slack: {
    n: "Slack", cat: "Business", about: "Read your channels; send messages you approve",
    env: "SLACK", auth: "https://slack.com/oauth/v2/authorize", token: "https://slack.com/api/oauth.v2.access", scopeKey: "user_scope",
    scope: "channels:read,channels:history,groups:read,groups:history,users:read,chat:write",
    // Slack puts the person's own permission under authed_user
    fromToken: (t) => (t && t.authed_user && t.authed_user.access_token ? { access_token: t.authed_user.access_token, refresh_token: t.authed_user.refresh_token, expires_in: t.authed_user.expires_in, team: t.team && t.team.name } : t),
    okIf: (t) => t && t.ok !== false,
    account: (tok, t) => (t && t.team) || "",
    read: async (tok) => {
      const api = (m, q) => j(`https://slack.com/api/${m}?${qs(q)}`, bearer(tok)).then((r) => { if (!r.data || r.data.ok === false) throw new AppError(r.data && /invalid_auth|token_revoked|not_authed|account_inactive/.test(r.data.error) ? 401 : 502); return r.data; });
      const chans = ((await api("conversations.list", { types: "public_channel,private_channel", exclude_archived: "true", limit: 100 })).channels || []).filter((c) => c.is_member).slice(0, 20);
      const out = [sec("Channels you're in", chans.map((c) => item("#" + c.name, c.topic && c.topic.value, { id: c.id })))];
      for (const c of chans.slice(0, 3)) {
        const h = await api("conversations.history", { channel: c.id, limit: 5 }).catch(() => null);
        if (h && h.messages && h.messages.length) out.push(sec("Latest in #" + c.name, h.messages.map((m) => item(m.text || "(attachment)", day(+m.ts * 1000)))));
      }
      return out;
    },
    // where: a channel's id, or its name ("#general", from a chat draft), looked up among the ones they're in
    write: { send: { label: "Send a message", where: "channel", run: async (tok, x, b) => {
      let channel = String(b.where || "").trim();
      if (!/^[CGD][A-Z0-9]{6,}$/.test(channel)) {
        const want = channel.replace(/^#/, "").toLowerCase();
        const l = await j("https://slack.com/api/conversations.list?" + qs({ types: "public_channel,private_channel", exclude_archived: "true", limit: 200 }), bearer(tok));
        const hit = ((l.data && l.data.channels) || []).find((c) => c.is_member && String(c.name).toLowerCase() === want);
        if (!hit) return false;
        channel = hit.id;
      }
      const r = await j("https://slack.com/api/chat.postMessage", { method: "POST", ...bearer(tok, { "Content-Type": "application/json; charset=utf-8" }), body: JSON.stringify({ channel, text: String(b.text || "").slice(0, 4000) }) });
      return !!(r.data && r.data.ok);
    } } },
  },
  spotify: {
    n: "Spotify", cat: "Social & Entertainment", about: "What you're playing, your top artists and playlists",
    env: "SPOTIFY", auth: "https://accounts.spotify.com/authorize", token: "https://accounts.spotify.com/api/token", basic: true,
    scope: "user-read-currently-playing user-read-recently-played user-top-read playlist-read-private",
    account: async (tok) => { const d = (await j("https://api.spotify.com/v1/me", bearer(tok))).data || {}; return d.display_name || d.id || ""; },
    read: async (tok) => {
      const g = (p) => j("https://api.spotify.com/v1/" + p, bearer(tok));
      const [now, recent, top, lists] = await Promise.all([g("me/player/currently-playing"), g("me/player/recently-played?limit=10"), g("me/top/artists?limit=8&time_range=short_term"), g("me/playlists?limit=10")]);
      if (recent.status === 401) throw new AppError(401);
      const artists = (t) => ((t && t.artists) || []).map((a) => a.name).join(", ");
      return [
        now.data && now.data.item ? sec("Playing now", [item(now.data.item.name, artists(now.data.item))]) : null,
        sec("Recently played", ((recent.data && recent.data.items) || []).map((i) => item(i.track && i.track.name, artists(i.track)))),
        sec("Your top artists lately", ((top.data && top.data.items) || []).map((a) => item(a.name, (a.genres || []).slice(0, 3).join(", ")))),
        sec("Your playlists", ((lists.data && lists.data.items) || []).map((p) => item(p.name, ((p.tracks && p.tracks.total) || 0) + " songs"))),
      ].filter(Boolean);
    },
  },
  discord: {
    n: "Discord", cat: "Social & Entertainment", about: "Your servers; post to a channel you pick",
    env: "DISCORD", auth: "https://discord.com/oauth2/authorize", token: "https://discord.com/api/v10/oauth2/token", scope: "identify guilds webhook.incoming", extra: { prompt: "consent" },
    // The channel picked on Discord's own page comes back as a webhook Nebulux can post to.
    keep: (t) => (t && t.webhook ? { hook: t.webhook.url, hookName: t.webhook.name, channel: t.webhook.channel_id } : {}),
    account: async (tok) => { const d = (await j("https://discord.com/api/v10/users/@me", bearer(tok))).data || {}; return d.global_name || d.username || ""; },
    read: async (tok, x) => {
      const g = need(await j("https://discord.com/api/v10/users/@me/guilds", bearer(tok)));
      return [x.hook ? sec("Posts go to", [item(x.hookName ? "Channel via " + x.hookName : "The channel you picked", "Pick a different one by reconnecting")]) : null, sec("Your servers", (g || []).slice(0, 25).map((s) => item(s.name, s.owner ? "You own it" : "")))].filter(Boolean);
    },
    write: { post: { label: "Post to your channel", run: async (tok, x, b) => { if (!x.hook) return false; const r = await j(x.hook + "?wait=true", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify({ content: String(b.text || "").slice(0, 2000), allowed_mentions: { parse: [] } }) }); return r.ok; } } },
  },
  x: {
    n: "X", cat: "Social & Entertainment", about: "Your profile and posts; post what you approve",
    env: "X", auth: "https://x.com/i/oauth2/authorize", token: "https://api.x.com/2/oauth2/token", basic: true, idInBody: true, pkce: true,
    scope: "tweet.read users.read tweet.write offline.access",
    account: async (tok) => { const d = (await j("https://api.x.com/2/users/me", bearer(tok))).data || {}; return d.data ? "@" + d.data.username : ""; },
    read: async (tok) => {
      const me = need(await j("https://api.x.com/2/users/me?user.fields=description,public_metrics", bearer(tok))).data || {};
      const pm = me.public_metrics || {};
      const posts = await j(`https://api.x.com/2/users/${me.id}/tweets?max_results=5&tweet.fields=created_at`, bearer(tok));
      return [sec("Your profile", [item("@" + me.username + (me.name ? " (" + me.name + ")" : ""), [me.description, pm.followers_count != null ? pm.followers_count + " followers" : ""].filter(Boolean).join(" · "))]), sec("Your latest posts", ((posts.data && posts.data.data) || []).map((p) => item(p.text, day(p.created_at))))];
    },
    write: { post: { label: "Post", run: async (tok, x, b) => (await j("https://api.x.com/2/tweets", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: JSON.stringify({ text: String(b.text || "").slice(0, 280) }) })).ok } },
  },
  reddit: {
    n: "Reddit", cat: "Social & Entertainment", about: "Your communities and saved posts",
    env: "REDDIT", auth: "https://www.reddit.com/api/v1/authorize", token: "https://www.reddit.com/api/v1/access_token", basic: true, extra: { duration: "permanent" },
    scope: "identity read mysubreddits history",
    account: async (tok) => { const d = (await j("https://oauth.reddit.com/api/v1/me", bearer(tok))).data || {}; return d.name ? "u/" + d.name : ""; },
    read: async (tok) => {
      const me = need(await j("https://oauth.reddit.com/api/v1/me", bearer(tok))) || {};
      const [subs, saved] = await Promise.all([j("https://oauth.reddit.com/subreddits/mine/subscriber?limit=25", bearer(tok)), j(`https://oauth.reddit.com/user/${encodeURIComponent(me.name || "me")}/saved?limit=10`, bearer(tok))]);
      const kids = (r) => ((r.data && r.data.data && r.data.data.children) || []).map((c) => c.data || {});
      return [sec("Your communities", kids(subs).map((s) => item("r/" + s.display_name, s.public_description))), sec("Saved", kids(saved).map((p) => item(p.title || p.body || p.link_title, "r/" + p.subreddit)))];
    },
  },
  pinterest: {
    n: "Pinterest", cat: "Social & Entertainment", about: "Your boards and pins",
    env: "PINTEREST", auth: "https://www.pinterest.com/oauth/", token: "https://api.pinterest.com/v5/oauth/token", basic: true,
    scope: "user_accounts:read,boards:read,pins:read",
    account: async (tok) => ((await j("https://api.pinterest.com/v5/user_account", bearer(tok))).data || {}).username || "",
    read: async (tok) => {
      const b = need(await j("https://api.pinterest.com/v5/boards?page_size=12", bearer(tok)));
      const p = await j("https://api.pinterest.com/v5/pins?page_size=10", bearer(tok));
      return [sec("Your boards", ((b && b.items) || []).map((x) => item(x.name, x.pin_count != null ? x.pin_count + " pins" : x.description))), sec("Your latest pins", ((p.data && p.data.items) || []).map((x) => item(x.title || x.description || "Pin", x.link || "")))];
    },
  },
  tiktok: {
    n: "TikTok", cat: "Social & Entertainment", about: "Your profile and videos",
    env: "TIKTOK", idKey: "client_key", auth: "https://www.tiktok.com/v2/auth/authorize/", token: "https://open.tiktokapis.com/v2/oauth/token/",
    scope: "user.info.basic,video.list",
    account: async (tok) => ((((await j("https://open.tiktokapis.com/v2/user/info/?fields=display_name", bearer(tok))).data || {}).data || {}).user || {}).display_name || "",
    read: async (tok) => {
      const v = need(await j("https://open.tiktokapis.com/v2/video/list/?fields=title,video_description,create_time,view_count,like_count", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: JSON.stringify({ max_count: 12 }) }));
      return [sec("Your videos", (((v && v.data) || {}).videos || []).map((x) => item(x.title || x.video_description || "Video", [x.view_count != null ? x.view_count + " views" : "", x.like_count != null ? x.like_count + " likes" : "", x.create_time ? day(x.create_time * 1000) : ""].filter(Boolean).join(" · "))))];
    },
  },
  instagram: {
    n: "Instagram", cat: "Social & Entertainment", about: "Your profile and posts (business or creator accounts)",
    env: "INSTAGRAM", auth: "https://www.instagram.com/oauth/authorize", token: "https://api.instagram.com/oauth/access_token", scope: "instagram_business_basic",
    fromToken: (t) => (Array.isArray(t && t.data) ? t.data[0] : t),
    // The first permission lasts an hour; it's swapped for one that lasts 60 days, renewed as it's used.
    upgrade: async (env, t) => { const r = await j(`https://graph.instagram.com/access_token?${qs({ grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_CLIENT_SECRET, access_token: t.access_token })}`); return r.ok && r.data && r.data.access_token ? { ...t, access_token: r.data.access_token, expires_in: r.data.expires_in } : t; },
    renew: async (env, b) => { const r = await j(`https://graph.instagram.com/refresh_access_token?${qs({ grant_type: "ig_refresh_token", access_token: b.a })}`); return r.ok && r.data && r.data.access_token ? { access_token: r.data.access_token, expires_in: r.data.expires_in } : null; },
    account: async (tok) => { const d = (await j("https://graph.instagram.com/me?fields=username&access_token=" + encodeURIComponent(tok))).data || {}; return d.username ? "@" + d.username : ""; },
    read: async (tok) => {
      const me = need(await j("https://graph.instagram.com/me?fields=username,media_count,followers_count&access_token=" + encodeURIComponent(tok))) || {};
      const m = await j("https://graph.instagram.com/me/media?fields=caption,media_type,timestamp,like_count,comments_count&limit=10&access_token=" + encodeURIComponent(tok));
      return [sec("Your profile", [item("@" + me.username, [me.followers_count != null ? me.followers_count + " followers" : "", me.media_count != null ? me.media_count + " posts" : ""].filter(Boolean).join(" · "))]), sec("Your latest posts", ((m.data && m.data.data) || []).map((p) => item(p.caption || String(p.media_type || "Post").toLowerCase(), [p.like_count != null ? p.like_count + " likes" : "", p.comments_count != null ? p.comments_count + " comments" : "", day(p.timestamp)].filter(Boolean).join(" · "))))];
    },
  },
  dropbox: {
    n: "Dropbox", cat: "Productivity", about: "See your files and folders",
    env: "DROPBOX", auth: "https://www.dropbox.com/oauth2/authorize", token: "https://api.dropboxapi.com/oauth2/token", extra: { token_access_type: "offline" },
    account: async (tok) => { const d = (await j("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: "null" })).data || {}; return d.email || (d.name && d.name.display_name) || ""; },
    // q: the chat question. "find my tax files in Dropbox" searches for "tax"; otherwise the top folder.
    read: async (tok, x, env, q) => {
      const H = bearer(tok, { "Content-Type": "application/json" });
      const row = (f) => item((f[".tag"] === "folder" ? "Folder: " : "") + (f.path_display || f.name), f.server_modified ? "changed " + day(f.server_modified) : "");
      const words = searchWords(q, /\bdrop ?box\b/gi);
      if (words) {
        const s = need(await j("https://api.dropboxapi.com/2/files/search_v2", { method: "POST", ...H, body: JSON.stringify({ query: words, options: { max_results: 20 } }) }));
        const hits = (s.matches || []).map((m) => m.metadata && m.metadata.metadata).filter(Boolean);
        if (hits.length) return [sec(`Files matching "${words}"`, hits.map(row))];
      }
      const d = need(await j("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", ...H, body: JSON.stringify({ path: "", limit: 30 }) }));
      const e = (d.entries || []).sort((a, b) => String(b.server_modified || "").localeCompare(String(a.server_modified || "")));
      return [sec("Your Dropbox", e.slice(0, 25).map((f) => item((f[".tag"] === "folder" ? "Folder: " : "") + f.name, f.server_modified ? "changed " + day(f.server_modified) : "")))];
    },
  },
  outlook: {
    n: "Outlook", cat: "Productivity", about: "Your Outlook email and calendar",
    ...msAuth("Mail.Read Calendars.Read"),
    read: async (tok) => {
      const now = Date.now();
      const [mail, cal] = await Promise.all([j(MS + "/me/messages?$top=10&$select=subject,from,receivedDateTime,bodyPreview,isRead&$orderby=receivedDateTime desc", bearer(tok)), j(`${MS}/me/calendarView?${qs({ startDateTime: new Date(now).toISOString(), endDateTime: new Date(now + 7 * 864e5).toISOString(), $top: 10, $select: "subject,start,end,location", $orderby: "start/dateTime" })}`, bearer(tok, { Prefer: 'outlook.timezone="UTC"' }))]);
      if (mail.status === 401) throw new AppError(401);
      return [sec("Latest emails", ((mail.data && mail.data.value) || []).map((m) => item((m.isRead ? "" : "(unread) ") + (m.subject || "(no subject)"), [m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address), m.bodyPreview].filter(Boolean).join(": ")))), sec("Next 7 days", ((cal.data && cal.data.value) || []).map((e) => item(e.subject || "(no title)", [day(e.start && e.start.dateTime + "Z"), e.location && e.location.displayName].filter(Boolean).join(" · "))))];
    },
  },
  onedrive: {
    n: "OneDrive", cat: "Productivity", about: "See your OneDrive files",
    ...msAuth("Files.Read"),
    read: async (tok) => {
      const d = need(await j(MS + "/me/drive/root/children?$top=30&$select=name,lastModifiedDateTime,folder,size", bearer(tok)));
      const v = (d.value || []).sort((a, b) => String(b.lastModifiedDateTime).localeCompare(String(a.lastModifiedDateTime)));
      return [sec("Your OneDrive", v.slice(0, 25).map((f) => item((f.folder ? "Folder: " : "") + f.name, "changed " + day(f.lastModifiedDateTime))))];
    },
  },
  mstodo: {
    n: "Microsoft To Do", cat: "Productivity", about: "See your to-do lists",
    ...msAuth("Tasks.Read"),
    read: async (tok) => {
      const lists = (need(await j(MS + "/me/todo/lists", bearer(tok))).value || []).slice(0, 5);
      const out = [];
      for (const l of lists) {
        const t = await j(`${MS}/me/todo/lists/${l.id}/tasks?$filter=status ne 'completed'&$top=15`, bearer(tok));
        const items = ((t.data && t.data.value) || []).map((x) => item(x.title, x.dueDateTime ? "due " + String(x.dueDateTime.dateTime).slice(0, 10) : ""));
        if (items.length) out.push(sec(l.displayName, items));
      }
      return out.length ? out : [sec("To Do", [item("Nothing left to do", "")])];
    },
  },
  todoist: {
    n: "Todoist", cat: "Productivity", about: "Your tasks; add ones you approve",
    env: "TODOIST", auth: "https://todoist.com/oauth/authorize", token: "https://todoist.com/oauth/access_token", scope: "data:read_write",
    account: () => "",
    read: async (tok) => {
      const d = need(await j("https://api.todoist.com/api/v1/tasks?limit=30", bearer(tok)));
      const list = Array.isArray(d) ? d : d.results || [];
      return [sec("Your tasks", list.slice(0, 30).map((t) => item(t.content, [t.due && (t.due.string || t.due.date), t.priority > 1 ? "priority " + (5 - t.priority) : ""].filter(Boolean).join(" · "))))];
    },
    write: { add: { label: "Add a task", run: async (tok, x, b) => (await j("https://api.todoist.com/api/v1/tasks", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: JSON.stringify({ content: String(b.text || "").slice(0, 500), ...(b.due || b.where ? { due_string: String(b.due || b.where).slice(0, 60) } : {}) }) })).ok } },
  },
  asana: {
    n: "Asana", cat: "Business", about: "Tasks assigned to you",
    env: "ASANA", auth: "https://app.asana.com/-/oauth_authorize", token: "https://app.asana.com/-/oauth_token",
    account: async (tok) => (((await j("https://app.asana.com/api/1.0/users/me", bearer(tok))).data || {}).data || {}).email || "",
    read: async (tok) => {
      const me = (need(await j("https://app.asana.com/api/1.0/users/me?opt_fields=name,workspaces.name", bearer(tok))) || {}).data || {};
      const out = [];
      for (const w of (me.workspaces || []).slice(0, 3)) {
        const t = await j(`https://app.asana.com/api/1.0/tasks?${qs({ assignee: "me", workspace: w.gid, completed_since: "now", opt_fields: "name,due_on", limit: 25 })}`, bearer(tok));
        const items = ((t.data && t.data.data) || []).map((x) => item(x.name, x.due_on ? "due " + x.due_on : ""));
        if (items.length) out.push(sec("Your tasks in " + w.name, items));
      }
      return out.length ? out : [sec("Your tasks", [item("Nothing assigned to you", "")])];
    },
  },
  linear: {
    n: "Linear", cat: "Business", about: "Issues assigned to you",
    env: "LINEAR", auth: "https://linear.app/oauth/authorize", token: "https://api.linear.app/oauth/token", scope: "read",
    account: async (tok) => ((((await j("https://api.linear.app/graphql", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: JSON.stringify({ query: "{ viewer { email name } }" }) })).data || {}).data || {}).viewer || {}).email || "",
    read: async (tok) => {
      const d = need(await j("https://api.linear.app/graphql", { method: "POST", ...bearer(tok, { "Content-Type": "application/json" }), body: JSON.stringify({ query: "{ viewer { assignedIssues(first: 20, filter: { completedAt: { null: true }, canceledAt: { null: true } }) { nodes { identifier title dueDate state { name } } } } }" }) }));
      const nodes = (((d && d.data && d.data.viewer) || {}).assignedIssues || {}).nodes || [];
      return [sec("Your open issues", nodes.map((i) => item(i.identifier + " " + i.title, [i.state && i.state.name, i.dueDate ? "due " + i.dueDate : ""].filter(Boolean).join(" · "))))];
    },
  },
  zoom: {
    n: "Zoom", cat: "Business", about: "Your upcoming meetings",
    env: "ZOOM", auth: "https://zoom.us/oauth/authorize", token: "https://zoom.us/oauth/token", basic: true,
    account: async (tok) => ((await j("https://api.zoom.us/v2/users/me", bearer(tok))).data || {}).email || "",
    read: async (tok) => {
      const d = need(await j("https://api.zoom.us/v2/users/me/meetings?type=upcoming&page_size=15", bearer(tok)));
      return [sec("Upcoming meetings", (d.meetings || []).map((m) => item(m.topic || "Meeting", [day(m.start_time), m.duration ? m.duration + " min" : ""].filter(Boolean).join(" · "))))];
    },
  },
  twitch: {
    n: "Twitch", cat: "Social & Entertainment", about: "Who's live from the channels you follow",
    env: "TWITCH", auth: "https://id.twitch.tv/oauth2/authorize", token: "https://id.twitch.tv/oauth2/token", scope: "user:read:follows",
    account: async (tok, t, env) => ((((await j("https://api.twitch.tv/helix/users", bearer(tok, { "Client-Id": env.TWITCH_CLIENT_ID }))).data || {}).data || [])[0] || {}).display_name || "",
    read: async (tok, x, env) => {
      const h = (p) => j("https://api.twitch.tv/helix/" + p, bearer(tok, { "Client-Id": String(env.TWITCH_CLIENT_ID || "").trim() }));
      const me = ((need(await h("users")) || {}).data || [])[0] || {};
      const [live, follows] = await Promise.all([h("streams/followed?user_id=" + me.id), h("channels/followed?first=20&user_id=" + me.id)]);
      return [sec("Live now", ((live.data && live.data.data) || []).map((s) => item(s.user_name + ": " + s.title, [s.game_name, s.viewer_count + " watching"].filter(Boolean).join(" · ")))), sec("Channels you follow", ((follows.data && follows.data.data) || []).map((c) => item(c.broadcaster_name, "")))];
    },
  },
};
// Apps that need no developer app: WhatsApp drafts open in WhatsApp itself (wa.me), sent by the person.
export const LINK_APPS = { whatsapp: { n: "WhatsApp", cat: "Business", about: "Send a reply or draft to a chat in WhatsApp" } };
// Google's (connected through the Google flow in functions/v1/orbit.js) and GitHub, for the lists.
export const GOOGLE_APPS = {
  gmail: { n: "Gmail", cat: "Productivity", about: "Read your emails" },
  calendar: { n: "Google Calendar", cat: "Productivity", about: "See your events" },
  drive: { n: "Google Drive", cat: "Productivity", about: "See your files" },
  tasks: { n: "Google Tasks", cat: "Productivity", about: "See your to-do lists" },
  youtube: { n: "YouTube", cat: "Social & Entertainment", about: "Your subscriptions and playlists" },
  contacts: { n: "Google Contacts", cat: "Productivity", about: "Find people's email addresses" },
};
export const GITHUB_APP = { github: { n: "GitHub", cat: "Business", about: "Your repositories, issues and pull requests" } };
export const nameOf = (k) => (APPS[k] || LINK_APPS[k] || GOOGLE_APPS[k] || GITHUB_APP[k] || {}).n || k;

const ids = (env, p) => [String(env[p.env + "_CLIENT_ID"] || "").trim(), String(env[p.env + "_CLIENT_SECRET"] || "").trim()];
// Set up: the owner made the developer app and set both secrets.
export const isReady = (env, k) => { const p = APPS[k]; if (!p) return false; const [id, secret] = ids(env || {}, p); return !!(id && secret); };

// Step 1: the address of the app's own permission page. A one-time state (10 minutes) remembers who is
// connecting, where to go back to and, for PKCE, the verifier.
export async function startUrl(env, db, uid, k, back) {
  const p = APPS[k];
  const [id] = ids(env, p);
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const v = p.pkce ? verifier() : "-";
  await db.prepare("INSERT INTO orbit_states (state, user_id, back, exp) VALUES (?, ?, ?, ?)").bind(state, uid, `app:${k} ${v} ${back}`, Date.now() + 600000).run();
  const u = new URL(p.auth);
  const params = { [p.idKey || "client_id"]: id, redirect_uri: CALLBACK, response_type: "code", state, ...(p.scope ? { [p.scopeKey || "scope"]: p.scope } : {}), ...(p.extra || {}) };
  if (p.pkce) Object.assign(params, { code_challenge: await challenge(v), code_challenge_method: "S256" });
  for (const [a, b] of Object.entries(params)) u.searchParams.set(a, b);
  return u.toString();
}

// The app's answer when a code or refresh token is swapped; null when it said no.
async function tokenCall(env, p, form) {
  const [id, secret] = ids(env, p);
  const idKey = p.idKey || "client_id";
  const headers = { "User-Agent": UA, Accept: "application/json" };
  let body;
  if (p.basic) { headers.Authorization = basic(id, secret); if (p.idInBody) form[idKey] = id; }
  else Object.assign(form, { [idKey]: id, client_secret: secret });
  if (p.json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(form); }
  else { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
  const r = await j(p.token, { method: "POST", headers, body });
  let t = r.data && typeof r.data === "object" ? r.data : null;
  if (t && p.fromToken) t = p.fromToken(t);
  if (!r.ok || !t || (p.okIf && !p.okIf(r.data)) || !t.access_token) return { error: (r.data && (r.data.error || r.data.message)) || "failed", status: r.status };
  return t;
}
// What's kept for a connection: a = access, r = refresh, e = when the access stops working, x = extras.
const bundle = (t, old = {}) => ({ a: t.access_token, r: t.refresh_token || old.r || "", e: t.expires_in ? Date.now() + (+t.expires_in - 60) * 1000 : 0, x: old.x || {} });
const bind = (uid, k) => uid + "|" + k;

// Step 2 (functions/v1/connect/callback.js): swap the code, find out whose account it is, keep it sealed.
export async function finish(env, db, k, uid, code, v) {
  const p = APPS[k];
  let t = await tokenCall(env, p, { grant_type: "authorization_code", code, redirect_uri: CALLBACK, ...(p.pkce && v && v !== "-" ? { code_verifier: v } : {}) });
  if (t.error) return { error: t.error };
  if (p.upgrade) t = await p.upgrade(env, t);
  const b = bundle(t);
  b.x = p.keep ? p.keep(t) : {};
  let account = "";
  try { account = String((await p.account(b.a, t, env)) || ""); } catch {}
  const sealed = await seal(env, JSON.stringify(b), bind(uid, k));
  await db.prepare("INSERT INTO orbit_connections (user_id, provider, refresh, email, at, scopes, status) VALUES (?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(user_id, provider) DO UPDATE SET refresh = excluded.refresh, email = excluded.email, at = excluded.at, scopes = excluded.scopes, status = NULL")
    .bind(uid, k, sealed, account.slice(0, 200), Date.now(), String(t.scope || p.scope || "").slice(0, 1000)).run();
  return { ok: true, account };
}

const markReconnect = (db, uid, k) => db.prepare("UPDATE orbit_connections SET status = 'reconnect' WHERE user_id = ? AND provider = ?").bind(uid, k).run().catch(() => {});
// A working permission for one app: { token, x, account } or { status: "none" | "reconnect" | "down" }.
// An expired one is renewed with its refresh token (and the renewed one kept).
export async function appAccess(env, db, uid, k) {
  const p = APPS[k];
  if (!p) return { status: "none" };
  const c = await db.prepare("SELECT refresh, email, status FROM orbit_connections WHERE user_id = ? AND provider = ?").bind(uid, k).first();
  if (!c) return { status: "none" };
  let b = null;
  try { b = JSON.parse((await unseal(env, c.refresh, bind(uid, k))) || "null"); } catch {}
  if (!b || !b.a) { await markReconnect(db, uid, k); return { status: "reconnect" }; }
  if (b.e && b.e < Date.now()) {
    let t = null;
    if (p.renew) t = await p.renew(env, b);
    else if (b.r) { const r = await tokenCall(env, p, { grant_type: "refresh_token", refresh_token: b.r, ...(p.refreshScope ? { scope: p.scope } : {}) }); t = r.error ? (r.status >= 400 && r.status < 500 ? null : "down") : r; }
    if (t === "down") return { status: "down" };
    if (!t) { await markReconnect(db, uid, k); return { status: "reconnect" }; }
    b = { ...bundle(t, b), x: b.x || {} };
    try { await db.prepare("UPDATE orbit_connections SET refresh = ?, status = NULL WHERE user_id = ? AND provider = ?").bind(await seal(env, JSON.stringify(b), bind(uid, k)), uid, k).run(); } catch {}
  }
  return { token: b.a, x: b.x || {}, account: c.email || "" };
}

// Read one app: { app, account, sections } (or { error, reconnect }).
// q (optional): the chat question, for apps that can search for it (Notion).
export async function readApp(env, db, uid, k, q = "") {
  const a = await appAccess(env, db, uid, k);
  if (!a.token) return gone(k, a.status);
  try {
    return { app: k, name: nameOf(k), account: a.account, sections: (await APPS[k].read(a.token, a.x, env, q)).filter((s) => s && s.items && s.items.length) };
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) { await markReconnect(db, uid, k); return gone(k, "reconnect"); }
    return gone(k, "down");
  }
}
const gone = (k, status) => ({ app: k, name: nameOf(k), status, error: status === "reconnect" ? `${nameOf(k)} needs reconnecting (Connectors → ${nameOf(k)} → Reconnect).` : status === "down" ? `Couldn't reach ${nameOf(k)} just now. Try again in a moment.` : `Connect ${nameOf(k)} first (Connectors).` });

// Send or post something the person approved (they pressed Send).
export async function writeApp(env, db, uid, k, op, body) {
  const w = APPS[k] && APPS[k].write && APPS[k].write[op];
  if (!w) return { error: "That can't be sent from here." };
  if (!body || body.confirmed !== true) return { error: "Nothing is sent until you press Send." };
  if (!String(body.text || "").trim()) return { error: "Write something to send first." };
  const a = await appAccess(env, db, uid, k);
  if (!a.token) return gone(k, a.status);
  return (await w.run(a.token, a.x, body).catch(() => false)) ? { ok: true } : { error: `${nameOf(k)} didn't take it. Try again in a moment.` };
}
export const writesOf = (k) => Object.entries((APPS[k] && APPS[k].write) || {}).map(([op, w]) => ({ op, label: w.label, where: w.where || "" }));

// A read as plain text for the AI (kept short so it fits in the prompt).
export function readText(r, max = 3500) {
  if (!r || r.error) return (r && r.error) || "";
  let s = `${r.name}${r.account ? " (" + r.account + ")" : ""}:\n`;
  for (const x of r.sections || []) s += `${x.title}:\n` + x.items.map((i) => "- " + i.t + (i.s ? " (" + i.s + ")" : "")).join("\n") + "\n";
  return s.length > max ? s.slice(0, max - 1) + "…" : s.trim();
}

// ---- Google Contacts, and the Google apps and GitHub for Nebulux AI's chat ----
// (access comes from functions/v1/orbit.js googleAccess; GitHub's token from its connection)
const gq = (a, url) => j(url, bearer(a.token));
export const GOOGLE_READ = {
  gmail: async (a) => {
    const l = need(await gq(a, "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX"));
    const msgs = await Promise.all((l.messages || []).map((m) => gq(a, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`).then((r) => r.data)));
    const h = (m, n) => (((m && m.payload && m.payload.headers) || []).find((x) => x.name === n) || {}).value || "";
    return [sec("Latest emails", msgs.filter(Boolean).map((m) => item(((m.labelIds || []).includes("UNREAD") ? "(unread) " : "") + (h(m, "Subject") || "(no subject)"), h(m, "From").replace(/<[^>]*>/, "").trim() + ": " + (m.snippet || ""))))];
  },
  calendar: async (a) => {
    const d = need(await gq(a, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs({ timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 14 * 864e5).toISOString(), maxResults: 15, singleEvents: "true", orderBy: "startTime" })}`));
    return [sec("Next two weeks", (d.items || []).map((e) => item(e.summary || "(no title)", [day((e.start && (e.start.dateTime || e.start.date)) || ""), e.location].filter(Boolean).join(" · "))))];
  },
  drive: async (a) => {
    const d = need(await gq(a, "https://www.googleapis.com/drive/v3/files?pageSize=15&orderBy=modifiedTime desc&fields=files(name,mimeType,modifiedTime)"));
    return [sec("Recent files", (d.files || []).map((f) => item(f.name, String(f.mimeType || "").split(".").pop().split("/").pop() + " · changed " + day(f.modifiedTime))))];
  },
  tasks: async (a) => {
    const lists = (need(await gq(a, "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=5")).items || []);
    const out = [];
    for (const l of lists) { const t = await gq(a, `https://tasks.googleapis.com/tasks/v1/lists/${l.id}/tasks?showCompleted=false&maxResults=20`); const items = ((t.data && t.data.items) || []).map((x) => item(x.title, x.due ? "due " + x.due.slice(0, 10) : "")); if (items.length) out.push(sec(l.title, items)); }
    return out;
  },
  youtube: async (a) => {
    const d = need(await gq(a, "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=20&order=relevance"));
    return [sec("Channels you follow", (d.items || []).map((s) => item(s.snippet && s.snippet.title, clip(s.snippet && s.snippet.description, 80))))];
  },
  contacts: async (a) => {
    const d = need(await gq(a, "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=100&sortOrder=LAST_MODIFIED_DESCENDING"));
    return [sec("Contacts", (d.connections || []).filter((p) => p.names && p.names.length).slice(0, 60).map((p) => item(p.names[0].displayName, ((p.emailAddresses || [])[0] || {}).value || "")))];
  },
  github: async (a) => {
    const gh = (p) => j("https://api.github.com/" + p, bearer(a.token, { Accept: "application/vnd.github+json" }));
    const repos = need(await gh("user/repos?sort=updated&per_page=10"));
    const issues = await gh("issues?filter=assigned&state=open&per_page=10");
    return [sec("Your repositories", (repos || []).map((r) => item(r.full_name, [r.description, r.private ? "private" : ""].filter(Boolean).join(" · ")))), sec("Open issues and pull requests for you", ((issues.data) || []).map((i) => item(i.title, (i.repository && i.repository.full_name) || "")))];
  },
};

// Which connected apps a chat message is about (Nebulux AI's chat reads those first).
const ASK = {
  gmail: /\b(gmail|inbox|my e-?mails?|new e-?mails?|unread)\b/i, calendar: /\b(google calendar|my calendar|my schedule|my (?:events|meetings)|this week's plans)\b/i, drive: /\b(google drive|my drive|my files)\b/i,
  tasks: /\b(google tasks|my to-?dos?|my tasks)\b/i, youtube: /\b(youtube|subscriptions)\b/i, contacts: /\b(my contacts|google contacts|email address(?:es)? (?:of|for))\b/i,
  github: /\b(github|my repos?|repositories|pull requests?)\b/i, notion: /\bnotion\b/i, slack: /\bslack\b/i, spotify: /\b(spotify|my music|listening to|my playlists?|top artists)\b/i,
  discord: /\bdiscord\b/i, x: /\b(twitter|tweets?|my x (?:account|posts?|profile))\b/i, reddit: /\b(reddit|subreddits?)\b/i, pinterest: /\b(pinterest|my pins|my boards?)\b/i,
  tiktok: /\btik ?tok\b/i, instagram: /\b(instagram|insta|my ig)\b/i, dropbox: /\bdropbox\b/i, outlook: /\b(outlook|hotmail)\b/i, onedrive: /\bone ?drive\b/i,
  mstodo: /\b(microsoft to ?do|ms to ?do)\b/i, todoist: /\btodoist\b/i, asana: /\basana\b/i, linear: /\blinear (?:issues?|tickets?)\b|\bmy linear\b/i, zoom: /\bzoom (?:meetings?|calls?)\b|\bmy zoom\b/i,
  twitch: /\btwitch\b/i,
};
export function appsAskedAbout(text, connected) {
  const t = String(text || "");
  return connected.filter((k) => ASK[k] && ASK[k].test(t)).slice(0, 2);
}
// Apps a question is about that they haven't connected (so the AI can say where to connect them).
export function appsNotConnected(text, connected) {
  const t = String(text || "");
  return Object.keys(ASK).filter((k) => !connected.includes(k) && ASK[k].test(t)).slice(0, 2);
}
