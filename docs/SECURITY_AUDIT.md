# LIGA GOAL Security Audit

PROJECT: LIGA GOAL
PHASE: 9
DATE: 2026-10-11
REFERENCE: OWASP ASVS control families (authentication, session, access control, validation, files, logging)

## Executive result

No known CRITICAL finding was observed. Phase 9 locally proves RLS and S3 quarantine primitives, but application-wide runtime-role compatibility and production provider controls remain open. Security launch gate is **FAIL** and recommendation is **NO-GO**.

| ID | Severity | Finding | Evidence / disposition |
|---|---|---|---|
| SEC-01 | HIGH | RLS exists, but all application paths are not transaction-bound to trusted context. | 74 tables have default-deny policies and the non-bypass runtime role passes direct isolation tests. Global Prisma regression paths still use owner credentials. **FAIL**. |
| SEC-02 | HIGH | Production object-store IAM, durability and malware service are not approved. | LocalStack public/private/quarantine workflow, tenant authorization, EICAR quarantine and legacy migration pass. Production provider/ClamAV/restore remain **BLOCKED**. |
| SEC-03 | MEDIUM | Admin MFA is unavailable. | Password controls, throttling and revocation were improved; MFA remains open. |
| SEC-04 | MEDIUM | CSP still permits `unsafe-inline` for Next.js bootstrap/styles. | Frame, object, base and form restrictions are active. Move to nonce/hash CSP before higher-risk public launch. |
| SEC-05 | MEDIUM | Session JWT rotation is framework-managed and no explicit short-lived refresh-token family exists. | Eight-hour max age, account-state verification on callbacks, version-based global revocation and secure cookies are present. |
| SEC-06 | MEDIUM | External alert delivery is not configured. | Threshold evaluation and retrying webhook adapter are locally tested; activation is **BLOCKED** on approval/credentials. |
| SEC-07 | LOW | Public report generation is not independently throttled. | Public reads and polling are throttled, and report inputs are allow-listed. Add a report-specific bucket before launch. |
| SEC-08 | MEDIUM | Production recovery delivery is not connected to an approved provider. | Token-safe HTTP adapter, Indonesian template, retry and idempotency are locally tested; activation remains **BLOCKED**. |

## Implemented controls

- PostgreSQL-backed atomic rate buckets protect login, recovery, uploads, admin mutations, portal mutations, public reads and realtime polling. Client IP trusts `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS` is configured.
- Password reset uses 256-bit random tokens stored only as SHA-256 digests, expires after 30 minutes, is single-use, invalidates prior reset tokens, hashes passwords with bcrypt cost 12 and revokes existing sessions.
- JWT callbacks verify active/deleted state and `sessionVersion`; logout-all increments that version. Successful login clears its failure throttle bucket.
- Production cookies are Secure, HttpOnly and SameSite=Lax. Login/recovery responses avoid account enumeration; raw recovery tokens appear only behind an explicit non-production preview flag.
- Security headers include CSP, HSTS in production, DENY framing, nosniff, strict referrer policy, COOP and restrictive permissions policy.
- Existing authorization continues to reload the actor and enforce organization permissions. Private documents are streamed only after tenant authorization and use no-store responses.
- SQL access uses Prisma parameterization; export types and names are allow-listed/sanitized. Upload code uses generated safe keys and content signatures.
- Active guardian-backed publication consent now gates minor profiles, events, lineups, statistics, exports and sitemap entries; withdrawal is immediate and audited.
- `npm audit --omit=dev` on 2026-10-11 reported 0 vulnerabilities.

## Test evidence

- Authentication/rate-limit integration: PASS (3 new tests within 35/35 integration total).
- Unit tests: PASS (46/46); integration: PASS (39/39).
- Database RLS primitive: PASS; application-wide runtime-role compatibility: **FAIL**.
- Malware quarantine and S3 authorization: PASS locally; production scanner/IAM/restore: **BLOCKED**.

Do not describe this audit as “zero vulnerabilities”; it is a source/configuration audit with local automated evidence, not a penetration test.
# Phase 10 closure addendum (2026-10-11)

Runtime RLS now binds nested DAL calls to the same interactive transaction as `set_config(..., true)`. Non-bypass runtime tests pass for concurrent tenants, pool reuse, raw SQL, rollback, timeout and opt-in retry. Main admin/public routes and public Server Components are covered. The audit remains open/high for unproven authentication and remaining background/CLI paths, and for public/platform scopes that still require strict allow-listing and audit. Production release remains NO-GO.
