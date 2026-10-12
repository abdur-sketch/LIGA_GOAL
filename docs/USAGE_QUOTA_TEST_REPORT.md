# Usage & Quota Test Report — Phase 14

Executed locally on 12 October 2026 against PostgreSQL databases dedicated to Phase 14.

## Design under test

`UsageCounter` stores authoritative used/reserved values by organization, metric, scope, and period. `UsageEvent` is the immutable reservation/commit/reconcile ledger. A PostgreSQL transaction-scoped advisory lock serializes a quota key. The service refreshes actual usage, reserves capacity, performs the business mutation, commits the event, and releases the reservation in one transaction. Unique event keys prevent a committed request from being replayed.

Metrics implemented: `competition.active`, `member.active`, `club.per_competition`, `player.per_competition`, and `export.monthly`. Current Phase 14 mutation wiring exercises competition, member, and club metrics; the player/export metrics are ready for their commercial module rollout.

## Results

| Test | Result | Evidence |
|---|---|---|
| Two concurrent Free competition creates | PASS | Exactly one fulfilled; the second was rejected at quota 1 |
| Idempotency replay | PASS | Reuse of committed event key returned conflict; no duplicate resource |
| Authoritative reconciliation | PASS | Counter became used=2, reserved=0 and emitted `RECONCILE` |
| Downgrade with two existing competitions | PASS | Both rows preserved; further write restricted |
| Expired subscription | PASS | Write decision denied; read decision allowed |
| Competition-scoped entitlement | PASS | Tournament override resolved only for selected competition |
| Cross-tenant billing snapshot | PASS | Tenant A denied access to tenant B |
| Catalog mutation by runtime role | PASS | RLS rejected update |
| Default-deny commercial tables | PASS | Runtime sees zero rows without tenant context |

## Automated suite

- Unit: 51/51 passed across 16 files.
- Integration: 58/58 passed; 5 environment-conditional tests skipped across 18 files.
- E2E: 38/38 passed using desktop Chromium and Pixel 7/mobile Chromium.
- Fresh migration: 23/23 migrations; five catalog plans present.
- Upgrade migration: Phase 13 (22 migrations) to Phase 14 (23); legacy organization backfilled `ENTERPRISE:ACTIVE`.
- Schema drift: none.

## Operational reconciliation

Only platform admins can reconcile. A reason of at least eight characters is required. The operation locks the same quota key used by requests, calculates actual usage from tenant data, clears reservations, records a ledger event, and writes a shared audit log. Scheduled reconciliation is not enabled locally; Phase 15/operations must choose a schedule and alert thresholds.
