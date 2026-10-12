# LIGA GOAL — Pilot Launch Plan

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Release plan only; no deployment authorized

## 1. Objective

Validate that one real organizer can run one competition safely and repeatedly in a production-shaped staging/pilot environment, while proving demand, support cost and willingness to pay. The pilot is not a national general-availability launch.

## 2. Readiness definitions

**Technical readiness** means the software and selected staging topology pass build, migration, tenant isolation, security, capacity, backup/restore, provider and UAT gates.

**Production readiness** additionally requires approved providers/budget, legal/privacy/retention, operating ownership, support/on-call, pilot agreement, incident response, commercial terms, payment policy and explicit deployment authorization.

Phase 11 technical readiness is **PASS local/isolated**. Phase 12 planning does not change the production decision: **NO-GO**.

## 3. Ordered release plan

### 1. Source checkpoint

Actions:

- record exact commit, dirty diff and dependency lock hash;
- preserve uncommitted work without reset/clean;
- create an approved recoverable source snapshot outside ephemeral `/tmp`;
- verify snapshot manifest by restoring into an isolated directory;
- tag/release only after explicit authorization.

Current evidence: `main`, local `origin/main` and remote `main` resolve to `eb54479aad5c25dfbff051a68a1bfc4aea2f7b47`; Phase 11 snapshot contains 273 files and recalculates to SHA-256 manifest `c4c3d9bf44d0a355091d9dfe3ca3a3a2f6b9a02087b2ceab69746dfa9251f1f2`. The existing snapshot is under `/tmp`, so it is valid evidence but not durable backup. Phase 12 documents are intentionally uncommitted.

Exit gate: owner approves durable backup location and checkpoint procedure. No commit/push occurs under Phase 12 authorization.

### 2. Staging infrastructure

Actions:

- create isolated staging account/project only after budget approval;
- configure runtime/migration/backup roles, secret manager, managed PostgreSQL, S3 public/private/quarantine storage and network controls;
- deploy exact release candidate, run 21 migrations and validate zero drift;
- configure observability, alerting, backup/PITR and restore target;
- run runtime-role/RLS and pool-reuse checks.

Exit gate: infrastructure diagram, IAM matrix, cost alert, restore evidence, health/readiness and rollback all signed off.

### 3. Provider integration

Actions:

- object storage and malware scanner;
- recovery/verification email;
- external logs/metrics/alerts;
- payment provider sandbox only, with webhook replay/idempotency tests;
- optionally national geography source/search projection.

Exit gate: sandbox delivery, failure, timeout, retry, secret rotation and rollback paths pass. Live payment remains off.

### 4. Staging UAT

Run the existing 25-step full competition UAT plus:

- register/verify/provision tenant;
- invitation acceptance and role boundaries;
- entitlement/quota/downgrade race scenarios;
- national discovery and publication/unpublication;
- sandbox subscription/event purchase/invoice/refund;
- cross-tenant, suspension, consent withdrawal and provider outage tests;
- representative read/write load and soak.

Exit gate: zero Sev-1/Sev-2 defects; known lower-severity issues accepted with owner/date; business owner signs the full flow.

### 5. Security review

Scope:

- authentication, session, signup abuse and recovery;
- RBAC/RLS for all new tables/jobs/webhooks;
- invitation and provisioning privilege escalation;
- raw webhook signature/replay/out-of-order behavior;
- uploads, private documents, minor consent and national search projection;
- CSP/MFA findings inherited from Phase 9–11;
- secrets/IAM, dependencies, backup/restore and incident runbook.

Exit gate: no open critical/high issue; medium risks explicitly accepted by named owner; independent penetration test scheduled before broad self-service.

### 6. Pilot competition

Selection criteria:

- one cooperative organizer with a named decision maker and operators;
- bounded competition size and schedule;
- consent/data quality readiness;
- no contractual SLO beyond approved pilot terms;
- fallback manual process documented.

Pilot stages: rehearsal → limited invite → public competition → completion/closeout → restore/export/review. Use a daily operations check during active match days and an incident channel owned by named people.

Exit gate: competition completed, results/statistics verified, no cross-tenant/privacy incident, restore/export tested, organizer acceptance recorded.

### 7. Commercial validation

Measure onboarding completion time, support hours, operator errors, peak live usage, storage, notification/export usage, willingness to pay, plan fit, refund concerns and renewal intent. Use manual/approved commercial handling; no live self-service payment until finance/legal/provider gates pass.

Exit gate: owner approves a pricing/entitlement revision and unit-economic envelope.

### 8. Self-service rollout

Rollout rings:

1. internal accounts;
2. invited design partners;
3. approved organizer waitlist;
4. limited public registration with manual activation;
5. automated activation for low-risk applicants;
6. national general availability.

Each ring has a kill switch for new provisioning/publication and does not require disabling access to existing safely operating competitions.

Exit gate: two consecutive rings meet security, reliability, support and abuse thresholds; explicit owner GO for the next ring.

## 4. Pilot scope proposal

| Dimension | Boundary |
|---|---|
| Tenants | 1 pilot organizer plus internal test tenant |
| Competitions | 1 live pilot; separate synthetic staging competition |
| Clubs | Up to 16 initially |
| Players | Up to 500, subject to consent/data policy |
| Concurrent live matches | Up to 2 initially |
| Operators | 3–8 named staff with least-privilege roles |
| Public traffic | Load-tested target plus controlled communication |
| Payment | Sandbox or manual invoice only; no live automatic charge |
| Support | Named hours and escalation contact |

These are risk boundaries, not product plan promises.

## 5. Go/no-go gates

| Gate | GO evidence | Current status |
|---|---|---|
| Source | Durable verified checkpoint and reproducible build | PARTIAL: remote commit and ephemeral snapshot verified |
| Application | Typecheck/lint/unit/integration/E2E/build pass | PASS local Phase 11; rerun on release candidate |
| Tenant security | All new/existing paths pass runtime RLS/RBAC tests | Existing PASS local; new SaaS paths not built |
| Providers | Storage/scanner/email/alerting sandbox and restore pass | BLOCKED |
| Data/privacy | Notice, consent, retention, deletion and DPA approved | BLOCKED |
| Infrastructure | Production-shaped staging load/failover/restore pass | BLOCKED |
| Operations | On-call, incident, support, backup and change owners named | BLOCKED |
| Commercial | Pilot terms, pricing hypothesis, invoice/refund process approved | BLOCKED |
| Payment | Sandbox reconciliation passes; live activation separately approved | NOT IMPLEMENTED / live prohibited |
| Deployment | Explicit owner authorization | NOT GRANTED |

## 6. Success criteria

Proposed thresholds requiring owner approval:

- 100% required onboarding steps completed without platform-admin database intervention;
- zero cross-tenant, private-data or unauthorized publication incident;
- 100% official match results reconcile with source records;
- p95 public page/API latency meets approved staging SLO under representative load;
- no unplanned data loss; restore drill meets approved RPO/RTO;
- at least 95% scheduled match operations completed without engineering intervention;
- support demand no more than an agreed operator-hours-per-match threshold;
- organizer confirms willingness to continue at an identified price range;
- all invoices/refunds in sandbox/manual ledger reconcile exactly.

## 7. Rollback and stop conditions

Stop new publication/provisioning immediately for suspected cross-tenant access, data exposure, payment inconsistency, unrecoverable result corruption, malware bypass or loss of backup integrity. Preserve evidence, revoke affected sessions/keys, isolate provider integration and follow the incident runbook.

Rollback order:

1. feature/rollout kill switch;
2. revert application release without reversing destructive schema;
3. forward-fix migrations by default;
4. restore database and matching object versions only into an isolated target first;
5. communicate status through the approved incident owner.

Never delete tenant data to solve a quota, downgrade or failed pilot.

## 8. Work plan and ownership

| Workstream | Estimate | Required owner |
|---|---:|---|
| Durable checkpoint and release automation | 1 engineer-week | Engineering lead |
| Staging/IAM/database/storage/observability | 3–5 engineer-weeks | Platform/operations |
| SaaS control plane and self-service P0 | 10–14 engineer-weeks | Product + engineering |
| National portal P0/P1 | 8–12 engineer-weeks | Product/content/privacy |
| Provider sandbox/payment architecture | 4–6 engineer-weeks | Finance + engineering |
| Security review/remediation | 2–4 engineer-weeks | Security owner |
| Pilot preparation/execution | 3–5 calendar weeks | Pilot operations owner |
| Commercial review | 1–2 calendar weeks | Product/finance |

Estimates overlap with the detailed architecture documents and must not be summed blindly.

## 9. Owner decisions required

1. Approve checkpoint storage and release-candidate ownership.
2. Approve staging budget, provider shortlist, region and target SLO/RPO/RTO.
3. Name privacy/legal, security, operations/on-call, finance and pilot owners.
4. Select pilot organizer and bounded competition scope.
5. Approve success/stop criteria, support commitments and commercial experiment.
6. Grant separate explicit authorization before any account creation, paid service, deployment, commit, push or live payment.

## 10. Final release status

Phase 12 provides the sequence and gates only. No staging or production resource was created, no deployment occurred and no payment was activated. **Technical planning: READY. Production: NO-GO.**
