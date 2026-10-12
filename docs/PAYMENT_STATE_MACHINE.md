# Payment State Machine — Phase 15

## Attempt and transaction states

```text
CREATED -> PENDING -> PAID/SUCCEEDED
                   -> FAILED
                   -> EXPIRED
                   -> CANCELED
PAID -> PARTIALLY_REFUNDED -> REFUNDED
PAID ----------------------> REFUNDED
```

Invoice: `DRAFT -> OPEN -> PAID -> PARTIALLY_REFUNDED -> REFUNDED`; `DRAFT/OPEN -> VOID`; `OPEN -> UNCOLLECTIBLE`. Reverse transitions such as `PAID -> OPEN` and `REFUNDED -> PAID` are invalid.

## Event handling

1. Verify exact raw bytes with HMAC-SHA256 and constant-time comparison.
2. Parse bounded payload into the provider-neutral schema.
3. Resolve the payment using platform scope, then re-enter its tenant transaction.
4. Lock the payment and deduplicate provider event ID.
5. Verify currency and integer amount against the server invoice.
6. Reject invalid/out-of-order transitions and preserve rejection evidence.
7. For paid only: mark transaction/invoice paid and apply activation once.
8. Acknowledge exact replay without repeating any business effect.

Terminal success cannot regress to failed/expired/canceled. An expired or canceled payment cannot later activate access automatically. A provider-specific late settlement policy requires manual reconciliation until a real provider contract is approved.

## Subscription effects

- Tournament and Pro League purchase with competition scope creates/extends only that `CompetitionEntitlement`, optionally narrowed to season.
- Organizer Pro and Enterprise organization purchase update `OrganizationSubscription` with a verified event reason.
- Full refund cancels the corresponding scoped entitlement or organization subscription but never deletes tenant data.
- Partial refund changes financial status only; access adjustment requires an approved commercial policy.
