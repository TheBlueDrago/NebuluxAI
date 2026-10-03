// Storm Strike online matches. One Durable Object ("arena") pairs players into matches and relays
// their messages; the game itself runs in the players' browsers (the match host also runs the bots
// and the storm and shares them). Players never type anything: names are made up by the game, so
// there's no chat to moderate.
const MAX_PLAYERS = 12; // per battle royale match; bots fill the rest of the 20
// Gunfights: real people only, no bots. A match starts as soon as the queue has exactly enough
// people (2 for 1v1, 4 for 2v2); until then everyone waits.
const DUEL = { "1v1": 2, "2v2": 4 };
const WAIT_MS = 12000; // a match starts this long after the first player starts waiting
const MAX_MSG = 6000; // bytes
const MAX_RATE = 60; // messages per second per player
const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*nebuluxai\.com$|^https:\/\/([a-z0-9-]+\.)*nebuluxai\.pages\.dev$|^null$/;
const RELAY = new Set(["state", "snap", "hitBot", "hitP", "dead", "fx", "botShot", "won"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/play") return new Response("Storm Strike online", { status: 200 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const origin = request.headers.get("Origin") || "null";
    if (!ALLOWED_ORIGIN.test(origin)) return new Response("Forbidden", { status: 403 });
    const id = env.ARENA.idFromName("storm-strike");
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
      a.q = DUEL[m.q] ? m.q : "br";
      a.waitSince = Date.now();
      ws.serializeAttachment(a);
      if (a.q !== "br") {
        const need = DUEL[a.q];
        const line = this.sockets().filter((s) => s.a.joined && !s.a.match && s.a.q === a.q);
        if (line.length >= need) await this.startMatch(a.q, line.slice(0, need));
        else for (const s of line) this.send(s.ws, { t: "wait", count: line.length, need });
        return;
      }
      const waiting = this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === "br");
      if (waiting.length >= MAX_PLAYERS) await this.startMatch();
      else {
        const first = Math.min(...waiting.map((s) => s.a.waitSince || Date.now()));
        const at = first + WAIT_MS;
        const cur = await this.state.storage.getAlarm();
        if (!cur || cur > at) await this.state.storage.setAlarm(at);
        for (const s of waiting) this.send(s.ws, { t: "wait", count: waiting.length, startsIn: Math.max(0, Math.ceil((at - Date.now()) / 1000)) });
      }
      return;
    }

    ws.serializeAttachment(a);
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

  async alarm() {
    await this.startMatch();
  }

  async startMatch(q = "br", chosen = null) {
    const waiting = chosen || this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === "br").slice(0, MAX_PLAYERS);
    if (!waiting.length) return;
    const match = crypto.randomUUID().slice(0, 8);
    const players = waiting.map((s) => ({ id: s.a.id, name: s.a.name, fig: s.a.fig }));
    const host = players[0].id;
    for (const s of waiting) {
      s.a.match = match;
      s.a.host = host;
      s.ws.serializeAttachment(s.a);
    }
    for (const s of waiting) this.send(s.ws, { t: "start", q, match, you: s.a.id, host, players, seed: Math.floor(Math.random() * 1e9) });
    if (q !== "br") return;
    // Anyone who joined while this one was being set up waits for the next match.
    const rest = this.sockets().filter((s) => s.a.joined && !s.a.match && (s.a.q || "br") === "br");
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
