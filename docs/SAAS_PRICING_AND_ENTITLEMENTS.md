# LIGA GOAL — SaaS Pricing and Entitlements

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Commercial hypothesis and architecture only; no live payment

## 1. Pricing principles

- Prices, limits, display copy and eligibility live in a versioned catalog, never in UI or service code.
- Security, tenant isolation, auditability, privacy protection, backup eligibility and accessibility are not paid upgrades.
- RBAC decides whether a user may act; entitlements decide whether the tenant's product includes the capability; quotas decide whether capacity remains.
- Published plan versions are immutable. A price change creates a new version and an explicit migration/renewal policy.
- All money uses integer minor units and ISO currency. Indonesian display uses IDR formatting; tax treatment is explicit configuration.
- Payment success comes only from a verified provider event, never a client redirect.

## 2. Proposed market packages

The amounts below are testable launch hypotheses, not approved prices. They exclude tax and provider fees and must be validated with organizer interviews and pilot economics.

| Plan | Billing model | Working price hypothesis | Best fit |
|---|---|---:|---|
| Free | Recurring zero-price | Rp0 | Organizer evaluating one small competition |
| Tournament | One event/competition access window | Rp750.000 per competition, 120 days | Cup or short tournament |
| Pro League | Monthly per organization, optional annual discount | Rp1.500.000/month | One ongoing league requiring full operations |
| Organizer Pro | Monthly per organization, optional annual discount | Rp3.500.000/month | Professional organizer managing multiple competitions |
| Enterprise | Contract/configured | Custom | Federation, large operator, custom SLO/integration/governance |

Annual discount, trial, reseller and nonprofit terms require owner approval and separate catalog entries. Do not encode a percentage in application logic.

## 3. Initial entitlement matrix

Limits are conservative hypotheses for commercial validation, not measured infrastructure guarantees.

| Entitlement | Free | Tournament | Pro League | Organizer Pro | Enterprise |
|---|---:|---:|---:|---:|---:|
| Active organizations per owner | 1 | 1 | 1 | 3 | Configured |
| Active competitions | 1 | 1 purchased event | 1 | 10 | Configured |
| Competition access window | Ongoing while eligible | 120 days | Subscription period | Subscription period | Contract |
| Clubs per competition | 8 | 32 | 40 | 64 | Configured |
| Registered players per competition | 150 | 1,000 | 2,000 | 5,000 | Configured |
| Active staff seats | 3 | 10 | 20 | 100 | Configured |
| Concurrent live matches | 1 | 4 | 8 | 20 | Configured |
| Storage | 2 GB | 10 GB | 25 GB | 100 GB | Configured |
| Exports per month | 3 | 50 during event | 100 | 500 | Configured |
| Public national listing | Basic | Included | Included | Featured-eligible | Contract policy |
| Fixtures, standings, statistics, bracket | Included | Included | Included | Included | Included |
| Content/news and in-app notifications | Basic | Included | Included | Included | Included |
| Custom organizer branding | No | Event badge | Basic | Advanced | Configured |
| Priority support/SLO | Community | Event support | Business hours | Priority | Contract/SLA |
| API/integration access | No | No | Read-only candidate | Metered candidate | Configured |
| Data export on exit | Included | Included | Included | Included | Included |

“Featured-eligible” does not buy editorial ranking. It makes a competition eligible for a transparent, separately governed campaign/editorial selection. Organic search ranking must not be secretly pay-to-win.

## 4. Feature registry

Suggested stable keys:

| Feature key | Type | Meaning |
|---|---|---|
| `organization.max_active` | integer | Organizations owned/managed under account policy |
| `competition.max_active` | integer | Concurrent non-archived competitions |
| `competition.access_days` | integer/null | Event purchase duration |
| `club.max_per_competition` | integer | Approved/draft club capacity according to documented counting rule |
| `player.max_per_competition` | integer | Registered player capacity |
| `member.max_active` | integer | Active tenant staff seats |
| `match.live_concurrency` | integer | Live-match leases |
| `storage.max_bytes` | integer | Scanned accepted objects retained for tenant |
| `report.exports_per_month` | integer | Successful export generations |
| `portal.national_listing` | enum | `none/basic/full` |
| `portal.branding` | enum | `platform/event/basic/advanced/custom` |
| `integration.api` | enum | `none/read/metered/custom` |
| `support.tier` | enum | `community/event/business/priority/contract` |

Existing domain permissions remain separate feature keys only where commercially necessary. Never create plan-specific branches such as `if plan === "PRO"`; call the entitlement evaluator by feature key.

## 5. Catalog configuration

Conceptual representation:

```yaml
plan_key: TOURNAMENT
version: 1
currency: IDR
billing_mode: EVENT
price_minor: 75000000
tax_mode: EXCLUSIVE
access_days: 120
entitlements:
  competition.max_active: 1
  club.max_per_competition: 32
  player.max_per_competition: 1000
  member.max_active: 10
  match.live_concurrency: 4
  storage.max_bytes: 10737418240
  report.exports_per_month: 50
  portal.national_listing: full
```

This is documentation, not a file to load in production. A future admin-controlled catalog publishes validated immutable versions. Changes require two-person approval, diff preview and audit.

## 6. Usage metering

### Metrics

- gauges: active competitions, active members, clubs, players, stored bytes;
- counters: exports, outbound notifications, API calls;
- leases: concurrent live matches;
- commercial events: Tournament purchase and access-window extension.

### Correctness rules

1. Every usage mutation has a stable event key.
2. Reservation and domain write share one tenant transaction where possible.
3. Accepted object size is finalized only after quarantine/scan succeeds.
4. Failed or canceled operations release reservations.
5. A reconciliation job rebuilds counters from source tables/ledger and records drift.
6. Metering failures default to safe behavior: deny high-cost creation or place it in pending state; do not corrupt domain data.
7. Owner/platform overrides are explicit, expiring and audited.

## 7. Subscription lifecycle

| State | Access behavior |
|---|---|
| `INCOMPLETE` | No paid entitlements; checkout/invoice resolution only. |
| `TRIALING` | Configured trial entitlements with fixed end date; no silent extension. |
| `ACTIVE` | Plan entitlements available through period end. |
| `PAST_DUE` | Short retry window; notify owner; no immediate data deletion. |
| `GRACE` | Configured read/write reductions; public safety and result integrity preserved. |
| `PAUSED` | Tenant read/export/support paths only according to policy. |
| `CANCEL_AT_PERIOD_END` | Active until period end, then downgrade/cancel transition. |
| `CANCELED/EXPIRED` | Free fallback or archived access according to owner policy. |

Downgrade with over-limit data must not delete records. Existing objects remain readable; creation/activation is blocked until usage falls below the new limit or an approved extension applies.

## 8. Tournament/event purchase

The purchase is scoped to `organizationId + competitionId` and optionally `seasonId`. Access begins from an approved activation event, not necessarily purchase initiation, and ends after the configured window. Extensions create additional purchase adjustments; they do not rewrite history. A competition cannot be rebound to another tenant or reused to grant another competition access.

Refund policy must define whether access ends immediately, at a scheduled time or remains through a dispute period. That decision is stored on the refund/subscription transition, not inferred from the provider status alone.

## 9. Invoice architecture

An invoice snapshot includes legal seller/buyer identity references, unique invoice number, currency, issue/due dates, subtotal, discount, tax, total, status and immutable lines. Lines store plan/version, quantity, unit amount, period/event reference and tax classification.

States: `DRAFT → OPEN → PAID | VOID | UNCOLLECTIBLE`, with credit/refund artifacts appended rather than deleting the invoice. Provider receipts do not replace the internal invoice/reconciliation record.

## 10. Payment webhook idempotency

Processing contract:

1. read raw body with bounded size;
2. resolve provider adapter and verify timestamped signature;
3. insert `(provider, externalEventId)` with a unique constraint and payload hash;
4. acknowledge known duplicates without reapplying business state;
5. process through a transition table/state machine;
6. resolve internal billing account and enter its tenant context;
7. update payment/subscription records, append audit/outbox, mark event processed;
8. retry transient failure with backoff; dead-letter and alert permanent mismatch;
9. reconcile provider settlements against internal payment totals daily.

Secrets come from an approved secret manager with overlap during rotation. Logs contain event IDs and status, never signing secrets or sensitive payment payloads.

## 11. Cancellation, refund and grace policy proposal

- Self-service recurring cancellation defaults to period-end.
- Tournament purchases are refund-eligible only under owner-approved conditions, such as duplicate charge or event not activated.
- Partial refunds use integer allocation across invoice lines and preserve total invariants.
- Chargeback/dispute places the billing record under review; it does not automatically erase tenant content.
- Suggested payment grace is 7 days for Pro League and Organizer Pro; Enterprise follows contract. This is a proposal requiring finance approval.
- During grace, existing public results remain available unless the organization itself is suspended for abuse/legal reasons; expensive new operations may be restricted.

## 12. Commercial audit trail

Audit every catalog publication, manual entitlement override, checkout/order creation, invoice transition, webhook receipt/result, subscription transition, grace extension, cancellation, refund, reconciliation mismatch and support access. Manual actions require reason and actor. Financial and security audit retention must be approved separately.

## 13. Commercial validation plan

| Experiment | Evidence | Success criterion to approve |
|---|---|---|
| Problem interview | 10–15 organizers across tournament/league/federation segments | Repeated willingness to pay for operational outcomes, not vanity features |
| Price interview | Van Westendorp/range discussion plus current workflow cost | Clear acceptable range per segment |
| Concierge Tournament pilot | Manual invoice/no live checkout | Completion, support load and margin observed |
| Pro League pilot | One full competition lifecycle | Renewal intent and operational reliability |
| Organizer Pro design partner | Multi-competition tenant | Measured need for seats, reporting, branding and integrations |

No paid conversion should start until legal invoice/tax handling, refunds, privacy terms, support commitments and provider reconciliation are approved.

## 14. Dependencies, estimates and risks

| Work | Estimate | Dependency | Main risk |
|---|---:|---|---|
| Catalog/versioning/admin approval | 2–3 engineer-weeks | Approved matrix | Accidental retroactive plan change |
| Entitlement/quota evaluator and ledger | 3–4 engineer-weeks | Metric definitions | Race conditions and drift |
| Subscription/event purchase state machines | 2–3 engineer-weeks | Lifecycle policy | Conflicting provider/order states |
| Invoice/payment/refund sandbox | 3–4 engineer-weeks | Provider sandbox and finance rules | Incorrect money/tax semantics |
| Webhook/reconciliation/alerts | 2–3 engineer-weeks | Provider contract | Replay, outage and out-of-order events |
| Commercial UAT/security review | 2–3 engineer-weeks | Complete staging flow | Privilege or entitlement bypass |

## 15. Owner decisions required

1. Approve or replace price hypotheses and quota values.
2. Decide tax-inclusive/exclusive display, invoice ownership and Indonesian accounting/legal review.
3. Decide trials, annual discounts, grace, refunds and downgrade behavior.
4. Select a payment provider for sandbox evaluation only.
5. Define which plan features are contractual SLOs versus best effort.
6. Approve editorial policy for featured competitions.

Production checkout and live payment remain disabled. Production remains **NO-GO**.
