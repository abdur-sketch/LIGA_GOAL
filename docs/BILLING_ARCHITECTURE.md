# Billing Architecture — Phase 15

## Boundary

Billing is an additive domain beside Phase 14 subscriptions. It owns commercial intent and financial evidence; it cannot bypass entitlement logic. Only a verified payment event may call subscription activation. Browser redirects, query parameters, UI state, and client-supplied amount/plan/status are never authority.

```text
Organizer checkout
  -> server catalog validation
  -> BillingOrder + immutable Invoice/InvoiceItem
  -> PaymentAttempt through provider adapter
  -> signed raw webhook
  -> PaymentEvent inbox + PaymentTransaction
  -> idempotent activation
  -> OrganizationSubscription OR scoped CompetitionEntitlement
```

## Components

- `BillingAccount`: organization legal/billing identity and configurable tax profile.
- `BillingOrder`: idempotent purchase intent with immutable catalog snapshot.
- `Invoice`/`InvoiceItem`: issued financial snapshot in integer IDR minor units.
- `PaymentAttempt`: one provider payment request and expiry.
- `PaymentTransaction`: normalized provider result and refund balance.
- `PaymentEvent`: unique `(provider, externalEventId)` inbox with raw payload/signature digests.
- `Refund`/`CreditNote`: append-only correction workflow.
- `BillingAudit`: actor/reason/before/after commercial trail.
- `ReconciliationCase`: durable mismatch/manual-review queue.
- `PlatformPermissionGrant`: finance permission outside tenant roles.

All organization rows use Phase 11 transaction-local tenant context and RLS. Platform finance operations use explicit `finance.billing.view` or `finance.billing.manage`; a tenant role cannot grant either.

## Transaction rules

Checkout is serialized by organization/idempotency advisory lock. Catalog, organization, competition, and season are re-read inside the tenant transaction. Provider mock creation is bounded by timeout/retry; permanent outage rolls the entire checkout back. Webhook processing locks the external payment ID and atomically writes event, transaction, invoice state, activation, and audit. `activationAppliedAt` prevents double activation.

The external adapter must eventually use a saga/outbox boundary if a real provider cannot safely participate in this local transaction. Phase 15 does not pretend the mock transaction pattern is a production network contract.
