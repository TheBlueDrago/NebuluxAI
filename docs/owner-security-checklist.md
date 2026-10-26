# Owner security checklist

Blackhole AI's code does a lot to keep money and accounts safe (see `SECURITY.md`). Most real
break-ins don't go through the code, though: they go through the owner's own accounts. This is
the list of things only you can do, in plain words.

## 1. Still to do from the September 2026 security work

- [ ] **Deploy the four Base44 functions** with the Base44 CLI, in this order:
      `payments-webhook`, `create-checkout`, `site-checkout`, `dailyPayoutEmail`. Until then the
      live checkout uses the older versions (no plan quantity check, no take-down check on site
      sales, older payout email).
- [ ] **Redeploy the site router Worker** (safety headers on published sites):
      `cd workers/blackhole-site-router && npx wrangler deploy`
- [ ] **Check creators' emails aren't public.** In a private browser window open
      `https://blackhole-ai.base44.app/api/apps/6a8b5eb7787b8a4d6a18f662/entities/PublishedSite?limit=1`.
      If you see an email address, turn on Base44's setting that hides `created_by` on records.
- [ ] **Decide a refund and cancellation policy** and add it to the Terms. Card networks and
      PayPal expect one. Right now a cancelled plan ends when Wix sends the cancel event.
- [ ] **Decide how Team credits are shared.** Some pages say the whole team shares all credits;
      the credit server only pools Blackhole Code credits.

## 2. Lock down your accounts (do this before connecting any money)

Turn on **two-step sign-in (2FA)** everywhere, ideally with an authenticator app rather than
text messages, and save the recovery codes somewhere offline:

- [ ] The email account everything else resets to (do this one first)
- [ ] PayPal
- [ ] Wix / Base44
- [ ] Cloudflare
- [ ] GitHub
- [ ] Google (the Gemini API key lives there)

Also:

- [ ] Use a different, long password for each (a password manager makes this easy).
- [ ] Use a business email for business accounts, not one you use for everything.
- [ ] Only your own admin account should have the admin role in Base44. Check Monitor → Admin
      log now and then. It shows where each admin action came from and warns you if admin
      actions came from more than one country.

## 3. Connecting PayPal safely

- [ ] Use a **PayPal Business** account, with 2FA on.
- [ ] Keep the PayPal **client secret** only in server settings (Base44 function secrets or
      Cloudflare environment variables), exactly like `WIX_CHECKOUT_API_KEY` today. Never put
      it in the code, in GitHub, in a chat with an AI, or in the browser.
- [ ] Set every price **on the server** (like `create-checkout` does). The browser should only
      ever send a product id, never an amount.
- [ ] Count a payment only after **PayPal's signed webhook** says it's completed, and verify
      that signature with PayPal's verify-webhook-signature API (like the Wix webhook's
      RS256 check today). Ignore the browser saying "paid".
- [ ] Make webhook handling **idempotent**: the same event twice must not give credits twice
      (the Wix webhook's `status === "paid"` check is the model).
- [ ] Handle **refunds and disputes**: take back credits or hold payouts. The Wix webhook
      doesn't do this yet either: for Wix it means also handling its "Payment Status Updated"
      event (`wix.ecom.v1.order_payment_status_updated`, refunded statuses) in
      `payments-webhook`. Until then, check orders in the Wix dashboard before paying creators.
- [ ] Try everything in the **PayPal sandbox** first.
- [ ] In PayPal, turn on notifications for every payment and for any change to where money is
      sent, so you'd see a change you didn't make.

## 4. Cloudflare dashboard (free settings worth turning on)

- [ ] Security → Bots: **Bot Fight Mode**
- [ ] Security → WAF: the free **managed rules**
- [ ] A **rate limiting rule** on `/api/*` as a second layer behind the app's own limits
- [ ] Later: **Turnstile** on sign-up (needs a site key added to the app)

## 5. A 5-minute weekly habit

- Monitor → **Security at a glance**: open reports, admin actions, countries.
- Monitor → **Messages**: security reports come first, then parents and teachers, then AI
  replies people reported as harmful or wrong (). A harmful reply is worth a look at what
  was asked, and a message back if the person left an email.
- Monitor → **Before you pay creators**: pay only sales older than 14 days with no warnings,
  and check each order in the Wix dashboard for refunds or disputes first.

## 6. If something looks wrong

1. Change the password of the account involved and sign out its other sessions.
2. Rotate the keys that account could see: `WIX_CHECKOUT_API_KEY` and `WIX_CHECKOUT_SITE_ID`
   (Base44 secrets), `GEMINI_API_KEY` (Cloudflare), and any PayPal secret.
3. In Monitor, ban the account doing it, then "Take down all their pages".
4. Check the Admin log for anything you didn't do.
