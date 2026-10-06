// Nebulux Code cloud sessions: hands an AI request to the nebulux-cloud-jobs worker, which runs it
// on the server, so the reply is there even if the person's device was offline meanwhile.
//   { action: "start", id, body } -> { status: "running" }
//   { action: "get", id }         -> { status: "running" | "done" | "error", content?, credits?, error? }
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";

const JOBS_URL = "https://nebulux-cloud-jobs.thebluedragonstriker.workers.dev/";

export async function onRequestPost({ request, env }) {
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  if (!env.JOBS_KEY) return json({ error: "Cloud sessions aren't set up yet." }, 503);
  const b = await request.json().catch(() => ({}));
  const id = String(b.id || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  if (!id) return json({ error: "Missing job id." }, 400);
  const msg = { user: user.id, id, action: b.action === "start" ? "start" : "get" };
  if (msg.action === "start") {
    const u = new URL(request.url);
    msg.url = `${u.origin}${u.pathname.replace(/cloud-job$/, "chatCompletion")}`;
    msg.auth = request.headers.get("authorization");
    msg.appId = request.headers.get("X-App-Id") || "";
    msg.body = b.body || {};
  }
  const res = await fetch(JOBS_URL, { method: "POST", headers: { "x-jobs-key": env.JOBS_KEY, "content-type": "application/json" }, body: JSON.stringify(msg) });
  return json(await res.json().catch(() => ({ error: "Cloud session failed." })), res.status);
}
