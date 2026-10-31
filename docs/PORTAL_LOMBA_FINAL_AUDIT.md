# PORTAL LOMBA — Final Security & Validation Audit

Tanggal: 24 Oktober 2026

Branch / baseline: `main` / `113d5d827a7e5a98b11927652a0382bd3340910b`

Lingkungan eksekusi: lokal, database sintetis terisolasi

Commit dan push: diotorisasi setelah audit; deployment tidak dilakukan

## Executive decision

| Scope | Decision | Rationale |
|---|---|---|
| Source security and local technical readiness | **GO** | High-severity Zod finding remediated; production and full dependency audit 0 vulnerability; all required static, unit, integration, E2E, and build gates pass. |
| Staging release candidate | **GO WITH GATES** | Source dapat dipromosikan ke review/checkpoint dan production-shaped staging setelah persetujuan pemilik. Provider sandbox, restore, monitoring, and operational UAT remain mandatory. |
| Production deployment | **NO-GO** | No production-shaped staging evidence, approved provider configuration, real backup/PITR rehearsal, legal/privacy sign-off, operational ownership, or explicit deployment authorization exists in this task. |

This decision separates proven local software quality from external production readiness. No paid service, production credential, live payment, production database, commit, push, or deployment was used.

## 1. Zod security finding

### Advisory

The audited finding is [GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), an uncontrolled resource-consumption issue. A crafted oversized collection containing many invalid elements can make affected Zod versions allocate excessive validation issues and exhaust memory. Affected versions are `<4.6.6`; the project previously resolved Zod `3.25.76`, so it was affected.

The official [Zod 4 release and migration documentation](https://github.com/colinhacks/zod/blob/main/packages/docs/content/v4/index.mdx) identifies Zod 4 as stable, while its [versioning guidance](https://github.com/colinhacks/zod/blob/main/packages/docs/content/v4/versioning.mdx) documents the package-root migration to Zod 4.

### Dependency graph

Before remediation there was one deduplicated installation:

- direct application dependency: `zod@3.25.76` from root `^3.24.1`;
- transitive consumer: `eslint-plugin-react-hooks@7.1.1`, compatible with `^3.25.0 || ^4.0.0`;
- transitive peer consumer: `zod-validation-error@4.0.2`, compatible with `^3.25.0 || ^4.0.0`.

After remediation there remains one deduplicated installation: `zod@4.6.7`. No incompatible peer dependency or second Zod version is installed.

### Compatibility analysis and changes

Application usage was inventoried across environment validation, authentication, public/admin API error handling, and Phase 1–17 schemas. The exercised APIs—`parse`, `safeParse`, `ZodError`, `flatten`, coercion, preprocess, refinement, enums, objects, and bounded arrays—remain functional under Zod 4.6.7.

One compile-time breaking change was found and corrected:

- `z.record(z.unknown())` became `z.record(z.string(), z.unknown())` in `src/modules/phase3/validation.ts`, explicitly preserving the prior string-keyed settings object.

Defense-in-depth was also added:

- `requiredDocuments` now has `.max(5)` in `src/modules/phase2/validation.ts`, matching the five allowed document types and rejecting oversized payloads before business processing;
- two unit assertions verify the full allowed set and reject six entries.

Zod was upgraded to exact `4.6.7`. The audit then exposed two moderate development-only findings in Vitest 4.1.11; Vitest was safely patched to exact `4.1.12`. `npm audit fix --force` was not used.

## 2. Branding final audit

The source audit found zero user-visible occurrences of `LIGA GOAL`, `Liga Goal`, `LigaGoal`, or the former tagline.

Verified surfaces:

- centralized identity and tagline in `src/lib/brand.ts`;
- responsive header/sidebar/login/register/dashboard logo;
- SVG application icon, generated Apple icon, Open Graph image, and PWA manifest;
- global title template, description, keywords, Open Graph, and Twitter metadata;
- homepage, public footer, privacy copy, loading, error recovery, empty states, and branded 404;
- email verification, invitation, and recovery payload variables;
- roster/statistics/public report XLSX and PDF headers/file names;
- sandbox invoice PDF and seller snapshot;
- README and architecture/operations documentation.

Production HTTP smoke evidence:

- homepage contains `PORTAL LOMBA` and `Satu Portal, Semua Kompetisi.`;
- old visible brand count on rendered homepage: `0`;
- manifest name/short name/description/display/icon: correct;
- Open Graph image: HTTP 200 `image/png`;
- SVG icon: HTTP 200 `image/svg+xml`;
- Apple icon: HTTP 200 `image/png`;
- unknown public route: HTTP 404 with branded not-found page;
- CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, referrer policy, permissions policy, and COOP headers present in production server response.

Legacy technical identifiers remain intentionally unchanged: `LIGA_GOAL_ENVIRONMENT`, `liga_goal*` databases/roles, session cookie, localStorage keys, Prometheus metrics, mock webhook header/secret, external email template IDs, invoice prefix, E2E fixture keys, and historical checkpoint names. Changing these requires a separately approved compatibility migration.

## 3. Validation evidence

| Gate | Evidence | Result |
|---|---:|---|
| TypeScript | `tsc --noEmit` after Zod/Vitest upgrade and final hardening | **PASS** |
| ESLint | full repository | **PASS** |
| Prisma validate | `prisma/schema.prisma` | **PASS** |
| Unit tests | 24 files, 77 tests | **PASS 77/77** |
| Integration tests | 22 files, all default and opt-in suites enabled | **PASS 85/85, 0 skip** |
| RLS/RBAC | non-owner `liga_goal_runtime`, `NOBYPASSRLS`, tenant and platform scopes | **PASS** |
| Competition UAT | opt-in 25-step single-chain flow | **PASS** |
| Concurrency | concurrent match operators and idempotency | **PASS** |
| Object storage | local S3 emulator, isolation, quarantine, backup/restore | **PASS** |
| E2E desktop/mobile | Playwright Chromium; auth, onboarding, organizer, admin, billing sandbox, discovery, exports, public portal, branding, 404 | **PASS 52/52** |
| Production build | Next.js 16.4.3; 93 generated page entries | **PASS** |
| Production dependency audit | `npm audit --omit=dev` | **PASS — 0 vulnerabilities** |
| Full dependency audit | `npm audit` | **PASS — 0 vulnerabilities** |
| Git whitespace check | `git diff --check` | **PASS** |

Database preflight confirmed 29 applied migrations and zero pending migrations before integration, E2E, and build. No schema migration was created or executed by this hardening work.

## 4. Authentication, authorization, and data safety

- Registration, verification, login, session, organizer onboarding, and anonymous redirect paths passed E2E.
- Runtime RLS, tenant isolation, platform permission boundaries, finance isolation, membership discovery, and cross-tenant protections passed integration/E2E.
- Billing remains sandbox/simulation only; no live payment was activated.
- Test mutation was limited to the named local synthetic database and guarded by database preflight/allowlist.
- No production access, data deletion, destructive migration, reset, clean, commit, push, or deployment occurred.

## 5. Residual risks and required production gates

No known critical, high, moderate, low, or informational npm advisory remains at audit time. Residual production risks are operational rather than an open dependency advisory:

1. Select and validate real PostgreSQL, object storage, malware scanning, recovery/verification email, secret-management, and alerting providers in staging.
2. Prove production-shaped load, failover, PITR, encrypted backup, cross-service restore, provider outage, and secret rotation.
3. Obtain privacy notice, retention/deletion, DPA, finance/invoice, and legal-entity approval.
4. Assign on-call, incident, backup, support, change, and rollback owners.
5. Run manual browser/accessibility UAT and independent security review or penetration testing before broad public self-service.
6. Investigate non-failing development-server warnings observed under rapid E2E navigation (`destination stream errored` and `MaxListenersExceededWarning`). They did not fail any E2E assertion or appear in the production build/smoke test, but should be monitored in staging.
7. Re-run dependency audit immediately before release because advisory state changes over time.

## 6. Files added or changed by this hardening pass

- `package.json`, `package-lock.json`: Zod 4.6.7 and Vitest 4.1.12 exact versions.
- `src/modules/phase3/validation.ts`: explicit string key schema for Zod 4 `record` compatibility.
- `src/modules/phase2/validation.ts`: bounded `requiredDocuments` array.
- `src/modules/phase2/validation.test.ts`: collection-boundary regression tests.
- `docs/PORTAL_LOMBA_FINAL_AUDIT.md`: this final evidence and decision record.
- `docs/REBRANDING_PORTAL_LOMBA.md`: synchronized final test and dependency status.

All earlier uncommitted rebranding files were preserved.

## Final status

- Local technical validation: **PASS / GO**
- Dependency security gate: **PASS / GO (0 vulnerabilities at audit time)**
- Branding gate: **PASS**
- Production deployment: **NO-GO pending external gates and explicit owner authorization**
- Commit: **INCLUDED IN AUTHORIZED HANDOFF COMMIT**
- Push: **AUTHORIZED TO `origin/main`**
- Deployment: **NOT PERFORMED**

## Follow-up CI remote — 31 Oktober 2026

Commit handoff `d7198abf8148b8caecaa8cd95375711a9498ccb9` berhasil tersedia di `origin/main`, tetapi GitHub Actions run [CI #8](https://github.com/abdur-sketch/LIGA_GOAL/actions/runs/40107100962) berstatus **FAILURE / NOT STARTED**. Anotasi GitHub menyatakan job tidak dimulai karena akun terkunci akibat masalah billing. Durasi tiga detik dan tidak adanya langkah yang dieksekusi berarti hasil ini bukan kegagalan lint, test, build, ataupun aplikasi.

Tindak lanjut repository yang dilakukan:

- runner dipin dari `ubuntu-latest` ke `ubuntu-24.04` agar tidak terkena migrasi otomatis GitHub ke Ubuntu 26;
- permission workflow dibuat eksplisit `contents: read`;
- concurrency cancellation dan timeout 60 menit ditambahkan untuk membatasi konsumsi runner.

Gate CI remote tetap **BLOCKED EXTERNAL** sampai pemilik akun GitHub menyelesaikan status billing dan menjalankan ulang workflow. Bukti lokal tidak menggantikan gate remote ini, dan status produksi tetap **NO-GO**.

## Follow-up dependency audit — 31 Oktober 2026

Audit ulang menemukan advisory baru [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) pada `minimatch <11.0.1`. Jalur produksi berasal dari `exceljs@4.4.0` melalui `archiver@5`, sedangkan jalur development berasal dari ESLint dan TypeScript ESLint. `npm audit fix --force` tidak digunakan karena rekomendasinya menurunkan versi direct dependency secara breaking.

Remediasi yang diterapkan:

- override terbatas `exceljs` ke `archiver@8.0.0` dan `unzipper@0.12.5` untuk mengeluarkan dependency legacy;
- override `minimatch@11.0.1`, versi patched yang mendukung Node 18, 20, dan 22+ serta menyediakan export CommonJS dan ESM;
- lockfile dibangun ulang lewat instalasi bersih.

Bukti kompatibilitas setelah remediasi:

- `npm audit --omit=dev`: **PASS — 0 vulnerability**;
- `npm audit`: **PASS — 0 vulnerability**;
- ESLint dan TypeScript: **PASS**;
- unit: **PASS 77/77**;
- XLSX in-memory write/read round-trip: **PASS**;
- E2E ekspor roster desktop/mobile: **PASS 4/4**;
- production build terhadap database 29 migrasi: **PASS**, 93 page entries.

## Follow-up database lokal — 31 Oktober 2026

Database development utama `liga_goal` ditemukan tertinggal pada 21 dari 29 migrasi. Delapan migrasi Phase 13–17 diaudit dan tidak mengandung `DROP`, `TRUNCATE`, `DELETE`, rename, atau pengetatan `NOT NULL`. Jalur fail-closed `db:deploy` kemudian menerapkan delapan migrasi additive tersebut; status akhir **29/29, schema up to date**, dan production build terhadap database utama PASS.

Percobaan dump pra-migrasi gagal karena URI Prisma memuat parameter `schema` yang tidak diterima `pg_dump`; shell saat itu tetap melanjutkan migrasi. Tidak ada backup pra-migrasi yang valid. Karena migrasi sudah selesai dan bersifat additive, dump custom-format pasca-migrasi langsung dibuat dan diverifikasi melalui `pg_restore --list`:

- artifact lokal sementara: `/tmp/portal-lomba-liga-goal-post-phase17-20261031.ck5hxD`;
- SHA-256: `c773b899d9cfcb407ed2e353e7a60aee24d501dc4711949e3d16134c2b4bbeee`.

Artifact `/tmp` bukan backup durable dan dapat hilang saat restart. Kegagalan awal terjadi pada command manual; `scripts/backup.sh` yang resmi sudah menormalisasi URI backup dan memakai `set -euo pipefail`. Operator harus memakai script resmi tersebut untuk backup berikutnya.
