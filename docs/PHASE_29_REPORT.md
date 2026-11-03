# PORTAL LOMBA — Phase 29 Operational Rehearsal & Human UAT Readiness

Tanggal: 3 November 2026

## Backup dan restore lokal

Sumber hanya database UAT sintetis `portal_lomba_phase23_human_uat`. Backup terenkripsi AES-256-CBC/PBKDF2 disimpan di lokasi FileVault di luar Git:

`~/Library/Application Support/Portal Lomba/Backups/phase29-uat/database-20261103T001328Z.dump.enc`

- checksum SHA-256: `dd1b670e33261807877838743aa9a4b6cd3665de9b6c1fbf5595d35e4b5fc84e`;
- ukuran: 698.256 byte; mode file `0600`; directory `0700`;
- key rehearsal terpisah di directory Secrets `0700`, file `0600`, tidak masuk Git/log;
- restore hanya ke `portal_lomba_phase29_restore_test`, lalu target dibersihkan;
- 35 migration hadir;
- 130/130 table logical hashes dan total 1.559 row identik;
- aggregate logical SHA-256: `23093735c8e4fe10512a0a01ba856e6f94f326d0a52f603d1e17d890f92a7b18`;
- schema/RLS identik: 130 tabel, 123 RLS-enabled, 158 policy.

Database development dan production tidak digunakan atau diubah.

## Monitoring rehearsal

`alerts:check` pada database UAT menghasilkan `alertCount: 0`. Health/metrics, failed-job, notification backlog, realtime delay, backup age, registration failure, scoring anomaly, dan connection pressure primitives tersedia. Endpoint metrics tetap membutuhkan bearer token.

## Human UAT pack

Dataset menyediakan delapan template: Sepak Bola, LCT, Sekolah, Seni, Keagamaan, Festival, E-sports, dan Custom. Masing-masing memiliki kompetisi registration, publication, session, dan judge assignment. Tujuh aktor sintetis adalah platform admin, organizer, verifier, judge, reviewer, approver, dan viewer.

Human UAT wajib membuktikan per template:

1. organizer membuat dan menerbitkan pendaftaran;
2. peserta sintetis mendaftar dan verifier memeriksa detail/dokumen;
3. organizer menugaskan juri hanya pada sesi yang benar;
4. juri menilai dan koreksi tidak menggandakan nilai;
5. reviewer dan approver adalah aktor berbeda;
6. hasil draft tidak tampil publik, hasil published tampil;
7. viewer tidak memperoleh PII atau write access;
8. revoke/expiry/cross-tenant/self-approval ditolak.

Tidak ada sign-off yang dibuat otomatis. Lihat `HUMAN_UAT_EXECUTION_PACK.md`.
