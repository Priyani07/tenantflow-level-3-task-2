# LinkedIn draft — review before posting

Built TenantFlow for Nexlevr Level 3, Task 02: a multi-tenant SaaS application with organization-scoped authentication, role-based access, and Stripe subscription billing.

One account can join multiple organizations. Each organization has its own projects, memberships, invitations, activity log, Stripe customer, and subscription.

Here’s the architecture behind it:

• Authentication establishes identity through hashed, server-side sessions. Every organization request then checks membership and role; project queries stay scoped to that authorized organization.

• Owners manage billing. Admins manage team/project operations. Members create and edit projects. The server enforces these boundaries independently of visible UI controls.

• Stripe-hosted Checkout creates subscriptions and the Customer Portal manages them. The application does not handle card details.

• A success redirect cannot enable paid access. Signed, raw-body webhooks retrieve the current subscription from Stripe, validate customer mapping, and update entitlements transactionally.

• Event-ID deduplication handles repeated webhook delivery. Per-organization locks protect plan quotas and billing state under concurrent requests.

• Starter, Pro, and Business limits are enforced server-side. An active recognized subscription unlocks paid features; non-entitled states fall back to Starter without deleting existing work.

I also built a responsive dashboard with organization switching, project management, team access, invoice history, and an audit log.

Nine automated integration scenarios verify isolation, permissions, quotas, session security, Checkout authorization, webhook signatures/retries, and entitlement changes. External Stripe API calls are mocked in these tests; real sandbox end-to-end verification is the next validation step.

My biggest takeaway: multi-tenancy and billing need clear server-side boundaries. A polished interface is useful, but membership, resource scoping, subscription state, and recovery determine what users can actually access.

Repository: [add your GitHub link]
Live demo: [add your deployed URL]
Architecture: attach docs/architecture.png

#Nexlevr #FullStackDevelopment #SaaS #MultiTenancy #Stripe #NodeJS #SoftwareEngineering

---

Before publishing: replace links; complete the real sandbox checklist; update the verification sentence only with results you actually observed. Remove this review note from the published post. No post has been sent automatically.
