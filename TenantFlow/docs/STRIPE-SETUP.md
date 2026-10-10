# Stripe sandbox setup

Use your own Stripe sandbox/test environment. The source contains no working API key. Never paste secret keys or database URLs into a public repository or chat.

## 1. Create monthly prices

In your Stripe sandbox/test Dashboard, create:

- **TenantFlow Pro**: a flat, monthly recurring price. Example: USD 19/month.
- **TenantFlow Business**: a flat, monthly recurring price. Example: USD 49/month.

These are example amounts, not hardcoded charges. The interface reads the configured active Price values from Stripe. Use quantity 1; do not configure usage-based or per-seat billing for this implementation.

Copy each `price_...` ID. Confirm both Prices, the secret key, and webhook endpoint belong to the same sandbox/account.

## 2. Add the server secret key and Price IDs

After `npm run setup`, edit local `.env`:

```env
PORT=3001
APP_ORIGIN=http://localhost:3001
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_YOUR_OWN_KEY
STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE
STRIPE_PRICE_BUSINESS=price_YOUR_BUSINESS_PRICE
```

The placeholders above will not work as keys. Hosted Checkout redirects do not need a client publishable key in this project.

## 3. Forward local snapshot webhooks

Install the Stripe CLI from its official documentation, then open a separate terminal:

```bash
stripe login
stripe listen --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://localhost:3001/api/stripe/webhook
```

Copy the CLI listener’s `whsec_...` signing secret into `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_CLI_LISTENER_SECRET
```

Restart the Node server after changing `.env`. Keep both the app server and CLI listener running.

A CLI signing secret and a deployed endpoint signing secret are different values. When switching delivery paths, update this variable accordingly.

## 4. Configure the Customer Portal

In Stripe’s Customer Portal configuration for the same sandbox, enable the actions you want to demonstrate:

- Payment method updates.
- Invoice access.
- Subscription cancellation, optionally at period end.
- Subscription plan switching between your configured Pro and Business prices.

Save the portal configuration. The app’s owner-only **Manage billing** action creates a portal session for that organization’s customer.

## 5. Run a real sandbox Checkout

1. Register/sign in, create an organization, and open **Plans & billing**.
2. Confirm the page reports **Stripe test mode** and shows your actual monthly prices.
3. Choose Pro or Business as the organization owner.
4. Complete Stripe-hosted Checkout with an official Stripe test card, for example `4242 4242 4242 4242`, a future expiry date, and a test CVC.
5. Return to the app. The success page alone grants nothing; wait for the webhook or use **Refresh** to reconcile from Stripe.
6. Confirm active subscription status, paid quotas, invoice history, and the insights endpoint.
7. Create another organization. It should remain on Starter.
8. Open **Manage billing**, change the plan or schedule cancellation, then return and refresh status.

Never use real card details for this sandbox demo. Use Stripe’s documented test scenarios for payment failures and authentication flows.

## 6. Register a deployed webhook

In Workbench → Webhooks / event destinations:

- Destination: your account.
- Payload format: **Snapshot**. This handler expects v1 snapshot event `data.object`; thin events need a different handler.
- Endpoint: `https://YOUR-APP-DOMAIN/api/stripe/webhook`.
- Subscribe to the six event types listed in the CLI command.
- Set the endpoint’s `whsec_...` signing secret in the host environment.
- Save and redeploy/restart the app.

The handler also retrieves the current Subscription object from Stripe. Set an API version compatible with your installed `stripe` SDK and inspect real event deliveries when validating.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Billing configuration pending | All four Stripe variables must be set; restart after edits |
| Invalid Stripe signature | Correct endpoint/CLI secret, unchanged raw body, and snapshot delivery |
| Prices unavailable | Active flat monthly recurring Prices in the same sandbox |
| Portal cannot open | Activate portal configuration and create the organization’s customer first |
| Active subscription but Starter access | Verify recognized Price ID and webhook delivery, then Refresh |
| New Checkout refused | A non-canceled subscription already exists; use the Customer Portal |
| Generic Stripe failure | Inspect server and Stripe request logs; do not expose secrets |

## Official references

- Subscriptions: https://docs.stripe.com/billing/subscriptions/build-subscriptions
- Webhooks/signatures and local testing: https://docs.stripe.com/webhooks
- Customer Portal: https://docs.stripe.com/customer-management/integrate-customer-portal
- Test cards: https://docs.stripe.com/testing
- Idempotency: https://docs.stripe.com/api/idempotent_requests
