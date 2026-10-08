// Storm Strike online matches. One Durable Object ("arena") pairs players into matches and relays
// their messages; the game itself runs in the players' browsers (the match host also runs the bots
// and the storm and shares them). Players never type anything: names are made up by the game, so
// there's no chat to moderate.
const MAX_PLAYERS = 24; // per battle royale match; bots fill the rest of the 100
// Gunfights: real people only, no bots. A match starts as soon as the queue has exactly enough
// people (2 for 1v1, 4 for 2v2); until then everyone waits.
const DUEL = { "1v1": 2, "2v2": 4, gf: 2 };
const WAIT_MS = 12000; // a match starts this long after the first player starts waiting
const MAX_MSG = 24000; // bytes (a 100-player snapshot)
const MAX_RATE = 60; // messages per second per player
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*nebuluxai\.com$|^https:\/\/([a-z0-9-]+\.)*nebuluxai\.pages\.dev$|^null$/;
const RELAY = new Set(["state", "snap", "hitBot", "hitP", "dead", "fx", "botShot", "won", "qchat", "vote", "map", "build", "hitBuild", "bw", "bs"]);
// Bedwars (its own room, ?game=bedwars): 4 teams of 1, 2 or 4. Real people are put in the match;
// bots fill the empty spots. A match starts when it's full, or WAIT_MS after the first person waits.
const TIMED = { br: MAX_PLAYERS, bw1: 4, bw2: 8, bw4: 16, co: 4 };
// Balloon Siege (?game=balloon-siege): co-op only, with a party code ("co#ABCDE", up to 4 friends).
// Quick chat only: a number for one of the game's fixed messages ("GG!", "Nice shot!"...), never
// typed text, so nobody can send anything unkind or personal.
const QUICK_COUNT = 12;
// Bedwars parties: friends who share a 5-letter party code and pick the same mode wait in their
// own line ("bw2#ABCDE") and play one private match together (bots fill the empty spots). It
// starts when anyone in the party presses Start, or when it's full; never on the timer.
const PARTY = /^[A-Z0-9]{5}$/;
const baseQ = (q) => String(q || "br").split("#")[0];

// Typed chat. Many players are kids, so every message is checked here before anyone sees it:
// swear words are starred out, and anything that could share personal info or move people off
// the game (links, emails, phone numbers, social media handles, "add me on...") isn't sent at all.
const CHAT_MAX = 80;
const CHAT_GAP_MS = 2000;
const BAD = ["fuck", "shit", "bitch", "cunt", "dick", "pussy", "cock", "bastard", "asshole", "slut", "whore", "nigger", "nigga", "fag", "faggot", "retard", "rape", "porn", "sex", "nude", "nudes", "kys", "kill yourself", "damn", "crap", "piss", "twat", "wanker", "dumbass", "jackass", "motherfucker", "penis", "vagina", "boobs", "tits"];
// Words that are bad with any ending ("fucking", "shitty"); the rest only count as whole words.
const STEMS = ["fuck", "shit", "bitch", "cunt", "fag", "porn", "nigg", "slut", "whore"];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s", "!": "i" };
const plain = (t) => t.toLowerCase().replace(/[0-9@$!]/g, (c) => LEET[c] || c).replace(/[^a-z ]/g, "");
const PERSONAL = [
  /https?:|www\.|\.(com|net|org|gg|io|me|ly|co|xyz|tv)\b/i,
  /\S+@\S+/,
  /(\d[\s.\-()]*){5,}/,
  /\b(discord|snap(chat)?|insta(gram)?|tiktok|whats ?app|telegram|kik|facebook|fb|twitter|youtube|roblox|phone|number|address|password|where do you live|how old|ur age|your age)\b/i,
];
function cleanChat(raw) {
  let t = String(raw || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
  if (!t) return { ok: false };
  if (PERSONAL.some((re) => re.test(t))) return { ok: false, why: "No links, numbers, accounts or personal info in chat." };
  // Whole phrases ("kill yourself") and letters spaced out to sneak a word through ("f u c k") aren't sent.
  const p = plain(t);
  if (BAD.some((w) => w.includes(" ") && p.includes(w))) return { ok: false, why: "Keep chat friendly." };
  const singles = (p.match(/(?:\b[a-z]\b ?){3,}/g) || []).map((x) => x.replace(/ /g, ""));
  if (singles.some((x) => BAD.some((w) => w.length >= 3 && x.includes(w.replace(/ /g, ""))))) return { ok: false, why: "Keep chat friendly." };
  // Single bad words are starred out (whole words, or words that start with one, like "fucking"),
  // so "grape" or "Dickens" stay as they are.
  t = t
    .split(" ")
    .map((tok) => {
      const q = plain(tok).replace(/ /g, "");
      return BAD.some((w) => !w.includes(" ") && (q === w || (STEMS.includes(w) && q.startsWith(w)))) ? "*".repeat(tok.length) : tok;
    })
    .join(" ");
  return { ok: true, text: t };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/play") return new Response("Storm Strike online", { status: 200 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const origin = request.headers.get("Origin") || "null";
    if (!ALLOWED_ORIGIN.test(origin)) return new Response("Forbidden", { status: 403 });
    const g = url.searchParams.get("game");
    const id = env.ARENA.idFromName(g === "bedwars" || g === "balloon-siege" ? g : "storm-strike");
    return env.ARENA.get(id).fetch(request);
  },
};

export class Arena {
  constructor(state) {
    this.state = state;
  }

  sockets() {
    return this.state.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() || {} }));
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {}
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), match: null, joined: false, sec: 0, n: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    const a = ws.deserializeAttachment() || {};
    const sec = Math.floor(Date.now() / 1000);
    if (a.sec !== sec) {
      a.sec = sec;
      a.n = 0;
    }
    if (++a.n > MAX_RATE) {
      ws.serializeAttachment(a);
      return;
    }
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m.t !== "string") return;

    if (m.t === "join" && !a.joined) {
      a.joined = true;
      a.name = String(m.name || "Player").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 24) || "Player";
      a.fig = Math.max(0, Math.min(40, m.fig | 0));
      a.match = null;
      // The lobby: a place to walk around together. Everyone in it is in one shared "match", so
      // their moves and quick chat reach each other; the leaderboard of best players lives here.
      if (m.q === "lobby") {
        a.q = "lobby";
        a.match = "lobby";
        ws.serializeAttachment(a);
        const others = this.sockets().filter((s) => s.ws !== ws && s.a.match === "lobby");
        for (const s of others) this.send(s.ws, { t: "ljoin", id: a.id, name: a.name, fig: a.fig });
        this.send(ws, { t: "lobby", you: a.id, players: others.map((s) => ({ id: s.a.id, name: s.a.name, fig: s.a.fig })), top: (await this.state.storage.get("top2")) || [], topR: (await this.state.storage.get("topR")) || [], topW: (await this.state.storage.get("topW")) || [] });
        return;
      }
      a.q = DUEL[m.q] || TIMED[m.q] ? m.q : "br";
      a.waitSince = Date.now();
      const party = String(m.party || "").toUpperCase();
      if (PARTY.test(party) && /^(bw[124]|co)$/.test(a.q)) {
        a.q = a.q + "#" + party;
        ws.serializeAttachment(a);
        const line = this.sockets().filter((s) => s.a.joined && !s.a.match && s.a.q === a.q);
        if (line.length >= TIMED[baseQ(a.q)]) await this.startMatch(a.q);
        else for (const s of line) this.send(s.ws, { t: "wait", party: true, count: line.length, players: line.map((x) => ({ name: x.a.name, fig: x.a.fig })) });
        return;
      }
      ws.serializeAttachment(a);
      if (DUEL[a.q]) {
        const need = DUEL[a.q];
        const line = this.sockets().filter((s) => s.a.joined && !s.a.match && s.a.q === a.q);
        if (line.length >= need) await this.startMatch(a.q, line.slice(0, need));
        else for (const s of line) this.send(s.ws, { t: "wait", count: line.length, need, players: line.map((x) => ({ name: x.a.name, fig: x.a.fig })) });
        return;
      }
      const waiting = this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === a.q);
      if (waiting.length >= TIMED[a.q]) await this.startMatch(a.q);
      else {
        const first = Math.min(...waiting.map((s) => s.a.waitSince || Date.now()));
        const at = first + WAIT_MS;
        const cur = await this.state.storage.getAlarm();
        if (!cur || cur > at) await this.state.storage.setAlarm(at);
        for (const s of waiting) this.send(s.ws, { t: "wait", count: waiting.length, startsIn: Math.max(0, Math.ceil((at - Date.now()) / 1000)), players: waiting.map((x) => ({ name: x.a.name, fig: x.a.fig })) });
      }
      return;
    }

    ws.serializeAttachment(a);
    // A party's Start button: its private match begins now, with whoever is waiting.
    if (m.t === "pstart" && a.joined && !a.match && String(a.q || "").includes("#")) {
      await this.startMatch(a.q);
      return;
    }
    // Leaderboard: the best trophy counts (what the game reports; names are made up by the game).
    if (m.t === "score" && a.joined && a.name !== "Anonymous") {
      // Three boards: trophies, ranked points (only once placed), and Victory Royales.
      const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
      const board = async (key, field, val) => {
        let list = (await this.state.storage.get(key)) || [];
        const had = list.find((x) => x.name === a.name);
        if (val === null) return list;
        if (had && had[field] === val) return list;
        list = list.filter((x) => x.name !== a.name);
        list.push({ name: a.name, [field]: val, fig: a.fig });
        list.sort((x, y) => y[field] - x[field]);
        list = list.slice(0, 10);
        await this.state.storage.put(key, list);
        return list;
      };
      const top = await board("top2", "trophies", num(m.trophies, 1000000));
      const topR = await board("topR", "rp", m.rp == null ? null : num(m.rp, 100000));
      const topW = await board("topW", "wins", m.wins ? num(m.wins, 1000000) : null);
      const out = JSON.stringify({ t: "top", top, topR, topW });
      for (const s of this.sockets()) if (s.a.match === "lobby") try { s.ws.send(out); } catch {}
      return;
    }
    if (m.t === "chat") {
      const now = Date.now();
      if (a.lastChat && now - a.lastChat < CHAT_GAP_MS) return;
      a.lastChat = now;
      ws.serializeAttachment(a);
      const c = cleanChat(m.text);
      if (!c.ok) {
        if (c.why) this.send(ws, { t: "chatno", why: c.why });
        return;
      }
      const out = JSON.stringify({ t: "chat", text: c.text, name: a.name, from: a.id });
      this.send(ws, { t: "chat", text: c.text, name: a.name, from: a.id, mine: true });
      for (const s of this.sockets()) {
        if (s.ws === ws) continue;
        if (a.match ? s.a.match === a.match : s.a.joined && !s.a.match && (s.a.q || "br") === (a.q || "br")) {
          try {
            s.ws.send(out);
          } catch {}
        }
      }
      return;
    }
    if (m.t === "qchat") {
      const i = m.i | 0;
      if (i < 0 || i >= QUICK_COUNT) return;
      const out = JSON.stringify({ t: "qchat", i, name: a.name, from: a.id });
      // In the lobby: everyone waiting in the same line. In a match: everyone in it.
      for (const s of this.sockets()) {
        if (s.ws === ws) continue;
        if (a.match ? s.a.match === a.match : s.a.joined && !s.a.match && (s.a.q || "br") === (a.q || "br")) {
          try {
            s.ws.send(out);
          } catch {}
        }
      }
      return;
    }
    if (!a.match || !RELAY.has(m.t)) return;
    m.from = a.id;
    const out = JSON.stringify(m);
    for (const s of this.sockets()) {
      if (s.ws === ws || s.a.match !== a.match) continue;
      if (m.to && s.a.id !== m.to) continue;
      try {
        s.ws.send(out);
      } catch {}
    }
  }

  // Starts every timed queue whose first player has waited long enough, then waits for the next.
  async alarm() {
    const now = Date.now();
    let next = 0;
    for (const q of Object.keys(TIMED)) {
      const line = this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === q);
      if (!line.length) continue;
      const at = Math.min(...line.map((s) => s.a.waitSince || now)) + WAIT_MS;
      if (at <= now + 500) await this.startMatch(q);
      else next = next ? Math.min(next, at) : at;
    }
    if (next) await this.state.storage.setAlarm(next);
  }

  async startMatch(q = "br", chosen = null) {
    const waiting = chosen || this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === q).slice(0, TIMED[baseQ(q)] || MAX_PLAYERS);
    if (!waiting.length) return;
    const match = crypto.randomUUID().slice(0, 8);
    const players = waiting.map((s) => ({ id: s.a.id, name: s.a.name, fig: s.a.fig }));
    const host = players[0].id;
    for (const s of waiting) {
      s.a.match = match;
      s.a.host = host;
      s.ws.serializeAttachment(s.a);
    }
    for (const s of waiting) this.send(s.ws, { t: "start", q: baseQ(q), match, you: s.a.id, host, players, seed: Math.floor(Math.random() * 1e9) });
    if (!TIMED[q]) return;
    // Anyone who joined while this one was being set up waits for the next match.
    const rest = this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === q);
    if (rest.length) await this.state.storage.setAlarm(Date.now() + WAIT_MS);
  }

  async webSocketClose(ws) {
    await this.leave(ws);
  }

  async webSocketError(ws) {
    await this.leave(ws);
  }

  async leave(ws) {
    const a = ws.deserializeAttachment() || {};
    if (!a.match) return;
    const left = this.sockets().filter((s) => s.ws !== ws && s.a.match === a.match);
    for (const s of left) this.send(s.ws, { t: "left", id: a.id });
    // The host left: the next player takes over the bots and the storm.
    if (a.host === a.id && left.length) {
      const host = left[0].a.id;
      for (const s of left) {
        s.a.host = host;
        s.ws.serializeAttachment(s.a);
        this.send(s.ws, { t: "host", id: host });
      }
    }
  }
}
