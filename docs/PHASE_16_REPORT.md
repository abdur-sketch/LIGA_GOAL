# LIGA GOAL — Phase 16 Report

Tanggal verifikasi lokal: 13 Oktober 2026 (Asia/Jakarta)
Baseline: Phase 0–15
Technical readiness: **PASS (local)**
Production readiness: **NO-GO**

## Baseline

- Branch awal: `main`; HEAD awal: `eb54479aad5c25dfbff051a68a1bfc4aea2f7b47`.
- Seluruh perubahan Phase 12–15 yang belum di-commit dipertahankan. Tidak ada reset, clean, force checkout, commit, push, deploy, akses production, layanan berbayar, atau pembayaran nyata.
- Snapshot Phase 11 tersedia di `/tmp/liga-goal-phase11-source-20261011-214700`.
- Dokumen Phase 12–15, migration history, portal publik Phase 7, model Organization, RBAC, dan runtime RLS Phase 11 telah diaudit sebelum implementasi.
- Build pertama yang tanpa override DB gagal karena `.env` menunjuk database lama sebelum Phase 13; build pada database fresh Phase 16 lulus. Database lama tidak dimigrasikan atau dimodifikasi.

## Implemented features

- Direktori kompetisi nasional: pencarian, provinsi, kabupaten/kota, format, kategori usia, status, musim, stable sort, dan pagination.
- Direktori serta profil publik penyelenggara; hanya field yang dipilih eksplisit yang diekspos.
- Landing wilayah provinsi dan kabupaten/kota berdasarkan master wilayah tervalidasi dan berversi.
- Homepage nasional dengan search, match center existing, kompetisi populer, wilayah aktif, penyelenggara, dan CTA onboarding.
- Workflow publikasi terpisah: `DRAFT → PENDING_REVIEW → PUBLISHED / UNPUBLISHED / SUSPENDED`.
- Workspace organizer untuk profil/publikasi dan console moderator platform dengan grant eksplisit.
- Canonical, Open Graph, structured data, sitemap dinamis, robots, 404, noindex untuk hasil berfilter/halaman wilayah kosong, dan redirect internal yang divalidasi.
- API pencarian publik dengan DTO allow-list, validasi ketat, batas halaman, dan rate limit.
- Importer wilayah berbasis file tervalidasi/checksum serta benchmark discovery yang hanya berjalan pada database terisolasi.

## Database migrations

- Migration additive: `20261012160000_phase_16_discovery`.
- Model baru: `RegionDataset`, `AdministrativeArea`, `AdministrativeAreaRevision`, `PublicSlugRedirect`, `PublicOrganizerProfile`, `CompetitionPublication`.
- Enum baru: `AdministrativeAreaType`, `PublicationStatus`, `PublicEntityType`.
- Extension: `unaccent`, `pg_trgm`; indeks GIN trigram dan indeks filtering/sorting.
- Seed: 38 provinsi + 514 kabupaten/kota = **552** wilayah.
- Backfill terbatas pada organisasi/kompetisi yang memang sudah publik pada Phase 7; kontak privat tidak disalin.
- Fresh migration: **25/25 PASS**. Upgrade Phase 15→16: **PASS**. Prisma migration drift: **tidak ada perbedaan**.

## RLS coverage

- Master wilayah dan redirect: public read, platform-only write.
- Profil penyelenggara dan publikasi kompetisi: tenant-scoped write; public read hanya saat `PUBLISHED`; platform moderation melalui boundary platform.
- Semua query discovery mengharuskan organisasi aktif, tidak dihapus, profil organizer `PUBLISHED`, dan publikasi kompetisi `PUBLISHED`.
- Cross-tenant workspace/mutation, draft visibility, serta explicit platform grant diuji di integration suite.

## Security

- Default deny, least privilege, safe DTO, tenant-scoped authorization, explicit moderation permission, audit reason, rate limiting, bounded query, dan safe internal redirect diterapkan.
- Tidak ada auto-publish. Perubahan terhadap konten yang telah terbit kembali menjadi `PENDING_REVIEW`; konten suspended hanya dapat dipulihkan moderator.
- Search dan sitemap tidak memuat draft, pending, unpublished, suspended, organisasi suspended, maupun kontak internal Organization/User.

## Regression and E2E

- TypeScript: PASS.
- ESLint: PASS tanpa warning.
- Prisma validate/generate: PASS.
- Unit: **56/56 PASS**.
- Integration normal: **59 PASS, 17 opt-in/infra skip**.
- Phase 11 runtime membership/RLS opt-in: **1/1 PASS**.
- Phase 16 discovery lifecycle/isolation under `liga_goal_runtime` (`NOSUPERUSER`, `NOBYPASSRLS`): **4/4 PASS**.
- Phase 11 full 25-step competition UAT: **1/1 PASS**.
- Production build pada fresh Phase 16 dengan role runtime `NOBYPASSRLS`: PASS, 76 halaman dihasilkan/dikenali.
- E2E final pada database baru dari nol: **46/46 PASS** di desktop Chromium dan mobile Chromium. Run diagnostik sebelumnya menemukan dua regresi UI; nested landmark dan label CTA diperbaiki sebelum run final.

## Performance

Pada PostgreSQL lokal dengan 10.000 organisasi/profil/kompetisi/publikasi sintetis, 100 sampel setelah warm-up:

| Query | p50 | p95 | max |
|---|---:|---:|---:|
| Trigram contains | 8,414 ms | 10,697 ms | 12,560 ms |
| Filter provinsi+kota | 1,760 ms | 3,104 ms | 4,401 ms |
| Popular sort | 1,774 ms | 2,244 ms | 5,069 ms |

Hasil ini bukan janji performa production; lihat `SEARCH_PERFORMANCE_REPORT.md`.

## Known issues and remaining blockers

- Test concurrent operator Phase 11 masih bergantung pada fixture tetap `phase11-load-050` yang tidak ada di database fresh; suite tidak menjalankan assertion. Ini adalah fixture blocker existing, bukan kegagalan Phase 16.
- Dua test object storage/S3 tetap skip tanpa endpoint sandbox lokal.
- UI pemilih kota organizer menampilkan seluruh kota dan validasi relasi dilakukan server-side; peningkatan progressive filtering direkomendasikan sebelum rollout besar.
- Search menggunakan `%contains%`; trigram cukup untuk baseline 10 ribu, tetapi ranking relevansi/fuzzy synonym dan observability query production belum tersedia.
- Moderation SLA, kebijakan takedown, pemilik konten wilayah, legal review publikasi kontak, serta proses koreksi data nasional belum disetujui.
- Belum ada staging UAT, external security review, load test concurrent nasional, CDN/cache policy production, atau monitoring search.

## Files changed

Kelompok utama Phase 16:

- `prisma/schema.prisma` dan `prisma/migrations/20261012160000_phase_16_discovery/migration.sql`
- `src/modules/phase16/*`, perubahan kompatibilitas `src/modules/phase7/service.ts`
- route publik kompetisi, wilayah, penyelenggara, homepage, sitemap, robots
- route/API dan komponen organizer discovery serta platform moderation
- `scripts/import-indonesia-regions.ts`, `scripts/benchmark-discovery.ts`
- unit, integration, fixture E2E, dan `tests/e2e/phase16-discovery.spec.ts`
- tujuh dokumen Phase 16.

Gunakan `git status --short` sebagai daftar otoritatif karena worktree juga memuat perubahan Phase 12–15 milik pengguna.

## Owner decisions required

1. Tetapkan otoritas sumber wilayah dan siapa yang menyetujui setiap update dataset.
2. Setujui moderation policy, SLA, appeals, takedown, dan kriteria featured/popularity.
3. Setujui kebijakan kontak publik, consent/legal notice, retensi, serta mekanisme laporan penyalahgunaan.
4. Putuskan target relevance, latency SLO, kapasitas pilot, dan kapan perlu dedicated search service.
5. Izinkan checkpoint source dan staging hanya setelah security review dan UAT stakeholder disetujui.

## Commit and deployment status

- Commit: **tidak dilakukan**.
- Push: **tidak dilakukan**.
- Deployment: **tidak dilakukan**.
- Paid services/live payment/production access: **tidak digunakan**.
