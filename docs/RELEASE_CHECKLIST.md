# Release Checklist

PROJECT: LIGA GOAL
PHASE: 9

Release is blocked unless every mandatory item is checked with linked evidence.

- [x] Source snapshot recorded; existing dirty work preserved.
- [x] TypeScript, ESLint and production build PASS.
- [x] Unit 46/46 and integration 39/39 PASS.
- [x] Final serialized E2E 32/32 PASS after Phase 9 harness remediation.
- [x] Fresh migration (19), 74 RLS tables and schema drift PASS.
- [x] Production dependency audit reports zero known vulnerabilities at audit time.
- [x] Secure recovery and session revocation tests PASS.
- [x] Shared PostgreSQL rate limiter atomic concurrency test PASS.
- [x] Encrypted database restore drill PASS.
- [x] Security headers, correlation ID, readiness and protected metrics smoke checks PASS.
- [x] Lighthouse median Performance 97, Accessibility 100, Best Practices 100, SEO 100 under local warm production runs.
- [x] PostgreSQL RLS/default-deny policies and tenant A/B raw SQL isolation tested.
- [x] Non-owner/NOBYPASSRLS local runtime and separate migration roles verified.
- [ ] All application paths pass under trusted context using the runtime role.
- [x] Local S3-compatible public/private/quarantine, EICAR and legacy migration PASS.
- [ ] Approved production buckets, IAM, ClamAV, retention and object restore PASS.
- [x] Local realtime 10/50 match, multi-instance ordering/reconnect/restart/failover PASS.
- [ ] Production-like football read/write load tests and resource telemetry meet approved SLOs.
- [ ] Full 25-step competition UAT and resilience cases signed by operations owner.
- [ ] External error tracking, dashboards and paging are active and tested.
- [ ] Privacy notice, minor consent/legal basis, retention, correction, deletion/anonymization and incident-response ownership are approved.
- [ ] Admin MFA decision completed.
- [ ] Rollback/canary rehearsal completed in staging.
- [ ] Production environment contains no placeholders and secrets come from an approved manager.
- [ ] Owner explicitly approves deployment.

FINAL RECOMMENDATION: **NO-GO**.
# Phase 10 blocking checklist (2026-10-11)

- [ ] Prove runtime-role context for authentication and every remaining job/CLI entrypoint.
- [ ] Pass one connected 25-step UAT on a single competition ID.
- [x] Pass LocalStack object backup/delete/restore/checksum/authorization drill.
- [ ] Meet capacity threshold at 1,000 viewers/50 live matches (current result: 409 HTTP 500/P2028 failures).
- [ ] Approve and verify storage, scanner, email, alerting, PostgreSQL and secret providers in staging.
- [ ] Obtain privacy/legal and project-owner release approval.
- [ ] Commit/push/deploy only after explicit authorization; none occurred in Phase 10.
