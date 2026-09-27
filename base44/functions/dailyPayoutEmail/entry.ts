import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// Same checks as Monitor's "Before you pay creators" (src/lib/payoutChecks.js; keep in step):
// a site an admin took down, buying from your own site, many orders from one buyer in a day,
// or a big order.
const clean = (e) => String(e || '').trim().toLowerCase();
function holdReasons(sale, sales, takenDown = new Set()) {
  const out = [];
  if (takenDown.has(sale.siteName)) out.push('the site was taken down');
  const buyer = clean(sale.buyerEmail);
  if (buyer && buyer === clean(sale.creatorEmail)) out.push("buyer is the site's owner");
  if (buyer) {
    const t = new Date(sale.paidAt).getTime();
    const burst = sales.filter((x) => clean(x.buyerEmail) === buyer && x.siteName === sale.siteName && Math.abs(new Date(x.paidAt).getTime() - t) < 86400000);
    if (burst.length >= 3) out.push(`${burst.length} orders from one buyer in a day`);
  }
  if ((parseFloat(sale.gross || '0') || 0) >= 200) out.push('unusually large order');
  return out;
}

// Take-downs live in the Cloudflare app (KV), which says whether a page was taken down through
// its public page-status function. If it can't be reached, the email says so instead of guessing.
const PAGE_STATUS_URL = 'https://nebuluxai.pages.dev/api/apps/6a8b5eb7787b8a4d6a18f662/functions/page-status';
async function takenDownSites(names) {
  const down = new Set();
  let failed = false;
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      try {
        const r = await fetch(PAGE_STATUS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'site', name }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) failed = true;
        else if (d.blocked) down.add(name);
      } catch (_) {
        failed = true;
      }
    })
  );
  return { down, failed };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled runs have no user; direct calls must come from an admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sales = await base44.asServiceRole.entities.SiteSale.filter({ status: 'paid' }, '-paidAt', 200);
    const fresh = (sales || []).filter((s) => s.paidAt && new Date(s.paidAt) >= since);

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const recipients = (admins || []).map((a) => String(a.email || '').trim()).filter(Boolean);
    if (recipients.length === 0) {
      console.error('dailyPayoutEmail: no admin email found');
      return Response.json({ error: 'No admin email to send to' }, { status: 500 });
    }

    const day = new Date().toISOString().slice(0, 10);
    let body;
    if (fresh.length === 0) {
      body = `No new site sales in the last 24 hours (${day}).`;
    } else {
      const gross = fresh.reduce((s, r) => s + (parseFloat(r.gross || '0') || 0), 0);
      const fees = fresh.reduce((s, r) => s + (parseFloat(r.platformFee || '0') || 0), 0);
      const payouts = fresh.reduce((s, r) => s + (parseFloat(r.creatorPayout || '0') || 0), 0);
      const { down, failed } = await takenDownSites(fresh.map((r) => r.siteName));
      const lines = fresh
        .map(
          (r) =>
            `- ${r.siteName}.nebuluxai.com | ${r.productName || r.productId} x${r.quantity || 1} | gross ${money(
              parseFloat(r.gross || '0') || 0
            )} | fee ${money(parseFloat(r.platformFee || '0') || 0)} | payout ${money(
              parseFloat(r.creatorPayout || '0') || 0
            )} | ${r.creatorEmail || ''} | ${r.paidAt}` +
            (holdReasons(r, sales || [], down).length ? `\n    ⚠ HOLD: ${holdReasons(r, sales || [], down).join('; ')}` : '')
        )
        .join('\n');
      body =
        `Site sale payouts for the last 24 hours (${day})\n\n` +
        `Orders: ${fresh.length}\nGross: ${money(gross)}\nPlatform fees: ${money(fees)}\nCreator payouts: ${money(payouts)}\n\n` +
        `Details:\n${lines}\n\n` +
        `Before paying a creator, wait 14 days after the sale (card disputes come then), and don't pay anything marked HOLD without checking it first. Refunds and card disputes aren't recorded here, so check each order in the Wix dashboard before paying for it.\n` +
        (failed ? `\nCouldn't check today whether these sites were taken down: look at Monitor before paying.\n` : '');
    }

    const subject = `Nebulux AI daily payout summary - ${day}`;
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body, from_name: 'Nebulux AI' });
      } catch (e) {
        console.error('dailyPayoutEmail: send failed for', to, e);
      }
    }

    return Response.json({ sent: true, recipients, orders: fresh.length });
  } catch (error) {
    console.error('dailyPayoutEmail failed', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}