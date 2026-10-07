// API credit for the Nebulux Platform and Settings → Usage (cloudflare-lib/apibilling.js).
// Each AI has its own balance.
//   { action: "status" }                   -> { balances: { model: millicents }, balanceTexts, total, useApi, agreed, funded, ledger, prices, minTopup }
//   { action: "set-mode", useApi }         -> status   ("Use API key credits" on/off)
//   { action: "agree" }                    -> status   (the API billing agreement)
//   { action: "topup", model, dollars }    -> card payments aren't connected yet: nothing is charged
//   admins: { action: "grant", model, dollars, email? } -> status   (test balance; their own account unless email)
import { json } from "../../../../../cloudflare-lib/published.js";
import { currentUser } from "../../../../../cloudflare-lib/credits.js";
import { all } from "../../../../../cloudflare-lib/db.js";
import { account, setUseApi, agree, addFunds, ledger, PRICES, MIN_TOPUP, dollars, toMc } from "../../../../../cloudflare-lib/apibilling.js";
import { logAdmin } from "../../../../../cloudflare-lib/audit.js";

async function status(db, userId) {
  const a = await account(db, userId);
  const total = Object.values(a.balances).reduce((x, y) => x + y, 0);
  return {
    balances: a.balances,
    balanceTexts: Object.fromEntries(Object.entries(a.balances).map(([m, v]) => [m, "$" + dollars(v)])),
    total,
    totalText: "$" + dollars(total),
    useApi: a.useApi,
    agreed: !!a.agreedAt,
    funded: a.funded,
    ledger: await ledger(db, userId),
    prices: PRICES,
    minTopup: MIN_TOPUP,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await currentUser(request);
  if (!user) return json({ error: "Please sign in." }, 401);
  const db = env.DB;
  if (!db) return json({ error: "Not available right now." }, 503);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "status");
  const model = String(body.model || "");

  if (action === "set-mode") {
    if (body.useApi) {
      const a = await account(db, user.id);
      if (!a.agreedAt) return json({ error: "Agree to API billing first (Nebulux Platform → Billing)." }, 400);
    }
    await setUseApi(db, user.id, !!body.useApi);
  } else if (action === "agree") {
    await agree(db, user.id);
  } else if (action === "topup") {
    if (!(model in PRICES)) return json({ error: "Pick which AI to add funds to." }, 400);
    const d = Number(body.dollars);
    if (!(d >= MIN_TOPUP[model])) return json({ error: `The smallest amount for this AI is $${MIN_TOPUP[model]}.` }, 400);
    return json({ error: "Card payments are coming soon. Nothing was charged.", soon: true }, 503);
  } else if (action === "grant") {
    if (user.role !== "admin") return json({ error: "Admins only." }, 403);
    if (!(model in PRICES)) return json({ error: "Pick which AI." }, 400);
    const d = Number(body.dollars);
    if (!(d > 0 && d <= 1000)) return json({ error: "Between $0.01 and $1,000." }, 400);
    let target = user;
    if (body.email) {
      const email = String(body.email).trim().toLowerCase();
      target = (await all(db, "User")).find((u) => String(u.email || "").toLowerCase() === email);
      if (!target) return json({ error: "No account with that email." }, 404);
    }
    await addFunds(db, target.id, model, toMc(d), "grant", `Added by ${user.email}`);
    context.waitUntil(logAdmin(env.PUBLISHED_HTML, user, "api-credit", { to: target.email, model, dollars: d }).catch(() => {}));
  }
  return json(await status(db, user.id));
}
