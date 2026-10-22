// Temporary (removed right after one use): does Meta's API accept this project's MUSE_SPARK_API_KEY?
// Reports only the status, never the key.
export async function onRequestGet({ env }) {
  const t0 = Date.now(); let status = 0, body = "";
  try {
    const r = await fetch("https://api.meta.ai/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + env.MUSE_SPARK_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ model: "muse-spark-1.3", messages: [{ role: "user", content: "Reply with just the word OK." }], max_completion_tokens: 20, reasoning_effort: "low" }) });
    status = r.status; body = await r.text();
  } catch (e) { body = String(e); }
  return new Response(JSON.stringify({ hasKey: !!env.MUSE_SPARK_API_KEY, status, ms: Date.now() - t0, body: body.slice(0, 700) }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
