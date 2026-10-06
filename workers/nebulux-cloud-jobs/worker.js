// One Durable Object per cloud job. The Nebulux site (cloud-job function) starts a job with the
// signed-in person's request; an alarm runs it (alarms keep going with nobody connected), saves
// the reply, and forgets the person's sign-in token. Jobs are wiped a day later.
// Only the Nebulux site can call this: it sends JOBS_KEY.
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export default {
  async fetch(request, env) {
    if (!env.JOBS_KEY || request.headers.get("x-jobs-key") !== env.JOBS_KEY) return json({ error: "Forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    if (!b.user || !b.id) return json({ error: "Bad request" }, 400);
    const stub = env.JOB.get(env.JOB.idFromName(`${b.user}:${b.id}`));
    return stub.fetch("https://job/", { method: "POST", body: JSON.stringify(b) });
  },
};

export class CloudJob {
  constructor(state) {
    this.s = state.storage;
  }
  async fetch(request) {
    const b = await request.json();
    if (b.action === "start") {
      const had = await this.s.get("job");
      if (had) return json(had);
      const job = { status: "running", started: Date.now() };
      await this.s.put("job", job);
      await this.s.put("req", { url: b.url, auth: b.auth, appId: b.appId, body: b.body });
      await this.s.setAlarm(Date.now());
      return json(job);
    }
    return json((await this.s.get("job")) || { status: "missing" });
  }
  async alarm() {
    const r = await this.s.get("req");
    if (!r) {
      await this.s.deleteAll();
      return;
    }
    let job;
    try {
      const res = await fetch(r.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: r.auth, "X-App-Id": String(r.appId || "") },
        body: JSON.stringify({ ...r.body, stream: false }),
      });
      const d = await res.json().catch(() => ({}));
      job = res.ok ? { status: "done", content: d.content ?? "", credits: d.credits, more: !!d.more, cut: !!d.cut } : { status: "error", error: d.error || "Something went wrong.", credits: d.credits };
    } catch {
      job = { status: "error", error: "The cloud session couldn't reach the AI." };
    }
    await this.s.put("job", { ...job, finished: Date.now() });
    await this.s.delete("req");
    await this.s.setAlarm(Date.now() + 86400000);
  }
}
