# Deployment and Rollback Runbook

PROJECT: LIGA GOAL  
PHASE: 8  
CURRENT STATUS: deployment forbidden / **NO-GO**

## Environments

- Development: local `.env`, local synthetic data and local storage only.
- Test: disposable database, all migrations from empty, synthetic data only.
- Staging: production-shaped infrastructure using `.env.staging.example`; no production personal data.
- Production: isolated account/project using `.env.production.example`, non-owner database role, approved private/public object buckets and secret manager.

## Pre-deployment gate

1. Resolve every CRITICAL/HIGH security item and obtain owner approval.
2. Freeze a reviewed commit/tag and record image/artifact digest and application version.
3. Validate environment with `npm run env:check`; ensure no placeholder value remains.
4. Verify encrypted database and object backups and latest restore drill.
5. Run `npm ci`, production dependency audit, generate client, fresh migrations, schema drift, lint, typecheck, unit, integration, E2E and build.
6. Apply migrations with a least-privilege migration role. Runtime role must not own tables or bypass RLS.
7. Deploy one canary, verify `/api/health/live`, `/api/health/ready`, metrics, login, public portal, private authorization and event flow, then gradually increase traffic.
8. Observe error, latency, database, job, notification, realtime and storage dashboards through the agreed soak window.

Never print secrets, use real recovery email during validation, or upload real user documents without explicit approval.

## Rollback

- Stop traffic increase and preserve logs/correlation IDs.
- Roll application back to the recorded artifact only when its schema compatibility is confirmed.
- Prefer forward-fix migrations. For incompatible or corrupt changes, stop writers and follow `BACKUP_RESTORE_RUNBOOK.md` into a new database; never improvise destructive down migrations.
- Reconcile queued jobs/events and object versions before reopening writes.
- Document incident timeline and owner decision.

No staging/production project, billing, deployment, migration or external message was created in Phase 8.
