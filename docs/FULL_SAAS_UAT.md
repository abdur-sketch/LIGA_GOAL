# Full SaaS UAT — Phase 18

## Environment and result

- Database: `liga_goal_phase18_fresh_20261013`, synthetic data only.
- Fixture/setup: owner connection. Application E2E and RLS checks: `liga_goal_runtime`, `NOBYPASSRLS`, connection limit 5.
- Integration: 81 PASS; 3 SKIP (two S3 emulator tests and concurrent-match fixture test).
- E2E: 50/50 PASS on desktop/mobile Chromium in 3,4 minutes.
- External provider UAT: **NOT TESTED**.

## Journey coverage

| Journey | Evidence | Status |
|---|---|---|
| Register → verify email → create organization | Phase 13 E2E + integration | PASS local adapter |
| Invite/accept/revoke staff, role protection | Phase 13 integration and security tests | PASS |
| Create competition/season | admin and full-chain UAT | PASS |
| Register clubs/players/squads | Phase 2 E2E + full-chain UAT | PASS |
| Generate/publish fixtures | Phase 3 E2E + full-chain UAT | PASS |
| Live match/finalize/review result | Phase 4 E2E + 25-step UAT | PASS |
| Standings/player statistics/public portal | Phase 5/7 E2E + reconciliation | PASS |
| National search | Phase 16 E2E + 10k benchmark | PASS |
| Mock purchase/webhook/entitlement/invoice | Phase 14/15 integration and E2E | PASS mock only |
| Refund simulation/reconciliation | Phase 15 integration | PASS mock only |
| Verify/moderate/appeal/suspend/reactivate | Phase 17 integration/E2E | PASS |
| Real email/payment/storage provider | No credential/provider | NOT TESTED |

## Runtime and isolation evidence

- E2E web process used runtime role while fixture setup used owner URL pointing to the same exact database.
- Cross-database URL mismatch is rejected before runner start.
- Runtime RLS tests cover default deny, cross-tenant access, membership discovery, billing, finance, verification, abuse, and appeals.
- Concurrent quota/idempotency behavior is covered by Phase 14; payment replay and duplicate provider event by Phase 15.

## Harness observations

1. Initial integration run: 80 PASS/1 FAIL/3 SKIP because a transfer fixture used the wall clock exactly on the asserted date. Fixed to deterministic `2026-06-01`; rerun 81 PASS/3 SKIP.
2. Initial realtime load run: 5.842 HTTP 404 because generated fixture IDs had two digits, not three. Invalid run excluded; corrected run and sustained run passed.
3. Alert delivery remains blocked without provider; external-provider UAT must not inherit local PASS.

## Staging UAT still required

- Real provider sandbox checkout/webhook/refund and email delivery/bounce/complaint.
- S3 upload/quarantine/ClamAV/version restore.
- Multi-host session/cookie/TLS/proxy behavior.
- Managed pooler/PITR/failover and worker retry/dead-letter behavior.
- Accessibility, Indonesian copy/legal consent, and pilot organizer sign-off.
