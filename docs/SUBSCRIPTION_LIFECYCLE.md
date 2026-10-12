# Subscription Lifecycle — Phase 14

## States

| State | Writes | Reads | Exports | Exit |
|---|---|---|---|---|
| `TRIAL` | Allowed by plan | Allowed | Allowed by plan | active, suspended, expired |
| `ACTIVE` | Allowed by plan | Allowed | Allowed by plan | grace, past due, suspended, canceled, expired |
| `GRACE_PERIOD` | Denied | Allowed | Allowed when entitled | active or expired |
| `PAST_DUE` | Denied | Allowed | Allowed when entitled | active, suspended, canceled |
| `SUSPENDED` | Denied | Allowed | Allowed when entitled | active or canceled |
| `CANCELED` | Denied | Allowed | Allowed when entitled | active or expired |
| `EXPIRED` | Denied | Allowed | Allowed when entitled | active through audited assignment/reactivation |

Time-bound trial, current period, grace, competition, and season entitlement dates are evaluated on the server. Expired timestamps resolve to effective `EXPIRED` even if a delayed maintenance job has not persisted the state yet.

## Controlled operations

- Assign plan: platform admin only; stable plan code and version are resolved from the database.
- Extend trial: 1–90 days, required reason, existing subscription required.
- Suspend/reactivate/cancel/expire: platform admin only, required reason.
- Every control writes `SubscriptionAudit` before/after evidence and the shared `AuditLog` inside the tenant transaction.
- The platform mutation endpoint has a database-backed rate limit of 20 controls per admin/organization/hour.
- Tenant roles, including owner, cannot grant platform administration.

## Downgrade and data policy

Downgrade changes future capabilities; it does not delete competitions, matches, official results, player records, or statistics. Objects above the new quota remain readable. Creation is blocked until actual usage is within quota or the plan is upgraded. Subscription expiry and suspension are read-only states. Organization deletion remains a separate, explicit lifecycle operation; it is never caused by billing state.

Reactivation does not recreate data. Usage reconciliation reads authoritative business tables and resets stale reservations before new quota checks.

## Trial and abuse controls

Trial assignment is a privileged platform action, not a client field. Trial extension is bounded and audited. Organization provisioning is idempotent, email identity must be verified, and the provisioning RLS policy permits only an active Free subscription. Self-service users cannot select a paid plan or modify catalog data.

## Phase 15 hand-off

Payment webhooks may request these transitions later, but must not write subscription tables directly. They must pass verified provider events through an idempotent billing adapter, retain provider event IDs, and invoke the audited lifecycle service. No gateway, checkout, invoice payment, refund, or live webhook is active in Phase 14.
