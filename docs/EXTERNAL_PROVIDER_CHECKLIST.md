# External Provider Checklist

PROJECT: LIGA GOAL
PHASE: 10
All providers: **BLOCKED — OWNER ACTION REQUIRED**. No account, billing, production secret, or external data transfer was created.

| Provider | Required configuration and authentication | Security / sizing / cost assumptions | Failure, monitoring, test and rollback |
|---|---|---|---|
| S3-compatible storage | endpoint, region, public/private/quarantine bucket names, access key/secret or workload identity, path-style and SSE settings | Separate least-privilege identities; deny public private/quarantine buckets; versioning/lifecycle; capacity based on media retention and egress. Cost unknown until provider/region selected. | Bounded retry, quarantine-first writes, health/head checks, object/5xx alarms. Test IAM and restore in staging. Roll back by switching adapter after checksum migration. |
| ClamAV | scanner mode, host/port or approved service endpoint, timeout | Private network, current signatures, fail-closed policy, CPU/RAM sized for upload rate. | Timeout/rejection metrics and signature-age health. Test clean/EICAR/unavailable cases. Roll back to upload disable/quarantine-only, never unscanned promotion. |
| Recovery email | provider URL/key, verified sender, template/from values | Restricted API key, SPF/DKIM/DMARC, no sensitive body/log data. Cost depends on delivery volume. | Idempotent bounded retry, bounce/delivery monitoring, health probe and staging mailbox test. Roll back by disabling recovery sends and rotating key. |
| External alerting | webhook URL/token, routing destination, signing if supported | Secret manager only; redacted payload; on-call ownership and retention agreed. | Bounded retry, delivery/ack alarms and synthetic staging page. Roll back to local logging while keeping release blocked. |
| Production PostgreSQL | runtime URL, direct migration URL, TLS CA/mode, pooler URL/limits | Separate runtime/migration roles, NOBYPASSRLS, encrypted backup/PITR, HA sizing informed by failed 1,000-viewer test. Cost unknown. | Connection/CPU/locks/replication/backup alarms; fresh/upgrade/restore/load tests. Roll back with tested application/database compatibility and restore point. |
| Secret management | workload identity or bootstrap credential, secret paths/versions, rotation policy | Least privilege, audit logs, encryption, no secrets in repository/build output. | Access-denial/expiry alerts and rotation drill. Roll back to previous secret version within defined overlap; never `.env` production fallback. |

Approval checklist for each provider: owner and security approval, DPA/retention review where relevant, budget approval, staging credentials, health/alert dashboards, failure drill, rollback evidence, and documented operational owner.
