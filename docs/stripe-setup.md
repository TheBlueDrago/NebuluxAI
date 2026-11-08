# Stripe setup (Pro, Team and usage credits)

Checkout is built, but it does nothing until the two secrets below are in Cloudflare. Without them, the buttons say "Checkout isn't connected yet" and nothing can be charged.

Keys never go in the code.

## 1. Add the secrets

Cloudflare dashboard > Workers & Pages > nebuluxai > Settings > Variables and Secrets. Add these as **Secret** for Production:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Sandbox: starts `sk_test_`. Real money: starts `sk_live_`. |
| `STRIPE_WEBHOOK_SECRET` | Starts `whsec_`, from step 2. |

## 2. Add the webhook

Stripe dashboard > Developers > Webhooks > Add destination.

- URL: `https://nebuluxai.pages.dev/api/stripe-webhook` (this one works during maintenance)
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## 3. Turn on what people can pay with

Stripe dashboard > Settings > Payment methods: turn on Cards, Cash App Pay, Klarna and bank payments (ACH). Stripe shows each one only when it suits the price and the customer's country.

## 4. Turn on the cancel page

Stripe dashboard > Settings > Billing > Customer portal: save it once, with canceling allowed. "Manage or cancel" in Subscriptions opens this page.

## Going live

Sandbox and live have separate keys, webhooks and settings, so repeat all four steps in live mode.

Before taking the site off maintenance, the real (`sk_live_`) keys must be in place.
