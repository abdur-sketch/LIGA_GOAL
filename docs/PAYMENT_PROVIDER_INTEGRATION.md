# Payment Provider Integration — Phase 15

## Implemented adapter

Only `MOCK_LOCAL` is enabled. It supports create, inquiry, signed event generation, refund simulation, bounded timeout, and three-attempt retry. It creates no network request and accepts no money. A production process refuses the fallback webhook secret; local development may use the documented local-only default.

No Midtrans or Xendit signature, endpoint, status, refund behavior, or webhook contract was invented. External sandbox integration is **BLOCKED** because no owner-selected provider or approved sandbox credentials were supplied.

## Provider interface requirements

A future adapter must return provider payment ID, checkout reference, expiry, normalized status, transaction ID, refund ID, and inquiry state. It must verify the provider's official raw-body signature/timestamp contract before parsing. Secrets belong in an approved secret manager and must never enter logs, database payloads, browser bundles, or documentation.

## Activation contract

Provider adapters cannot edit subscriptions. A verified normalized event enters the common inbox/state machine; only that workflow may activate Phase 14 entitlements. Successful browser redirect is informational. Duplicate provider event and transaction IDs are unique. Amount, currency, plan/version, organization, competition, and season come from internal records.

## Sandbox onboarding checklist

Owner selects provider and grants sandbox-only credentials; engineering reads official current documentation, implements signature and status mapping, records contract fixtures, tests timeout/retry/out-of-order/refund/inquiry, rotates secrets, and runs staging reconciliation. Production keys, live merchant activation, or real charge require separate written approval.
