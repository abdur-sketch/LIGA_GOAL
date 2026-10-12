# RLS Coverage Matrix

PROJECT: LIGA GOAL
PHASE: 11
DATE: 2026-10-12
STATUS: **PASS for local technical scope**

## Enforcement

| Control | Status | Evidence |
|---|---|---|
| Tenant tables | PASS | 74 tenant-related tables have PostgreSQL RLS; relation-owned rows use parent-table policies. |
| Runtime role | PASS | `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB`, `NOCREATEROLE`; role is not the table owner. |
| Default deny | PASS | Missing context returns zero tenant rows through Prisma and raw SQL. |
| Context lifetime | PASS | Transaction-local `set_config`; no leakage after success, rollback, timeout, concurrent tenant use or pool reuse. |
| Cross-tenant writes | PASS | Tenant A cannot read/write Tenant B, including raw SQL and nested DAL calls. |
| Identity global scope | PASS | Identity has no platform bypass; it can use global User/PasswordResetToken and append organization-less auth audits only. |
| Membership discovery | PASS | Dedicated `current_user_id` policies reveal only the authenticated user's active membership and organization; details are reread in tenant transactions. |
| Permission lookup | PASS | Role grants and overrides execute in selected tenant context; Tenant B returns no Tenant A grant. |
| Public reads | PASS (audited DAL) | Published match polling uses one RLS-context SQL statement; other public reads use explicit public boundaries and publication predicates. |
| Job scope | PASS (local) | Global discovery uses explicit job scope; each statistics reconciliation executes in its tenant scope. |

## Authentication paths

| Path | Context | Result |
|---|---|---|
| Login/user lookup/session validation | identity | PASS under runtime role |
| Login/password/session audit append | identity, organization-less INSERT only | PASS |
| Recovery request/token lookup/reset | identity | PASS; one-time tokens and session-version increment |
| Session revocation/account state lookup | identity | PASS |
| Organization membership navigation | membership discovery, then tenant | PASS |
| Role/permission/override lookup | tenant | PASS |
| Runtime desktop/mobile login workflows | runtime role over HTTP | PASS, 32/32 E2E |

## Background and CLI paths

| Entrypoint | Database role / boundary | Status |
|---|---|---|
| Statistics reconciliation | runtime role; global scope discovery then per-tenant transaction | PASS, 5 scopes checked |
| Operational alerts / protected metrics | runtime role; explicit global job scope | PASS |
| Realtime outbox | runtime role; tenant writes and one-statement public replay | PASS |
| Notification/fixture/transfer/discipline processing | synchronous tenant API; no separate worker currently exists | PASS for implemented path |
| Storage migration | no database access; isolated S3 credentials | PASS locally |
| Admin bootstrap | requires `MIGRATION_DATABASE_URL`; cannot silently use runtime URL | PASS control |
| Database backup | requires separate `BACKUP_DATABASE_URL` | PASS control; provider role pending |
| Restore | explicit isolated restore URL and confirmation | PASS control |
| Seed/test setup | owner only for isolated setup; application verification uses runtime role | PASS local |

The global job/public boundaries remain privileged application capabilities and must stay allow-listed and code-reviewed. Production IAM and managed-database role mapping have not been verified.
