# LIGA GOAL — Phase 14 Report

Date: 12 October 2026
Execution: local only
Phase 14 technical acceptance: **PASS**
Production/commercial status: **NO-GO**

## BASELINE

- Branch `main`, baseline HEAD `eb54479aad5c25dfbff051a68a1bfc4aea2f7b47`.
- Existing uncommitted Phase 12–13 source and documentation were preserved.
- Phase 11 snapshot verified at `/tmp/liga-goal-phase11-source-20261011-214700` (273 files).
- Seven Phase 12 and four Phase 13 documents were reviewed. Existing Organization, Competition, Season, Membership, RBAC, and RLS boundaries were reused; no competition module was rebuilt.
- Baseline before Phase 14: TypeScript PASS, ESLint PASS, unit 49/49 PASS, Prisma validate PASS.

## IMPLEMENTED FEATURES

- Versioned five-plan catalog, organization subscriptions, scoped competition/season entitlements, lifecycle controls, central entitlement engine, atomic usage ledger, safe downgrade/read-only behavior, organizer billing/plan/usage UI, and platform subscription administration.
- New self-service organizations receive Free v1 transactionally. Existing organizations are backfilled Enterprise v1 for Phase 0–13 compatibility.
- No payment provider or real billing side effect was added.

## PLAN CATALOG

`FREE`, `TOURNAMENT`, `PRO_LEAGUE`, `ORGANIZER_PRO`, and `ENTERPRISE` v1 are stored as data with stable codes, effective dates, currency, provider-neutral price JSON, and feature rows. See `SAAS_ENTITLEMENT_MATRIX.md`.

## SUBSCRIPTION MODEL

One subscription is unique per organization. Supported states: trial, active, grace period, past due, suspended, canceled, expired. Tournament/league access can be bounded to competition or season. Inactive commercial states deny writes but retain reads and data. See `SUBSCRIPTION_LIFECYCLE.md`.

## ENTITLEMENT ENGINE

`src/modules/phase14/service.ts` is server-authoritative. It resolves scoped entitlement before organization subscription, applies effective status/time, and returns stable reason codes. RBAC authorization and entitlement checks are separate. Provisioning mutation paths enforce competition, staff, club, and season capabilities; UI state is informational only.

## QUOTA ENFORCEMENT

Reservations use PostgreSQL advisory transaction locks, authoritative counts, unique idempotency events, and reserve/commit events in the same business transaction. Platform reconciliation is authorized and audited. See `USAGE_QUOTA_TEST_REPORT.md`.

## DATABASE MIGRATIONS

- Additive migration: `20261012140000_phase_14_subscriptions`.
- New models: Plan, PlanVersion, PlanFeature, OrganizationSubscription, CompetitionEntitlement, UsageCounter, UsageEvent, SubscriptionAudit.
- Fresh install: PASS, 23 migrations.
- Upgrade Phase 13→14: PASS, 22→23 migrations; compatibility backfill verified.
- Prisma validate/format: PASS. Schema drift: no difference.
- No destructive migration was executed.

## RLS

RLS enabled on all eight new tables. Commercial state uses the Phase 11 tenant boundary. Catalog runtime access is limited to published active rows and has no write policy. Runtime role `liga_goal_runtime` is `NOBYPASSRLS`; tests confirmed default deny, tenant visibility, cross-tenant isolation, and catalog write denial. Provisioning has a narrowly scoped policy that only permits the verified owner’s active Free subscription.

## SECURITY TESTS

PASS: cross-tenant subscription denial, permission plus entitlement, unauthorized admin assignment, fake plan tampering, concurrent quota bypass, idempotency replay, safe downgrade, expiration read-only behavior, scoped entitlement, trial lifecycle audit, reconciliation audit, runtime catalog mutation denial, and platform mutation rate limiting implementation.

## REGRESSION

- TypeScript: PASS.
- ESLint: PASS.
- Unit: 51 passed.
- Integration: 58 passed, 5 environment-conditional skipped.
- E2E: 38 passed across desktop and mobile Chromium, including organizer billing and platform controls.
- Production build: PASS; 66 static pages generated and new dynamic routes compiled.

## KNOWN ISSUES

- Live payments, invoices, refunds, webhooks, and provider reconciliation are intentionally absent.
- Catalog capabilities not yet sold commercially must be wired to their owning module’s mutation/export boundary before differentiated access is activated; Phase 14 wires the provisioning/quota-critical paths.
- Enterprise limits and price remain contract-configured. Automated periodic reconciliation and billing alerts are not scheduled.
- Local test databases are evidence only; no production environment was accessed.

## REMAINING BLOCKERS

Production remains blocked by provider/legal/finance decisions, complete feature-boundary rollout, staging UAT, security review, monitoring and incident runbooks, restore evidence, pilot validation, and explicit release approval. See `BILLING_READINESS.md`.

## FILES CHANGED

Phase 14 changed the Prisma schema/migration; entitlement, provisioning, and management services; organizer billing pages; platform subscription API/UI/navigation; permissions/E2E setup; Phase 14 unit/integration/E2E tests; and these five documents. Earlier uncommitted Phase 12–13 files remain present and were not discarded.

## COMMIT STATUS

No commit created. Working tree remains intentionally dirty.

## DEPLOYMENT STATUS

No push and no deployment. No paid service, production access, real payment, or live billing was used. Production status remains **NO-GO**.
