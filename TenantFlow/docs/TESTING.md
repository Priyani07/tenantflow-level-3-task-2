# Test and demo checklist

## Automated checks

```bash
npm run check
npm test
npm run build
```

Nine integration scenarios:

1. Cross-organization reads, guessed project IDs, edits/deletes, and list isolation.
2. Owner/admin/member permissions, one-use email-bound invites, revocation, and member removal.
3. Project quotas under concurrent requests and seat limits.
4. Cross-origin rejection, hashed sessions, logout, and password-change session rotation.
5. Owner-only Checkout/portal, open-session reuse, duplicate subscription prevention, and independent tenants.
6. Invalid signatures, event replay, canonical subscription-state retrieval, unknown customer mapping, and plan gates.
7. Explicitly unavailable billing without keys; client-supplied plan/status cannot grant access.
8. Failed webhook retry and concurrent duplicate delivery.
9. Expired sessions/invitations and cancellation-at-period-end access.

External Stripe API methods are mocked. Webhook signature generation/verification uses the real Stripe SDK. Tests are not equivalent to real Checkout or PostgreSQL validation.

## Manual browser QA

- Register and sign in on desktop and mobile widths (390 px and 1440 px).
- Create two organizations; switch between them and verify separate project/member lists.
- Create, rename, change status, and delete projects according to role.
- Copy an email-bound invite into another profile and accept with the intended account email.
- Verify a wrong email, expired link, reused link, or revoked link cannot join.
- Change a member to admin as owner; remove the member and verify the old browser cannot fetch organization records.
- Change password and confirm a second signed-in profile is revoked.
- Inspect focus behavior for dialogs, keyboard navigation, and reduced-motion preference.

## Real Stripe sandbox QA

Follow STRIPE-SETUP.md before this section.

- Verify actual Price currency/amounts display.
- Complete owner Checkout in a sandbox and confirm CLI/Workbench webhook delivery succeeds.
- Confirm success URL without a verified subscription cannot grant paid access.
- Confirm paid plan, project/seat quotas, and insights reflect canonical Stripe state.
- Verify another organization remains independent.
- Open invoices and Customer Portal; update plan/payment method/cancellation settings.
- Replay a real recognized event and confirm no duplicate billing audit update.
- Try a documented payment-failure scenario and confirm the expected subscription status/Starter policy.
- Schedule cancellation and confirm active access remains until status changes.
- Cancel fully and confirm additions are governed by Starter quotas while existing data remains.

## PostgreSQL / deployment QA

- Use a separate persistent PostgreSQL database and run the application.
- Verify sign-in, invitations, quotas and webhooks against PostgreSQL.
- Run concurrent requests from multiple app instances sharing the same database; check advisory-lock serialization.
- Configure HTTPS, exact APP_ORIGIN, trusted proxy hops, provider TLS and secrets.
- Set a public snapshot webhook endpoint and its own signing secret.
- Restart/redeploy the service and verify persistence.
- Configure backups, monitoring and a shared limiter before production scaling.

## 4-minute demo outline

1. Dashboard and organization isolation (45 seconds).
2. Invite/team roles and denied action (45 seconds).
3. Real sandbox Checkout and verified plan activation (75 seconds).
4. Billing portal, invoices and cancellation flag (45 seconds).
5. Architecture diagram and automated results (30 seconds).
