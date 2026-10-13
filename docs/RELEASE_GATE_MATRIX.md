# Release Gate Matrix — Phase 18

| Gate | Status | Evidence | To advance |
|---|---|---|---|
| A — Source Integrity | **PASS (local)** | HEAD/upstream recorded; 429-file verified checkpoint; `.env` ignored | Owner diff review, approved Git branch/commit/tag and remote backup |
| B — Database Safety | **PASS (local)** | Fail-closed preflight; separate shadow; fresh 29/29; runtime NOBYPASSRLS; backup/restore PASS | Repeat with staging IAM/PITR; validate source/target/shadow fingerprints in CI |
| C — Security | **BLOCKED** | Local auth/RBAC/RLS/billing/privacy tests pass; prod dependency audit zero | S3/ClamAV, external webhooks, immutable audit, distributed limiter, formal review |
| D — Staging Infrastructure | **BLOCKED** | Architecture/cost plan complete | Budget/provider/region approval and isolated resource provisioning |
| E — Provider Integration | **BLOCKED** | Candidate/sandbox matrix complete | Credentials, contracts/DPA, sandbox integrations and outage/replay tests |
| F — Full SaaS UAT | **BLOCKED** | 81 integration + 50 E2E PASS locally | Repeat complete journey in staging with actual selected sandboxes/storage |
| G — Performance | **PASS (local)** | Search 10k p95 18,151 ms; sustained realtime p95 1.050,15 ms, zero errors | Production-shaped staging load, pool/queue telemetry and soak/failover |
| H — Privacy/Legal/Operational Approval | **BLOCKED** | Data-minimization controls documented | DPIA/DPA, retention, terms/privacy, on-call/SLO/RPO/RTO owner sign-off |
| I — Pilot Approval | **BLOCKED** | Pilot runbook and synthetic rehearsal plan complete | Gates C–H, organizer UAT, support roster, incident/restore drill, final owner approval |

## Decision

- Local technical readiness: **PASS within stated scope**.
- Staging creation/deployment: **NOT AUTHORIZED**.
- Real pilot: **NOT AUTHORIZED**.
- Production: **NO-GO**.

No gate may inherit PASS from a different environment. In particular, local mock payment does not satisfy provider integration, database-only restore does not satisfy object restore, and local 1.000-viewer evidence is not a managed-staging capacity guarantee.
