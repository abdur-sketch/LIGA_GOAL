# LIGA GOAL — National SaaS Architecture

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Architecture plan only; no schema, provider, billing, or production change executed

## 1. Architectural decision

Retain the Phase 11 modular monolith and PostgreSQL system of record. Add a SaaS control plane beside the existing competition data plane; do not rewrite the competition engine.

```text
National public portal
          |
          v
Next.js modular monolith
  +-- Identity: login, verification, recovery, invitations
  +-- SaaS control plane: tenant provisioning, plans, entitlements, usage, billing ledger
  +-- Tenant data plane: existing competition modules Phase 1–7
  +-- Platform operations: review, suspension, support, audit, reconciliation
          |
          +--> PostgreSQL: RLS + runtime/migration/backup roles
          +--> S3-compatible public/private/quarantine storage
          +--> Outbox/worker adapters: email, notifications, payment events
          +--> Observability and immutable backup targets
```

The organization remains the tenant boundary. A subscription belongs to an organization, while an event purchase may additionally scope access to one competition/season. Entitlements authorize product capability; RBAC authorizes a person inside the tenant. Both checks are required for paid features.

## 2. Existing capability to reuse

| Capability | Existing source of truth | SaaS decision |
|---|---|---|
| Tenant | `Organization`, including owner and `PENDING/ACTIVE/SUSPENDED/ARCHIVED` lifecycle | Reuse; add provisioning metadata only where necessary. |
| Membership | `OrganizationMember` with one role per tenant and active flag | Reuse; add invitation workflow, not another membership table. |
| RBAC | `Role`, `Permission`, `RolePermission`, `UserPermission`; deny override wins | Reuse and extend the permission-key catalog. |
| Competition operations | Competition, season, stage, group, club, registration, fixture, match, statistics, transfer, injury, discipline, content | Reuse unchanged behind entitlements and quotas. |
| Isolation | Tenant transaction context, non-owner runtime role, default-deny RLS on 74 tables | Preserve; every new tenant table must ship with RLS and tenant A/B tests. |
| Public publication | Explicit public data access, publication predicates, minor consent, sitemap, structured match data | Reuse; add geography, organizer publication controls, and search projection. |
| Audit | `AuditLog` with tenant, actor, action, resource and before/after snapshots | Reuse for administrative and business actions; add correlation/provider metadata if required. |
| Operational jobs | Named job scope and transactional outbox primitives | Reuse pattern; create allow-listed workers rather than general platform bypasses. |
| Rate limiting | PostgreSQL-backed atomic buckets and trusted-proxy handling | Reuse; add signup, verification, invitation, provisioning, search, checkout and webhook buckets. |
| Privacy | Private profile/document separation and guardian-backed `PublicationConsent` | Preserve; discovery must never broaden fields without an explicit publication policy. |

## 3. Bounded contexts

### 3.1 National public portal

Read-only discovery over explicitly published projections. It may expose active organizers, published competitions, approved clubs, published matches, official statistics and consent-eligible players. Public scope must not become an unrestricted platform-admin query path.

### 3.2 Identity and onboarding

Owns account registration, email verification, login/recovery, invitation acceptance and abuse controls. It may access global identity tables through the narrow identity context. It must not create tenant records until email verification and provisioning checks pass.

### 3.3 Tenant control plane

Owns organization lifecycle, membership, roles, plan assignment, entitlements, usage limits and suspension. Provisioning creates the organization, owner role, grants and owner membership in one idempotent transaction.

### 3.4 Competition data plane

The existing Phase 1–7 services remain authoritative. Calls pass through this order:

1. authenticate and revalidate account state;
2. select an active organization membership;
3. bind tenant RLS context;
4. verify RBAC permission;
5. evaluate subscription/entitlement;
6. reserve or check quota for a metered mutation;
7. perform the domain transaction and append audit/outbox records.

Entitlement denial is not a substitute for RBAC denial, and an organization owner is not automatically a platform administrator.

### 3.5 Commercial control plane

Owns versioned plans, price configuration, subscriptions, event purchases, invoices, payment attempts, refunds and provider webhooks. Phase 12 defines the contracts only. All provider adapters remain disabled until a later approved staging phase.

### 3.6 Platform administration

Platform operators need dedicated permissions and audited reason codes for organization review, suspension/reactivation, plan override, invoice adjustment, abuse review and support impersonation. Avoid using a single unrestricted `isPlatformAdmin` decision for routine operations. Break-glass access requires a separate role, short duration, ticket/reason and alert.

## 4. Proposed additive data model

Names are conceptual and require a later schema review. Existing tables are deliberately not duplicated.

### Identity and provisioning

- `EmailVerificationToken`: user/email, hashed token, expiry, consumed timestamp and attempt count.
- `OrganizationInvitation`: organization, normalized email, target role, inviter, expiry, status and hashed acceptance token. Membership is created only on acceptance.
- `TenantProvisioningRequest`: idempotency key, requester, normalized slug, status, failure code and resulting organization ID.
- Optional `UserTermsAcceptance`: versioned terms/privacy acceptance evidence. Do not overload publication consent, which protects player publicity.

### Catalog and entitlements

- `Plan`: stable key (`FREE`, `TOURNAMENT`, `PRO_LEAGUE`, `ORGANIZER_PRO`, `ENTERPRISE`) and lifecycle.
- `PlanVersion`: immutable version, effective dates, currency, billing mode and display configuration.
- `PlanPrice`: amount in minor units, currency, interval/event unit, tax mode and provider price reference; no amount in application code.
- `FeatureDefinition`: stable feature key, value type and enforcement description.
- `PlanEntitlement`: plan version, feature key and typed JSON value (`true`, count, duration or mode).
- `OrganizationEntitlementOverride`: approved, expiring allow/deny/limit override with actor and reason.

### Subscription and event purchase

- `BillingAccount`: organization billing identity and provider customer reference; sensitive tax data minimized.
- `Subscription`: organization, plan version, state, period, trial/grace/cancel timestamps and provider reference.
- `CompetitionPurchase`: organization, competition/season, plan version, access window and status for Tournament/event-based access.
- `SubscriptionChange`: append-only state transition with source, actor, idempotency key and reason.

### Metering and billing

- `UsageLedger`: append-only tenant/metric delta, subject reference, event key, occurred time and source. Unique tenant + metric + event key prevents double count.
- `UsageCounter`: materialized period balance with used/reserved values and optimistic version; rebuildable from ledger.
- `Invoice` and `InvoiceLine`: internal commercial documents with immutable monetary snapshots.
- `PaymentAttempt`: provider-neutral attempt state and provider reference.
- `PaymentWebhookEvent`: provider + external event ID unique, payload hash, received/processed state and error; raw sensitive payload retained only per policy.
- `Refund`: amount, reason, state and provider reference.

`AuditLog` remains the security/audit trail. Commercial ledgers remain separate because money and usage require append-only reconciliation semantics; significant transitions also write an `AuditLog` record.

## 5. Entitlement and quota enforcement

### Evaluation contract

`EntitlementDecision = { allowed, value, source, planVersion, reasonCode, validUntil }`.

Resolution order:

1. organization must be `ACTIVE`;
2. select active event purchase for the competition, otherwise active organization subscription, otherwise Free plan;
3. apply an approved, unexpired organization override;
4. evaluate feature value;
5. compare usage plus reservation against limit;
6. return a stable denial reason suitable for UI and audit.

Cache decisions only with a short TTL and an invalidation event. Security and billing mutations must read authoritative state inside the database transaction.

### Quota patterns

| Metric type | Enforcement |
|---|---|
| Current objects, e.g. active competitions/staff/clubs | Transactional count plus locked reservation; exclude soft-deleted/archived items according to the feature definition. |
| Period usage, e.g. exports or notification sends | Append ledger event and atomically update the period counter. |
| Concurrency, e.g. simultaneous live matches | Lease with expiry/heartbeat; release on finish and recover abandoned leases. |
| Storage | Meter accepted object size after scan; decrement only after retention/deletion workflow completes. |

All mutations that consume quota require an idempotency key. Read-only portal access should be protected by infrastructure/rate limits, not sold through fragile per-request application counters.

## 6. Tenant isolation and RLS plan

- Every new organization-owned table includes `organizationId`, a restrictive foreign key and default-deny RLS using tenant context.
- Relation-owned rows must use a reviewed parent-existence policy, matching the Phase 9 pattern.
- Global catalog tables (`Plan`, `PlanVersion`, `FeatureDefinition`) are read-only to runtime roles and writable only through migration/platform catalog administration.
- Global commercial discovery uses a dedicated named access mode; it must not inherit broad public or platform bypass automatically.
- Billing provider identifiers never authorize tenant selection. The webhook resolves an internal record, then enters that record's tenant context.
- Platform support searches return minimal summaries first. Opening tenant data requires a reasoned, audited tenant-scoped transition.
- RLS test matrix must include tenant A/B reads and writes, missing context, pool reuse, rollback, subscription jobs, webhook processing and platform support flows.

## 7. RBAC additions

Keep the existing permission engine. Add granular keys only when the corresponding feature exists:

- `organization.billing.view`, `organization.billing.manage`
- `organization.subscription.view`, `organization.subscription.manage`
- `organization.invitation.manage`
- `organization.plan_usage.view`
- `platform.organization.review`, `platform.organization.suspend`
- `platform.plan.manage`, `platform.billing.review`, `platform.abuse.review`
- `platform.support.access`, `platform.audit.view`

Suggested tenant roles are Owner, Competition Admin, Registrar, Match Operator, Content Editor, Finance Viewer and Read-only Analyst. The owner role receives product administration permissions but cannot grant platform permissions. High-risk approval separation from Phase 0–11 remains intact.

## 8. Billing architecture without live payment

Use a provider-neutral port:

```text
Catalog/checkout intent -> internal pending order/invoice
                         -> disabled provider adapter in local Phase 12

Provider webhook -> signature verification
                 -> persist unique event + payload hash
                 -> acknowledge duplicate safely
                 -> enqueue/process state transition
                 -> tenant subscription/purchase update
                 -> usage/entitlement cache invalidation
                 -> audit + notification
```

Rules:

- Do not grant service from a browser redirect or client-reported payment result.
- Verify signature against the raw request body and approved secret rotation set.
- Persist the provider event before processing; unique provider/event ID ensures idempotency.
- State machines reject impossible transitions and out-of-order events safely.
- Monetary values use integer minor units plus ISO currency; never floating point.
- Refund does not erase invoice/payment history. It creates a refund record and a subscription decision according to policy.
- Cancellation at period end preserves access until `currentPeriodEnd`; immediate cancellation requires explicit policy and audit.
- Grace period permits controlled read/write behavior by entitlement, not blanket database access.

## 9. Audit and observability

Minimum auditable events: signup verification, provisioning, invitation lifecycle, role/grant change, plan version publication, subscription transition, quota denial/override, invoice issue/void, payment/refund event, organization suspension/reactivation, publication-state change, provider replay and break-glass access.

Do not store secrets, full payment instrument data, reset/invitation tokens, medical documents or unnecessary personal data in audit JSON. Use correlation ID, actor type, tenant, resource, reason code, source IP hash where justified, and provider/event references.

Operational signals include signup/verification conversion, provisioning failures, cross-tenant denial, quota denials, webhook age/retries, entitlement latency, invoice reconciliation mismatch, live-match concurrency, public-search latency and storage scanning backlog.

## 10. Availability and scaling path

1. Pilot: one application instance is acceptable only with managed database/object storage, documented restore, uptime expectation and maintenance window.
2. Commercial launch: at least two stateless application instances, managed load balancer, managed PostgreSQL with PITR, external object storage and independent jobs.
3. National growth: read caching/search projections, separate workers, connection pooler, horizontal web scale and read replicas when measurements justify them.
4. Extract a service only when independent scaling or failure isolation is demonstrated. Billing webhooks and realtime fan-out are likely first candidates; tenant domain services are not.

## 11. Priorities, dependencies and estimates

| Priority | Work package | Estimate | Depends on |
|---|---|---:|---|
| P0 | Account verification, invitation and idempotent tenant provisioning design/implementation | 4–6 engineer-weeks | Product identity policy, email provider for staging |
| P0 | Versioned catalog, entitlement evaluator and quota primitives | 5–7 engineer-weeks | Owner-approved plan matrix |
| P0 | RLS/RBAC expansion and negative tenant tests | 3–4 engineer-weeks | Final schema and access-mode review |
| P1 | Subscription, invoice, webhook and reconciliation sandbox | 5–7 engineer-weeks | Payment provider choice; no live mode |
| P1 | Platform operations and abuse/suspension console | 3–5 engineer-weeks | Support and escalation policy |
| P1 | National discovery projection, geography and organizer profiles | 5–7 engineer-weeks | Public data/privacy approval |
| P1 | Staging infrastructure, observability, backup/restore and provider drills | 4–6 engineer-weeks | Budget and provider approvals |
| P2 | UAT, pilot instrumentation and commercial experiments | 3–4 engineer-weeks | P0/P1 staging readiness |

Range: 32–46 engineer-weeks, plus product, design, security, legal/privacy and operations work. Calendar time depends on team size and external approvals; parallel work must not bypass schema, privacy or security gates.

## 12. Owner decisions required

1. Approve tenant model: subscription per organization with optional competition-scoped Tournament purchase.
2. Approve plan prices, quotas, trial/grace behavior and upgrade/downgrade semantics.
3. Select staging providers/region, payment sandbox, email, storage, malware scanning, observability and secret management.
4. Approve public organizer/geography fields and Indonesian privacy/retention/legal basis.
5. Define platform support roles, suspension appeals and break-glass ownership.
6. Approve SLO/RPO/RTO and budget before any infrastructure is created.

## 13. Phase 12 exit statement

This design is compatible with the Phase 11 tenant and competition model. It does not authorize schema changes, service purchase, production access, deployment or payment activation. Technical planning is complete; production remains **NO-GO**.
