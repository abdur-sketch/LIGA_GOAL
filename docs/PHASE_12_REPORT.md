# LIGA GOAL Phase 12 Report

PROJECT: LIGA GOAL
PHASE: 12 — National SaaS Architecture & Commercial Readiness
DATE: 2026-10-12
EXECUTION: Local audit and planning only
BASELINE: Phase 11 local technical readiness PASS; production NO-GO

## Executive result

Phase 12 planning is complete. The existing application is a strong multi-tenant competition-management baseline and should be extended, not rebuilt. Organization tenancy, membership/RBAC, PostgreSQL RLS, full competition operations, public publication controls, privacy consent, audit logging and operational hardening already exist.

The application is **not yet a self-service commercial SaaS**. Account registration/verification, invitations, idempotent tenant provisioning, plan catalog, entitlements, quotas, subscriptions, invoices, payment webhooks, organizer profiles, normalized geography, national search, platform commercial operations and production providers are not implemented.

**Technical baseline:** PASS for local Phase 11 scope.
**Phase 12 architecture/planning:** COMPLETE.
**Commercial readiness:** DESIGN READY, IMPLEMENTATION REQUIRED.
**Production:** **NO-GO**.

No paid service, production access, schema change, destructive migration, live payment, commit, push or deployment occurred.

## 1. Baseline and source preservation

| Check | Result | Evidence |
|---|---|---|
| Initial worktree | PASS | `main`; no tracked/untracked source change at audit start; ignored local `.env` preserved. |
| Local branch vs local remote-tracking ref | PASS | `main...origin/main = 0/0`. |
| Remote source | PASS at check time | GitHub `HEAD` and `refs/heads/main` returned `eb54479aad5c25dfbff051a68a1bfc4aea2f7b47`, matching local HEAD. No fetch/push performed. |
| Git object integrity | PASS with informational unreachable objects | `git fsck --full` reported dangling trees only; no corrupt/missing object. |
| Phase 11 source snapshot | PASS integrity / NOT durable | `/tmp/liga-goal-phase11-source-20261011-214700` exists, contains 273 files and recalculates to SHA-256 `c4c3d9bf44d0a355091d9dfe3ca3a3a2f6b9a02087b2ceab69746dfa9251f1f2`, matching Phase 11 report. `/tmp` is ephemeral and is not an approved durable backup. |
| Database migration state | PASS local | 21 migrations applied; Prisma reports schema up to date. |
| RLS count | PASS baseline | 74 PostgreSQL tables have RLS enabled in the local database. |

Phase 12 adds only the seven requested Markdown documents as uncommitted files. A production build transiently rewrote generated `next-env.d.ts`; it was restored exactly to the pre-audit tracked content. No pre-existing work was discarded.

## 2. Existing feature audit

| Area | Existing capability | SaaS readiness |
|---|---|---|
| Identity | Credentials login, bcrypt password validation, generic recovery, single-use hashed reset token, eight-hour JWT session, account-state revalidation and global session revocation | Strong baseline; missing registration, email verification, MFA decision and invitation acceptance |
| Tenant management | Organization owner/status, platform-admin creation, member assignment, tenant selector | Tenant model exists; creation is intentionally platform-admin-only and not self-service |
| RBAC | Organization roles, global permission catalog, role grants, per-user allow/deny override, server-side guards | Reusable; needs SaaS/billing/platform-operation permissions and grant guardrails |
| RLS/data boundary | Tenant transaction context, public/job/identity/membership access modes, runtime role plan, 74 tenant RLS tables, pool-reuse and tenant A/B evidence | Strong defense in depth; new SaaS tables/jobs/webhooks need equivalent policies/tests |
| Organization/competition | Organization, competition, season, rules, venues, officials and assignments | Reusable |
| Clubs/players | Clubs, teams, player profiles/private profiles/documents, registration, eligibility and squads | Reusable with plan quotas |
| Fixtures/formats | Stages, groups, draw, round robin/knockout, preview/validation/publication, bracket legs and scheduling | Reusable |
| Live match | Lineup, match transitions, idempotent/revisioned events, clock, realtime outbox/replay, review and official corrections | Reusable; concurrent live-match entitlement needed |
| Statistics | Official snapshots, standings, team/player statistics, leaderboards, adjustments, recompute jobs and exports | Reusable; export quotas and worker capacity needed |
| Player operations | Transfers/windows/approvals, availability, injury/clearance, discipline/appeal and suspensions | Reusable |
| Content/public portal | Public matches, competitions, clubs, players, standings, statistics, articles, follows/notifications, reports, sitemap/robots/structured event data | Strong baseline; geography/search/organizer/featured governance missing |
| Privacy | Private-document authorization, medical/public controls, adult-or-consent publication, minor guardian evidence and consent withdrawal | Technical baseline; legal notice, retention and regulatory approval remain open |
| Upload/storage | Magic-byte/size checks, public/private/quarantine, local and S3-compatible adapters, malware abstraction and local restore evidence | Production storage/scanner/IAM/restore provider blocked |
| Observability | Correlation ID, structured logging, health/readiness, protected metrics, threshold alerts/webhook adapter | External dashboards, log/alert delivery and on-call blocked |
| Backup/recovery | Encrypted PostgreSQL backup/restore scripts and local drill; storage restore drill evidence | Production PITR, immutable/separate-domain retention and provider drill blocked |
| Audit | Tenant/actor/action/resource before/after audit records across major mutations | Reuse; commercial/support/break-glass event taxonomy needs extension |

## 3. SaaS capability audit

### Available now

- organization as primary tenant boundary;
- owner and membership relationships;
- granular tenant RBAC with deny overrides;
- organization suspension/archival states;
- broad tenant-scoped operational data model;
- platform-admin organization management;
- auditable domain actions and idempotent event patterns;
- public/private publication separation;
- local capacity, RLS, UAT, migration, restore and regression evidence.

### Partially available

- tenant provisioning logic exists only behind platform administration;
- organization suspension exists as state, but self-service lifecycle/appeal/grace/export policies do not;
- public portal exists, but national geography/search/organizer discovery does not;
- notification/outbox patterns exist, but verification/invitation/commercial workers do not;
- provider adapters exist for some operational needs, but no approved production providers;
- audit logging exists, but commercial ledger/reconciliation semantics do not.

### Missing

- signup and verified-email lifecycle;
- staff invitations and safe owner transfer;
- idempotent self-service provisioning and automated/manual risk review;
- versioned plan/price catalog;
- feature entitlements, overrides, quota reservation/metering and reconciliation;
- subscription, Tournament purchase, billing account, invoice, payment attempt, refund and webhook event models;
- payment sandbox integration and finance reconciliation;
- organization billing/usage UI and platform commercial console;
- normalized province/regency/city data and public organizer profiles;
- governed featured placement, search projection and moderation/reporting;
- commercial support/SLO, tax/invoice, terms and retention approvals.

## 4. Multi-tenant, RBAC, RLS and data-path audit

### Tenant boundary

`Organization.id` is consistently the primary tenant key. Many entities carry it directly; relation-owned entities use parent relationships. Compound uniqueness and service checks reject common cross-tenant relations. Existing code binds a selected organization to a transaction-local PostgreSQL context, so context does not survive a transaction or leak through pool reuse.

### Request paths

| Path | Boundary | Assessment |
|---|---|---|
| Auth login/session/recovery/revoke | Dedicated identity scope over global user/token records | PASS local Phase 11; global identity tables intentionally are not tenant tables |
| Organization discovery | Membership scope exposes only active memberships for current identity, followed by tenant reread | PASS local |
| Tenant admin APIs | Authenticate, extract tenant, bind tenant transaction, then DAL authorization/permission | PASS baseline; untrusted tenant ID does not grant access |
| Platform admin APIs | Explicit platform scope and `isPlatformAdmin` | Functional; needs granular platform roles/reason codes before national operations |
| Public portal | Explicit public scope plus active/published/consent predicates | PASS baseline; privileged public scope must remain allow-listed |
| Background jobs | Named global discovery then per-tenant work | PASS for tested Phase 11 jobs; every new meter/webhook/index job needs the same pattern |
| CLI/bootstrap/backup | Separate migration/backup URLs and explicit entrypoints | PASS control design; production IAM mapping unverified |

### RLS observations

- Local database confirms 74 RLS-enabled tables and 21 applied migrations.
- Tenant tables use default-deny `app_tenant_allowed` policies; relation-owned tables use parent existence.
- `OrganizationMember`/`Organization` add narrow membership-discovery policies.
- `AuditLog` allows organization-less append only in identity scope.
- Global tables such as `User`, `PasswordResetToken`, `Permission`, `BackgroundJob` and `RateLimitBucket` intentionally do not use tenant RLS. Their safety depends on restricted runtime grants and allow-listed DAL/access modes. Before self-service, perform a dedicated privilege audit so tenant-domain code cannot freely query global identity/commercial data after an application-layer defect.
- Platform/public/job scope remains a privileged application capability; a future commercial control plane should use narrower named modes rather than expanding the generic platform bypass.

### RBAC observations

- The permission catalog covers organization, competition, season, club, player, registration, fixture, match, statistics, transfer, availability, injury, discipline, content, reports and audit.
- Organization owner grants are created with the tenant and remain separate from platform admin.
- Platform admin bypasses tenant permission checks for authorized platform operations; Phase 12 recommends splitting this into granular platform roles before support/commercial use.
- Current membership supports one role per user per organization. This is sufficient for launch if role design is careful; do not add a many-role join unless a proven use case exceeds overrides/role design.

## 5. Architecture decisions

1. Keep the modular monolith and PostgreSQL; no rebuild or premature microservices.
2. Keep organization as tenant and add a SaaS control plane beside the existing competition data plane.
3. Subscription belongs to organization; Tournament purchase may scope entitlements to one competition/season.
4. Reuse membership/RBAC, organization lifecycle and `AuditLog`; add only invitation, verification, catalog, entitlement, usage and commercial ledger entities.
5. All new tenant tables receive RLS; global catalog/commercial jobs receive narrow named access modes.
6. Use versioned configuration for plans/prices/limits; no hardcoded price/plan branches.
7. Start national search with PostgreSQL projection/full-text/trigram; procure a search provider only after measured need.
8. Live payment remains disabled. A provider-neutral sandbox adapter and idempotent webhook inbox precede activation.
9. Hybrid VPS + managed PostgreSQL/storage is the recommended first pilot candidate; fully managed PaaS is the operational-simplicity alternative. Single VPS is not national production architecture.

## 6. Priority backlog

| Priority | Outcome | Main dependencies | Estimate |
|---|---|---|---:|
| P0 | Verified registration, invitation and idempotent tenant provisioning | Email sandbox, identity/terms policy | 4–6 engineer-weeks |
| P0 | Catalog, entitlement evaluator, quotas and reconciliation | Approved commercial matrix | 5–7 engineer-weeks |
| P0 | SaaS RLS/RBAC/global-privilege hardening | Final data model and security review | 3–4 engineer-weeks |
| P0 | Publication settings, geography and organizer verification | Privacy/publication approval, taxonomy | 4–6 engineer-weeks |
| P0 | Production-shaped staging foundation | Budget/provider/IAM approval | 4–6 engineer-weeks |
| P1 | Subscription/event purchase/invoice/webhook sandbox | Payment/finance policy | 5–7 engineer-weeks |
| P1 | National search/featured/SEO scaling | P0 portal projection and moderation | 5–7 engineer-weeks |
| P1 | Platform operations, suspension/appeal/support controls | Operating model | 3–5 engineer-weeks |
| P1 | Full staging UAT, security and recovery/load drills | All P0 plus providers | 3–5 engineer-weeks |
| P2 | Pilot and commercial validation | Signed pilot scope and readiness gates | 3–5 calendar weeks |

Portfolio planning range is approximately **32–46 engineer-weeks**, with overlap among work packages. This is not a calendar commitment and excludes legal, finance, design, operations and external security work.

## 7. Risk register

| Risk | Severity | Mitigation/gate |
|---|---|---|
| Entitlement or webhook bypass grants paid access incorrectly | HIGH | Server-side evaluator, raw-body signature, unique webhook inbox, state machine and reconciliation |
| New control-plane query bypasses tenant isolation | HIGH | RLS-first schema review, narrow access modes, runtime-role tenant A/B and pool-reuse tests |
| Signup/provisioning abuse creates cost or malicious public pages | HIGH | Verification, rate/risk controls, pending review, quotas, moderation and kill switch |
| Public discovery exposes private/minor data | HIGH | Field allowlist, consent-aware projection, removal SLA and privacy review |
| Platform-admin compromise becomes national blast radius | HIGH | Granular platform roles, MFA decision, short-lived break-glass and alerts |
| Provider/storage/database failure loses data | HIGH | Managed PITR, separate encrypted backups, object versioning and paired restore drills |
| Pricing/quotas do not match organizer value or infrastructure cost | MEDIUM | Concierge pilots, usage metering and versioned catalog |
| Single VPS chosen as production shortcut | HIGH | Release gate rejects national launch without required availability/recovery evidence |
| Global identity/catalog tables overexposed to runtime role | HIGH design concern | Explicit least-privilege grant audit and dedicated DAL/access modes before self-service |
| Operational/support load exceeds small team capacity | MEDIUM | Invited rollout rings, support metrics and stop criteria |
| Regulatory/tax/privacy obligations unresolved | HIGH | Named legal/finance owner and written approval before commercial/live payment launch |

## 8. Verification performed in Phase 12

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | PASS |
| ESLint (`npm run lint`) | PASS |
| Unit tests (`npm test`) | PASS — 46/46 across 14 files |
| Environment validation | PASS when `.env` is explicitly exported; the standalone npm script does not automatically load `.env`, a low-priority developer-experience issue |
| Production build (`npm run build`) | PASS — 55/55 static pages generated |
| Production dependency audit | PASS — 0 reported vulnerabilities at audit time |
| Prisma migration status | PASS — 21 migrations, up to date |
| Integration/E2E/capacity/UAT | Not rerun because Phase 12 changed documentation only; Phase 11 evidence remains 51 integration scenarios, 32 runtime-role E2E and 25-step UAT PASS |

These checks are not a penetration test and do not validate any production provider.

## 9. Infrastructure recommendation

Planning estimates use USD 1 = Rp16.500 and official provider price pages checked on 2026-10-12:

| Option | Indicative monthly range | Decision |
|---|---:|---|
| Single VPS | USD 41–61 / Rp0,68–1,01 juta | Development or explicitly risk-accepted limited pilot only |
| Hybrid app VPS + managed DB/storage | USD 74–99 lean pilot; USD 156–206+ commercial baseline | **Recommended pilot candidate** |
| Fully managed app platform + managed DB/storage | USD 92–135 pilot; USD 191–286+ commercial baseline | Recommended alternative when operational simplicity justifies cost |

Actual cost requires provider/region, traffic, HA, storage, email/scanner/observability and tax decisions. No service was purchased.

## 10. Release sequence

1. Source checkpoint
2. Staging infrastructure
3. Provider integration
4. Staging UAT
5. Security review
6. Pilot competition
7. Commercial validation
8. Self-service rollout

Every stage has an exit gate in `PILOT_LAUNCH_PLAN.md`. Technical readiness never implies production approval.

## 11. Owner decisions required

1. Approve tenant subscription model, Tournament scope, plan prices and quotas.
2. Approve signup eligibility, organizer verification, suspension/appeal and retention policies.
3. Approve public data fields, geography source, organizer badge and featured-placement governance.
4. Set staging/pilot budget, provider shortlist, region, SLO, RPO/RTO and data residency.
5. Name legal/privacy, finance/tax, security, platform/on-call and pilot owners.
6. Select email, storage, scanner, observability and payment sandbox providers for evaluation.
7. Decide admin MFA and granular platform-role requirements.
8. Grant separate explicit authorization for any future commit, push, service purchase, staging creation, deployment or live payment.

## 12. Deliverables

- `docs/PHASE_12_REPORT.md` — baseline audit, decisions, risks and readiness
- `docs/NATIONAL_SAAS_ARCHITECTURE.md` — target control/data plane and additive model
- `docs/SELF_SERVICE_ONBOARDING_PLAN.md` — safe organizer lifecycle and provisioning
- `docs/SAAS_PRICING_AND_ENTITLEMENTS.md` — packages, catalog, quotas and billing lifecycle
- `docs/NATIONAL_PORTAL_ROADMAP.md` — discovery, geography, search, public data and SEO
- `docs/INFRASTRUCTURE_COST_PLAN.md` — topology/cost/capacity comparison
- `docs/PILOT_LAUNCH_PLAN.md` — gated staging-to-rollout sequence

## 13. Final decision

Phase 12 is complete at the requested planning/architecture boundary. The existing Phase 0–11 application and security posture were preserved. The next authorized phase should implement P0 capabilities in isolated development/staging, then repeat the full security, RLS, provider, load, restore and UAT gates.

**TECHNICAL READINESS:** PASS (existing local Phase 11 scope)
**SAAS/COMMERCIAL IMPLEMENTATION:** NOT YET BUILT
**PRODUCTION:** **NO-GO**
