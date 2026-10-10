# LIGA GOAL Security Audit

PROJECT: LIGA GOAL  
PHASE: 8  
DATE: 2026-10-10  
REFERENCE: OWASP ASVS control families (authentication, session, access control, validation, files, logging)

## Executive result

No known CRITICAL finding was observed, but two HIGH findings remain open. Security launch gate is therefore **FAIL** and production recommendation is **NO-GO**.

| ID | Severity | Finding | Evidence / disposition |
|---|---|---|---|
| SEC-01 | HIGH | Tenant isolation relies on application predicates; PostgreSQL RLS is absent. | Current Prisma calls do not consistently run inside a transaction carrying trusted tenant context. Enabling RLS now could either break calls or be bypassed by an owner/privileged role. **BLOCKED** pending a non-owner runtime role and transaction-scoped tenant context. |
| SEC-02 | HIGH | Private files remain on local filesystem; no malware scanner/quarantine or production object-store authorization has been exercised. | Existing code validates MIME/signature/size and uses authenticated streaming, but durable private S3-compatible storage and scanning are **BLOCKED** until a provider and isolated credentials are approved. |
| SEC-03 | MEDIUM | Admin MFA is unavailable. | Password controls, throttling and revocation were improved; MFA remains open. |
| SEC-04 | MEDIUM | CSP still permits `unsafe-inline` for Next.js bootstrap/styles. | Frame, object, base and form restrictions are active. Move to nonce/hash CSP before higher-risk public launch. |
| SEC-05 | MEDIUM | Session JWT rotation is framework-managed and no explicit short-lived refresh-token family exists. | Eight-hour max age, account-state verification on callbacks, version-based global revocation and secure cookies are present. |
| SEC-06 | MEDIUM | External error tracking and alert delivery are not configured. | Local structured logging, correlation IDs, health/readiness and protected metrics exist; provider integration is **BLOCKED** on approval/credentials. |
| SEC-07 | LOW | Public report generation is not independently throttled. | Public reads and polling are throttled, and report inputs are allow-listed. Add a report-specific bucket before launch. |
| SEC-08 | MEDIUM | Production recovery delivery is not connected to an approved mail provider. | Token issuance/confirmation is implemented and local preview is explicitly gated; provider configuration and delivery tests remain **BLOCKED** on approval/credentials. |

## Implemented controls

- PostgreSQL-backed atomic rate buckets protect login, recovery, uploads, admin mutations, portal mutations, public reads and realtime polling. Client IP trusts `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS` is configured.
- Password reset uses 256-bit random tokens stored only as SHA-256 digests, expires after 30 minutes, is single-use, invalidates prior reset tokens, hashes passwords with bcrypt cost 12 and revokes existing sessions.
- JWT callbacks verify active/deleted state and `sessionVersion`; logout-all increments that version. Successful login clears its failure throttle bucket.
- Production cookies are Secure, HttpOnly and SameSite=Lax. Login/recovery responses avoid account enumeration; raw recovery tokens appear only behind an explicit non-production preview flag.
- Security headers include CSP, HSTS in production, DENY framing, nosniff, strict referrer policy, COOP and restrictive permissions policy.
- Existing authorization continues to reload the actor and enforce organization permissions. Private documents are streamed only after tenant authorization and use no-store responses.
- SQL access uses Prisma parameterization; export types and names are allow-listed/sanitized. Upload code uses generated safe keys and content signatures.
- `npm audit --omit=dev --audit-level=high` on 2026-10-10 reported 0 vulnerabilities.

## Test evidence

- Authentication/rate-limit integration: PASS (3 new tests within 35/35 integration total).
- Unit tests: PASS (40/40).
- E2E fresh database: PASS (32/32 desktop/mobile).
- Cross-tenant application authorization: PASS in existing integration coverage; database-enforced RLS isolation: **BLOCKED**.
- Malware quarantine, S3 authorization, multi-instance rate-limit process test: **NOT TESTED**. The shared store concurrency path was tested with three concurrent calls and enforced exactly two successes at a limit of two.

Do not describe this audit as “zero vulnerabilities”; it is a source/configuration audit with local automated evidence, not a penetration test.
