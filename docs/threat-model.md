# Phase 0 threat model

| Threat | Control in baseline | Remaining work |
| --- | --- | --- |
| IDOR / cross-tenant access | Membership lookup and tenant-scoped permission service; default deny | Integration tests against PostgreSQL; RLS defense in depth |
| Session theft | HttpOnly, SameSite cookie; Secure in production; eight-hour session | Rotation/revocation registry and device management |
| Credential stuffing | Generic login failure; strong input policy | Distributed rate limiting and lockout telemetry before public launch |
| Privilege escalation | Permissions computed server-side; deny override wins | Admin mutation APIs and approval tests in Phase 1 |
| Injection | Prisma parameterization and Zod boundary validation | Continue per-endpoint validation and security tests |
| Malicious upload | Authenticated endpoint, tenant permission, 2 MB limit, allowlist, magic-byte validation, generated filename, nosniff response | Malware quarantine and S3 signed URLs before production |
| Audit tampering | Append-oriented audit schema | Restricted DB role and external log export |
| Match event replay | Compound idempotency constraint and revision | Transactional event service in Phase 4 |

Security is not considered complete from a successful build. Phase 1 adds in-process mutation rate limiting, PostgreSQL-backed cross-tenant tests, and dependency scanning. Production launch remains blocked on distributed rate limiting, recovery/revocation, RLS defense in depth, malware scanning, backup restoration evidence, centralized observability, and a deployment-specific penetration test.
