import { appParams } from "@/lib/app-params";
import { startActivity, updateActivity, finishActivity } from "@/lib/aiActivity";

// Calls the chatCompletion function in streaming mode so replies appear as they're
// written instead of after one long wait. The server sends newline-delimited JSON:
// {"delta": "..."} pieces, then {"done": true, cut, charged, credits, model, effort}
// or {"error": "..."}. onDelta(textSoFar) is called as text arrives. Resolves with
// { content, cut, charged, credits, model, effort }. Errors mimic axios' shape
// (err.response.status / err.response.data) so existing catch blocks keep working.
// Pass { signal } and abort it when the user presses Stop: the connection closes, the
// server stops generating and charges only for what was written.
// When the AI is busy (Google's free tier, before any text was written) it asks again by
// itself, a few seconds apart, so a short rush shows as a longer "Thinking..." rather than an
// error. Busy answers aren't charged.
export const BUSY_RETRY_WAITS_MS = [3000, 7000];

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });

// `activity` ({ key, where, label, question, ai }) shows this answer on the Dashboard and the
// sidebar while it's written (lib/aiActivity.js), with its cost and time so far.
export async function streamChat(body, onDelta, { signal, waits = BUSY_RETRY_WAITS_MS, activity } = {}) {
  const key = activity?.key;
  if (key) startActivity(key, { where: activity.where, label: activity.label, question: activity.question || body.question || "", ai: activity.ai });
  try {
    for (let attempt = 0; ; attempt++) {
      let wrote = false;
      try {
        const res = await streamOnce(body, (t) => {
          wrote = true;
          if (key) updateActivity(key, { chars: t.length });
          onDelta?.(t);
        }, { signal, onMeta: (meta) => key && updateActivity(key, { meta }) });
        if (key) finishActivity(key, res.cut ? "out" : "done", { charged: res.charged, resetsAt: res.credits?.pool?.resetsAt || null });
        return res;
      } catch (e) {
        if (wrote || !e?.response?.data?.busy || attempt >= waits.length || signal?.aborted) throw e;
        await wait(waits[attempt], signal);
      }
    }
  } catch (e) {
    if (key) {
      const d = e?.response?.data;
      if (d?.outOfCredits) finishActivity(key, "out", { resetsAt: d.resetsAt || null });
      else finishActivity(key, signal?.aborted ? "stopped" : "error");
    }
    throw e;
  }
}

async function streamOnce(body, onDelta, { signal, onMeta } = {}) {
  const appId = appParams.appId;
  const token = localStorage.getItem("base44_access_token") || appParams.token;
  const res = await fetch(`/api/apps/${appId}/functions/chatCompletion`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-App-Id": String(appId),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  const fail = (status, data) => {
    const err = new Error(data?.error || `Request failed with status code ${status}`);
    err.response = { status, data };
    return err;
  };
  if (!res.ok || !res.body) throw fail(res.status, await res.json().catch(() => ({})));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  let final = null;
  const handle = (line) => {
    if (!line) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.meta) {
      onMeta?.(msg.meta);
    } else if (typeof msg.delta === "string") {
      content += msg.delta;
      onDelta?.(content);
    } else if (msg.done || msg.error) {
      final = msg;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, nl).trim());
      buf = buf.slice(nl + 1);
    }
  }
  handle(buf.trim());

  if (!final) throw fail(502, { error: "The connection to the AI was interrupted. Please try again." });
  if (final.error) throw fail(final.status || 503, final);
  return { content, cut: !!final.cut, more: !!final.more, charged: final.charged, credits: final.credits, model: final.model, effort: final.effort };
}
