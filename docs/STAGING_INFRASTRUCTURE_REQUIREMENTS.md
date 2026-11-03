# Staging Infrastructure Requirements

Status: **DESIGNED — NOT PROVISIONED**

| Komponen | Minimum staging | Local/free substitute | Exit evidence |
| --- | --- | --- | --- |
| Compute | Isolated app + worker, HTTPS-only | Local Next production process | Health/readiness, restart, rollback, resource graph |
| PostgreSQL | Separate managed DB, private network, PITR | PostgreSQL loopback disposable DB | Runtime/migration/backup roles, RLS, pool, restore drill |
| Object storage | Private/public/quarantine buckets, versioning/SSE | Existing local S3 emulator | IAM denial, checksum migration, restore, lifecycle |
| Malware scanner | ClamAV service, fail-closed | Signature/local scanner only for development | Clean/infected/timeout/outage tests |
| Secrets | Approved secret manager/workload identity | Process env injected manually | Access audit, rotation/revoke drill; no Git secrets |
| Domain/TLS | Dedicated staging hostname and valid certificate | `localhost` only | HTTPS, secure cookie, HSTS/proxy/header validation |
| Email | Sandbox recipient allowlist | Local adapter | Verify/reset/invite, retry, bounce and no real recipient |
| Monitoring | Metrics, logs, traces/error fingerprints, paging | `/api/metrics`, structured local logs | Dashboard, alert delivery/ack, on-call and incident drill |
| Backup | Encrypted scheduled backup in separate failure domain | Protected custom dump | Approved RPO/RTO, restore integrity and audit evidence |

## Database roles

- Migration role: DDL only during controlled release; no application traffic.
- Runtime role: `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`, CRUD only on required objects.
- Job role: explicit job context, no tenant bypass outside approved global tasks.
- Backup role: read-only/backup capability, separate credential and audit.
- Break-glass role: disabled by default, time-bounded approval and post-incident review.

## Release/rollback

`backup evidence → deploy immutable artifact → migrate deploy → smoke/RLS/security check → enable synthetic traffic → human UAT`. Rollback aplikasi hanya ke schema-compatible artifact. Migration failure uses traffic freeze and approved correct-forward or isolated restore; no automatic destructive rollback.

## Current blockers

No staging account, provider, domain, certificate, private network, managed role, bucket, scanner, secret manager, dashboard, pager, or backup job was created. Billing and paid services remain untouched. Staging status is **NO-GO**.
