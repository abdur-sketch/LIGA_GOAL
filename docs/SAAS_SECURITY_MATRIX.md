# SaaS Security Matrix — Phase 13

| Area | Control | Enforcement | Test/evidence | Status |
|---|---|---|---|---|
| Identity | Email normalized dan unik | Prisma unique + generic route response | duplicate path/unit review | PASS |
| Password | bcrypt cost 12, strong input policy | service + Zod | validation unit | PASS |
| Login gate | active, verified, not deleted | NextAuth authorize + JWT refresh + API actor | integration/E2E | PASS |
| Verification | random token, digest only, 30-minute expiry, single-use | identity transaction | expiry + replay integration | PASS |
| Resend | cooldown, rate limit, token rotation | DB timestamps + rate bucket | service/API review | PASS |
| Abuse | IP/email buckets, honeypot, minimum form age | register route/service | unit/E2E | PASS-local |
| Provisioning | verified identity only | provisioning DAL + DB policy | runtime-role integration | PASS |
| Idempotency | one receipt/user/key + advisory lock | unique constraints + transaction lock | concurrent integration | PASS |
| Consent | explicit booleans, exact current versions, context hashes | validation + consent record | integration | PASS |
| Tenant boundary | default deny and tenant-scoped DAL | PostgreSQL RLS | runtime role NOBYPASSRLS | PASS |
| Cross-tenant invitation | exact digest + verified identity email | invitation RLS discovery + tenant re-check | cross-identity integration | PASS |
| IDOR | org/role/invitation IDs re-scoped server-side | tenant transaction queries | integration | PASS |
| Least privilege | no owner invites; target role subset of inviter | service authorization | escalation integration | PASS |
| Token secrecy | raw token never persisted or logged | SHA-256 digest + opaque email adapter logs | unit/code review | PASS |
| Audit | register, verify, provisioning, invite/resend/revoke/respond | AuditLog writes in scoped transactions | integration | PASS |
| Failure recovery | atomic DB operations, retry-safe provisioning | transactions + idempotency | concurrent integration | PASS |
| Email delivery | local-only adapter | no real provider call | configuration/code review | PASS-local |
| Billing | disabled/not implemented | no Phase 13 payment route | source audit | PASS |

## RLS coverage

`OrganizerOnboarding`, `OrganizationConsentRecord`, dan `OrganizationInvitation` memiliki `tenant_default_deny`. Provisioning memakai access mode khusus tanpa `app.platform_admin`; row organization wajib dimiliki `app.current_user_id`. Helper ownership adalah `SECURITY DEFINER` predicate boolean dengan fixed `search_path`, digunakan untuk menghindari recursive policy evaluation dan tidak mengekspos row. Invitation discovery membutuhkan mode khusus, current user, exact token hash, email match, status pending, dan expiry aktif. Mutasi invitation tidak menggunakan discovery scope; mutasi masuk kembali melalui tenant scope normal.

`EmailVerificationToken` adalah tabel identity global seperti `PasswordResetToken`, hanya dapat dijangkau melalui DAL identity allow-list. Seluruh tenant table lain tetap mengikuti boundary Phase 9–11.

## Residual risks sebelum production

- Rate limiting database lokal harus diuji pada topology staging multi-instance.
- Provider email, secrets rotation, bounce handling, dan domain authentication belum dipilih.
- Legal owner harus mengesahkan teks dan versi consent.
- Suspension, retention, deletion/export, dan support escalation membutuhkan keputusan owner.
- Security review independen dan pilot masih wajib; production tetap NO-GO.
