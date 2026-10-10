# Release Checklist

PROJECT: LIGA GOAL  
PHASE: 8

Release is blocked unless every mandatory item is checked with linked evidence.

- [x] Source snapshot recorded; existing dirty work preserved.
- [x] TypeScript, ESLint and production build PASS.
- [x] Unit 40/40, integration 35/35, E2E 32/32 PASS on isolated fresh database.
- [x] Fresh migration (17) and schema drift PASS.
- [x] Production dependency audit reports zero known vulnerabilities at audit time.
- [x] Secure recovery and session revocation tests PASS.
- [x] Shared PostgreSQL rate limiter atomic concurrency test PASS.
- [x] Encrypted database restore drill PASS.
- [x] Security headers, correlation ID, readiness and protected metrics smoke checks PASS.
- [x] Lighthouse median Performance 97, Accessibility 100, Best Practices 100, SEO 100 under local warm production runs.
- [ ] PostgreSQL RLS/default-deny tenant isolation implemented and independently tested.
- [ ] Non-owner runtime and separate migration database roles verified.
- [ ] Approved S3-compatible public/private buckets, scanning/quarantine, retention and restore PASS.
- [ ] Realtime 10/50 match tests, multi-instance ordering/reconnect and failover PASS.
- [ ] Production-like football read/write load tests and resource telemetry meet approved SLOs.
- [ ] Full 25-step competition UAT and resilience cases signed by operations owner.
- [ ] External error tracking, dashboards and paging are active and tested.
- [ ] Privacy notice, minor consent/legal basis, retention, correction, deletion/anonymization and incident-response ownership are approved.
- [ ] Admin MFA decision completed.
- [ ] Rollback/canary rehearsal completed in staging.
- [ ] Production environment contains no placeholders and secrets come from an approved manager.
- [ ] Owner explicitly approves deployment.

FINAL RECOMMENDATION: **NO-GO**.
