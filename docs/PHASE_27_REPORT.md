# PORTAL LOMBA — Phase 27 Secure Registration Verification

Tanggal: 3 November 2026

## Hasil

Verifier berwenang sekarang dapat membuka detail administrasi pendaftaran tanpa menaruh PII pada payload dashboard awal. Data kontak, wali, form, consent, dokumen, dan histori dimuat on-demand melalui DAL tenant-scoped dengan permission `registration.public.view`.

Kontrol yang diterapkan:

- DTO daftar awal tetap minimum dan tidak memuat email, telepon, wali, atau storage key;
- detail dan dokumen memakai authorization + `organizationId` pada query;
- metadata dokumen tidak pernah mengirim `storageKey` ke browser;
- download mengambil storage key server-side, memvalidasi prefix tenant, MIME allowlist, dan index 0–9;
- response dokumen memakai `private, no-store` dan `nosniff`;
- filename attachment disanitasi dan tetap mendukung nama UTF-8;
- akses detail/dokumen menghasilkan immutable `SensitiveDataAccessLog`;
- endpoint dibatasi rate limit per actor dan tenant;
- outsider dan cross-tenant access ditolak.

UI menyediakan detail verifikasi, histori, dokumen, serta alasan wajib untuk revisi/penolakan. Tidak ada PII yang ditambahkan ke portal publik.

## Bukti

- Integration menguji DTO tanpa storage key, log PII, outsider denial, dan cross-tenant denial.
- Existing private-object-store tests tetap mencakup signature validation, quarantine, malware rejection, dan tenant prefix.
- Runtime role/RLS integration: 111 PASS.
- Playwright desktop/mobile: organizer operations PASS.
- Production build mengenali route dokumen dinamis baru.

## Risiko tersisa

Human verifier harus menguji dokumen sintetis PDF/JPEG/PNG/WebP pada staging. Object storage staging, malware engine provider, dan retention/legal sign-off belum tersedia.
