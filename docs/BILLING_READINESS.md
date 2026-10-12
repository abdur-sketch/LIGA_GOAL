# Billing Readiness — Phase 14

## Current boundary

The application is structurally ready for a future provider adapter but is intentionally not a payment system. There is no checkout, payment method collection, invoice settlement, provider webhook, refund, tax calculation, payout, or live credential. Organizer CTAs say simulation/coming soon. Production and commercial status remain **NO-GO**.

## Ready components

- Stable five-plan catalog with immutable versions, effective dates, billing model, currency, JSON price configuration, entitlements, and limits.
- One organization subscription plus time-bounded competition/season entitlements.
- Trial, active, grace, past-due, suspended, canceled, and expired states.
- Server-side entitlement decisions independent from RBAC.
- Atomic quota ledger, idempotency, concurrency protection, and reconciliation.
- Audited platform assignment/lifecycle controls with mandatory reasons.
- Organizer pages for current plan, catalog comparison, feature availability, and usage.
- Tenant RLS and globally readable—but runtime read-only—published catalog.

## Required before live billing

1. Owner selects legal entity, payment provider, merchant account, settlement currency/tax treatment, price approval, refund policy, and invoice numbering policy.
2. Introduce provider-neutral `BillingCustomer`, `Invoice`, `PaymentAttempt`, `ProviderEvent`, and refund records through additive migration.
3. Verify webhook signature against raw body; deduplicate provider event ID; store receipt and processing result; retry safely.
4. Map provider events to the audited lifecycle service; never trust browser plan, amount, currency, quota, or status.
5. Implement order preview and explicit user confirmation, invoice delivery, cancellation/refund support workflow, and reconciliation against provider settlement.
6. Wire remaining catalog capabilities to their service mutation/export boundaries before selling differentiated access.
7. Complete legal/privacy review, finance UAT, incident runbook, monitoring, backup/restore evidence, security review, and pilot approval.

## Failure rules

- Duplicate webhook: return idempotent success without a second transition.
- Unknown plan/amount mismatch/signature failure: quarantine, audit, alert; do not grant access.
- Provider outage: preserve current data; follow approved grace policy; do not infer payment.
- Refund/cancel: preserve data and official history; transition access according to policy.
- Reconciliation mismatch: freeze automated entitlement change, retain evidence, and require authorized review.

## Owner decisions still required

Approved prices and tax inclusivity, grace duration, trial eligibility, export availability after expiry, negotiated Enterprise limits, retention/legal hold, refund eligibility, support SLA, and pilot organizations. None is silently assumed by Phase 14 runtime behavior.
