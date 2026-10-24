# Rebranding PORTAL LOMBA

Tanggal verifikasi: 24 Oktober 2026

Baseline: branch `main`, HEAD `113d5d827a7e5a98b11927652a0382bd3340910b`

Status: implementasi lokal selesai; commit dan push diotorisasi setelah audit, deployment belum dilakukan.

## Ringkasan

Identitas tampilan aplikasi telah diubah dari LIGA GOAL menjadi **PORTAL LOMBA** dengan tagline **Satu Portal, Semua Kompetisi.** Fitur, route, data, skema database, autentikasi, RBAC, RLS, dan alur bisnis dipertahankan. Tidak ada migration database pada pekerjaan ini.

Identitas utama dipusatkan di `src/lib/brand.ts`. Logo antarmuka, icon aplikasi, Apple icon, Open Graph image, PWA manifest, metadata, halaman publik, workspace, email payload, laporan XLSX/PDF, invoice sandbox, loading, error, 404, README, dan dokumentasi sekarang memakai identitas baru.

## Komponen yang diperbarui

- Nama: `PORTAL LOMBA`; nama pendek: `Portal Lomba`; tagline: `Satu Portal, Semua Kompetisi.`
- Logo kode-native responsif dengan monogram `PL` serta warna hijau dan emas yang tetap selaras dengan design system existing.
- Metadata global: application name, title template, description, keywords, Open Graph, Twitter card, dan manifest.
- Aset aplikasi: SVG icon, Apple icon PNG yang dihasilkan Next.js, Open Graph image, dan PWA manifest.
- UI: homepage, header/logo yang digunakan login/register/dashboard/sidebar/navbar, footer, copy halaman publik, privacy, serta empty state existing.
- State global: loading, error recovery, dan halaman 404 bermerek dan aksesibel.
- Komunikasi: variabel brand/tagline pada email verification, invitation, dan password recovery untuk adapter lokal/provider.
- Dokumen keluaran: creator/header pada roster, statistik, laporan publik, dan PDF invoice simulasi; nama file ekspor generik berubah menjadi `portal-lomba-*`.
- Dokumentasi/config: README, seluruh dokumen yang menampilkan nama produk, package name, URL production example, dan fixture display name E2E.

Modul sertifikat tidak ditemukan dalam source saat audit, sehingga tidak ada template sertifikat yang dapat diperbarui. Bila modul tersebut ditambahkan, ia wajib mengambil identitas dari `BRAND`.

## Identifier lama yang dipertahankan

| Identifier | Alasan kompatibilitas |
|---|---|
| `LIGA_GOAL_ENVIRONMENT` | Kontrak environment yang dipakai preflight dan seluruh runbook. Penggantian langsung dapat menonaktifkan guard database. |
| database, user, role, dan volume `liga_goal*` | Identitas infrastruktur/database existing. Rename berisiko memutus koneksi, grant, RLS runtime role, restore, dan histori migration. |
| cookie `liga-goal.session-token` | Menghindari logout massal dan perubahan kontrak autentikasi tanpa migration plan. |
| localStorage `liga-goal.organization` dan `liga-goal-anonymous-key` | Menjaga pilihan tenant serta identitas follow/notification anonim existing. |
| metric `liga_goal_*` | Menjaga dashboard, alert, dan query monitoring existing. |
| header `x-liga-goal-mock-signature` | Kontrak integrasi webhook sandbox Phase 15. |
| template ID email `liga-goal-*` | Identifier provider eksternal; isi payload sudah menggunakan PORTAL LOMBA. Rename menunggu provisioning template provider. |
| fallback mock secret `liga-goal-local-mock-only-phase-15` | Hanya sandbox lokal dan menjadi bagian dari fixture kompatibilitas. |
| prefix invoice `LG-` | Nomor dokumen immutable yang sudah tersimpan; perubahan memerlukan keputusan legal/finance dan versioning penomoran. |
| fixture `e2e-liga-goal` dan `@ligagoal.test` | Kunci sintetis pada database regression existing; display name sudah PORTAL LOMBA dan nilai tidak tampil sebagai branding publik. |
| nama checkpoint/backup historis `/tmp/liga-goal-*` | Bukti audit historis tidak boleh ditulis ulang atau dianggap sebagai artifact baru. |

Semua identifier di atas harus dimigrasikan dengan dual-read/dual-write atau compatibility alias pada fase terpisah apabila pemilik memutuskan rename teknis.

## File yang diubah

### Identitas dan shell

- `src/lib/brand.ts`, `src/lib/brand.test.ts`
- `src/components/brand/logo.tsx`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(public)/layout.tsx`
- `src/app/(public)/[section]/page.tsx` untuk memastikan URL publik tak dikenal memakai 404 bermerek dengan status 404.
- `src/app/manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`
- `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`

### Halaman, metadata, komunikasi, dan dokumen keluaran

- Halaman publik di `src/app/(public)` untuk berita, klasemen, klub, pemain, penyelenggara, pertandingan, dan privasi.
- `src/app/organizer/billing/plans/page.tsx`
- `src/lib/email/verification.ts`, `src/lib/email/recovery.ts`
- `src/app/api/admin/phase2/squads/export/route.ts`
- `src/app/api/admin/phase5/[resource]/route.ts`
- `src/app/api/public/reports/[report]/route.ts`
- `src/app/api/organizer/billing/invoices/[id]/pdf/route.ts`
- `src/modules/phase15/service.ts`

### Konfigurasi, dokumentasi, dan pengujian

- `package.json`, `package-lock.json`, `.env.production.example`, `README.md`
- Dokumen `docs/*.md` yang sebelumnya menampilkan nama produk lama; identifier infrastruktur dan bukti historis tetap dipertahankan.
- `src/lib/env.test.ts`, `src/lib/validation/auth.test.ts`
- Fixture dan assertion di `tests/e2e/global-setup.ts`, `tests/e2e/public-shell.spec.ts`, `tests/e2e/phase2-management.spec.ts`, `tests/e2e/phase7-public-portal.spec.ts`, `tests/e2e/phase14-billing.spec.ts`, dan `tests/e2e/phase16-discovery.spec.ts`.

## Hasil pengujian

| Gate | Hasil |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS |
| Prisma schema validate | PASS |
| Unit test | PASS — 77/77 setelah security hardening |
| Integration test | PASS — 85/85, termasuk seluruh test opt-in |
| Object storage emulator | PASS — store, tenant isolation, quarantine, backup/restore |
| E2E desktop + mobile Chromium | PASS — full regression 52/52 |
| Production build Next.js 16.4.3 | PASS — 93 static pages/generation entries diproses |
| Branding assertion pada homepage | PASS — title PORTAL LOMBA dan tidak ada teks `LIGA GOAL` |
| HTTP smoke: homepage/manifest/icon/OG/404 | PASS — aset 200 dan URL tak dikenal 404 bermerek |
| Git diff whitespace check | PASS |

Database pengujian adalah database lokal sintetis `liga_goal_phase18_fresh_20261013`; aplikasi E2E memakai role `liga_goal_runtime` dengan `NOBYPASSRLS`, sedangkan setup fixture memakai koneksi owner. Tidak ada production access.

## Security dan dependency

Next.js diperbarui dari 16.4.0 ke 16.4.3. Security hardening lanjutan kemudian meng-upgrade Zod ke 4.6.7 dan Vitest ke 4.1.12 setelah compatibility audit penuh. Production dan full dependency audit terakhir sama-sama melaporkan 0 vulnerability. Bukti lengkap ada di `docs/PORTAL_LOMBA_FINAL_AUDIT.md`.

## Kendala dan rekomendasi

1. Putuskan legal entity, alamat, pajak, dan format nomor invoice sebelum pembayaran nyata. Seller snapshot saat ini tetap berstatus `LEGAL_REVIEW_REQUIRED` dan pembayaran tetap sandbox.
2. Provision template email baru pada provider sebelum mengganti template ID legacy; pertahankan alias selama masa transisi.
3. Jika domain final sudah dipilih, perbarui `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, canonical/robots/sitemap environment, dan aset social preview pada staging.
4. Pemeriksaan interaktif via Chrome extension tidak tersedia pada sesi ini. Cakupan browser dilakukan dengan Playwright Chromium desktop/mobile 52/52 PASS; lakukan UAT manual Chrome pada staging sebelum release.

## Status perubahan

- Total worktree entries berubah/baru setelah security hardening: **84** (inventaris dikelompokkan pada bagian "File yang diubah"; status Git adalah sumber daftar per-file saat handoff).
- Referensi branding lama yang terlihat pengguna di `src`: **0**.
- Commit: **TERMASUK DALAM HANDOFF COMMIT YANG DIOTORISASI**
- Push: **DIOTORISASI KE `origin/main`**
- Deployment: **BELUM**
- Migration database: **TIDAK ADA**
- Data/tabel dihapus: **TIDAK ADA**
