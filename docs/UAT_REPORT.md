# UAT Report

PROJECT: LIGA GOAL
PHASE: 9
DATE: 2026-10-11
ENVIRONMENT: isolated local PostgreSQL / LocalStack, synthetic data only

## Automated evidence

- Fresh deployment of 19 migrations and zero schema drift: PASS.
- Unit 46/46 and integration 39/39: PASS.
- RLS tenant A/B including raw SQL: PASS at the transaction-helper boundary.
- Private S3-compatible storage, cross-tenant denial, clean promotion and EICAR quarantine: PASS locally.
- Realtime two-instance ordered reconnect, restart and failover: PASS locally.
- Desktop/mobile E2E: final serialized run 32/32 PASS. The initial parallel 28/32 exposed shared-seed races; the harness was serialized and CMS locator scoped.

## Mandatory single 25-step flow

| Steps | Status | Evidence |
|---|---|---|
| 1–10 organization through fixture publication | Covered independently | Phase 1–3 integration and E2E. |
| 11–17 lineup through OFFICIAL result | Covered independently | Phase 4 sequential integration. |
| 18–21 standings, scorer, suspension and blocked lineup | Covered independently | Phase 5–6 integration. |
| 22–25 transfer, history, bracket/export and public portal | Covered independently | Phase 3/5/6/7 integration and E2E. |
| All 25 in one uninterrupted dataset | **NOT TESTED** | No single execution artifact proves the complete chain. |

Negative cases independently covered: cross-tenant access, unauthorized approval, duplicate events, optimistic concurrency, official correction, realtime reconnect, and storage failure/quarantine. They were not all executed inside one 25-step run.

## Decision

**FAIL release gate.** Strong component evidence does not satisfy the explicit acceptance criterion. A football operations owner must execute and sign one clean sequential workflow, recording entity IDs, expected/actual standings and scorers, suspension/lineup decision, transfer history, bracket/export checks, public URLs, audit entries and screenshots.
