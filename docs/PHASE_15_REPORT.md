# LIGA GOAL — Phase 15 Report

Date: 12 October 2026
Execution: local + local mock payment only
Local technical status: **PASS**
Production/commercial status: **NO-GO**

## BASELINE

Branch `main`, HEAD `eb54479aad5c25dfbff051a68a1bfc4aea2f7b47`. All uncommitted Phase 12–14 files were preserved. Phase 11 snapshot remains `/tmp/liga-goal-phase11-source-20261011-214700`. Migration history started at 23. Phase 12–14 architecture, onboarding, security, subscription, quota, and billing-readiness documents were reviewed. Baseline TypeScript, ESLint, Prisma, and 51 unit tests passed.

## IMPLEMENTED FEATURES

Separate billing account/order/invoice/payment/refund/reconciliation domain; immutable financial snapshots and PDF; provider abstraction with mock; signed idempotent webhook; payment-driven subscription/scoped entitlement activation; organizer checkout/invoice/transaction UI; finance console and permissions; refund/credit note; provider/internal reconciliation.

## DATABASE MIGRATIONS

Additive migration `20261012150000_phase_15_billing`; 24 total migrations. Fresh 0→24 PASS, upgrade 23→24 PASS, schema drift none. Eleven tenant billing tables have RLS; `PlatformPermissionGrant` has platform-only RLS. Foreign keys, unique event/transaction/invoice/idempotency constraints, and issued-invoice immutability triggers are present. No destructive migration.

## PAYMENT ADAPTER

`MOCK_LOCAL` only: creation, inquiry, HMAC raw webhook, normalization, timeout/retry, and refund simulation. External sandbox: **BLOCKED — provider and official credentials not supplied**. No production API key or live payment.

## INVOICE ENGINE

Unique `LG-YYYYMM-*` invoice and `CN-YYYYMM-*` credit-note numbers; IDR minor-unit `BIGINT`; catalog/plan/version/scope, seller/buyer/tax, and item snapshots; configurable tax profile; PDF explicitly marked simulation. Issued financial values/lines cannot be silently rewritten.

## SUBSCRIPTION INTEGRATION

Only verified processed `PAID` event invokes activation. Organization purchases update `OrganizationSubscription`; Tournament/Pro League purchases create competition/season entitlement. Replay cannot extend twice. Full refund cancels matching access without deleting data.

## RLS

Runtime `liga_goal_runtime` is non-superuser and `NOBYPASSRLS`. No-context finance tables return zero; tenant A sees only tenant A. Finance console requires platform identity plus explicit finance grant and does not grant player medical/private-document access.

## SECURITY

Forged signature, tampered amount, replay and concurrent events, concurrent checkout, plan/price tampering, payment expiry, cross-tenant access, unauthorized refund, out-of-order event, provider outage/rollback, full/partial refund, refund replay, invoice rewrite, and activation retry passed. Browser status/redirect never activates access.

## TEST RESULTS

- TypeScript, ESLint, Prisma validate: PASS.
- Unit: 53 PASS.
- Integration standard: 67 PASS, 5 opt-in skip.
- Phase 11 membership-runtime opt-in: 1 PASS; 25-step full UAT opt-in: 1 PASS.
- Fresh/upgrade migration and drift: PASS.
- Production build: PASS, 71 static pages.
- E2E full regression: 42/42 PASS across desktop and mobile, including all Phase 15 billing and finance scenarios.

## CONDITIONAL SKIPS

Three remain non-billing/environment-bound after relevant opt-ins were executed: concurrent operator requires missing fixed fixture `phase11-load-050`; object-store and restore drill require `S3_ENDPOINT`. Phase 14 RLS and Phase 15 RLS ran with the real runtime role. Skips are not reported as passes.

## REMAINING BLOCKERS

Real sandbox adapter, official provider contract/fixtures, legal seller identity, Indonesian tax/invoice review, approved refund/grace/dispute policy, settlement reconciliation, staging secrets/IAM, monitoring, security review, finance UAT, and release approval. Production remains NO-GO.

## OWNER ACTION REQUIRED

Select Midtrans/Xendit/other provider for sandbox; supply sandbox-only credentials; approve prices/tax/invoice/refund/grace policies; name finance reconciliation owner; approve platform finance grant process and retention; authorize staging separately.

## COMMIT STATUS

No commit. Existing dirty worktree intentionally preserved.

## DEPLOYMENT STATUS

No push, deploy, paid service, production access, production key, or real transaction. STOP after Phase 15.
