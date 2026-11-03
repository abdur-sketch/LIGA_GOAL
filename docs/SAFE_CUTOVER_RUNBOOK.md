# PORTAL LOMBA — Safe Development Database Cutover Runbook

Status: **REHEARSED ON DISPOSABLE DATABASES — EXECUTION NOT AUTHORIZED**

Runbook ini khusus remediasi database development `liga_goal`. Runbook tidak mengizinkan perubahan production, reset, edit `_prisma_migrations`, atau penghapusan database lama.

## Alasan cutover

Database development mencatat checksum migration Phase 22 `3566b4f9…`, sedangkan source final mencatat `4513d32a…`. Database lama masih memiliki fungsi privacy 8 argumen; schema final menggunakan 9 argumen dan validator trigger terpisah. `prisma migrate status` saja tidak mendeteksi mismatch executable object ini.

## Bukti rehearsal Phase 24

- Full backup dipulihkan ke `portal_lomba_phase24_backup_restore_test`: PASS, 1,55 detik lokal.
- Target baru `portal_lomba_phase24_cutover_test` menerima 35 migration final: PASS, 4,44 detik lokal.
- Data-only import tanpa `_prisma_migrations`: PASS, 0,33 detik lokal.
- 129/129 tabel: row count dan logical content hash identik sebelum test yang mutatif.
- 520 constraint tervalidasi; 379 foreign key diperiksa dengan 0 orphan.
- 22 user trigger aktif; 0 trigger nonaktif.
- RLS: 123 tabel aktif dan 158 policy; runtime role memakai `NOSUPERUSER`, `NOINHERIT`, `NOBYPASSRLS`.
- Phase 22 final: checksum `4513d32a…`, fungsi privacy 9 argumen.
- Prisma migration status current dan schema drift nol.
- Runtime/security/integration pada hasil rebuild: 109/109 PASS setelah koreksi port emulator lokal.
- Playwright pada hasil rebuild: 64/64 PASS desktop/mobile, termasuk login dan alur bisnis.
- Database asli tetap memiliki checksum lama dan fungsi 8 argumen, membuktikan database tersebut tidak berubah.

Angka waktu adalah pengukuran dataset lokal kecil, bukan SLO. Mechanical rebuild minimum yang teramati sekitar 6,32 detik, tetapi jendela maintenance development yang disarankan adalah 30–60 menit agar write freeze, final backup, validasi, smoke test, dan rollback decision tidak dipaksakan.

## Preflight wajib

1. Dapatkan persetujuan eksplisit pemilik untuk cutover development dan jendela maintenance.
2. Pastikan worktree/checkpoint source disetujui dan migration final tidak berubah setelah rehearsal.
3. Hentikan seluruh writer ke development; catat waktu mulai freeze dan koneksi aktif.
4. Ambil full backup baru ke lokasi FileVault dengan mode `0600`; hitung SHA-256 dan uji TOC.
5. Ambil data-only backup dengan mengecualikan `public._prisma_migrations`.
6. Catat row count/hash sumber dan signature function/trigger/RLS tanpa mencetak isi data.
7. Pastikan kapasitas disk cukup untuk database lama, database baru, dan dua backup sekaligus.
8. Siapkan nama target eksplisit, allowlist mutation, runtime role baru, dan rollback owner.
9. Jangan lanjut bila backup/hash gagal, source menerima write setelah snapshot, atau migration source berubah.

## Prosedur cutover

1. Buat database target baru; jangan menimpa `liga_goal`.
2. Terapkan tepat 35 migration final melalui guard `database-preflight` dan `prisma migrate deploy`.
3. Verifikasi checksum migration, fungsi privacy 9 argumen, trigger, constraint, policy RLS, serta drift sebelum import.
4. Kosongkan hanya tabel aplikasi pada target baru dan pertahankan history migration final.
5. Import data-only backup tanpa `_prisma_migrations`; trigger boleh dinonaktifkan sementara hanya oleh owner target selama restore dan wajib aktif kembali otomatis.
6. Bandingkan seluruh row count dan logical hash; periksa semua FK/orphan, sequence, constraint, trigger, RLS, dan schema drift.
7. Provision runtime role minimum privilege dengan `NOBYPASSRLS`; jalankan integration/security/runtime RLS.
8. Jalankan smoke login, onboarding, sepak bola, multi-kompetisi, pendaftaran publik, penilaian, dual approval, publication, dan public read.
9. Ubah `DATABASE_URL` development ke target baru hanya setelah seluruh post-check PASS dan persetujuan cutover tetap berlaku.
10. Buka writer secara terkendali dan pantau error, latency, audit log, serta koneksi.

## Post-cutover checklist

- [ ] 35 migration final dan checksum source sama.
- [ ] 129 tabel atau jumlah aktual terbaru cocok pada source/target.
- [ ] Logical hash seluruh tabel cocok.
- [ ] Tidak ada FK orphan, constraint invalid, atau trigger disabled.
- [ ] Runtime-role RLS dan cross-tenant tests PASS.
- [ ] Login dan critical business smoke PASS.
- [ ] Backup baru dan timestamp freeze tercatat.
- [ ] Aplikasi menunjuk database target yang benar; database lama read-only.
- [ ] Monitoring observation window selesai tanpa error kritis.
- [ ] Pemilik memberi sign-off; bukan sign-off otomatis.

## Rollback

Rollback dipicu oleh mismatch data, drift, kegagalan login/RLS, error privacy flow, atau critical smoke test. Tutup writer target, arahkan konfigurasi development kembali ke database lama yang dipertahankan read-only/sealed selama validasi, restart aplikasi lokal, dan ulangi smoke test. Data baru yang sempat ditulis pada target harus diekspor dan direkonsiliasi secara eksplisit; jangan menggabungkannya otomatis. Jangan drop database target atau lama sampai incident review dan persetujuan pemilik selesai.

Target rollback lokal yang direncanakan adalah 15 menit setelah keputusan, tetapi belum menjadi RTO terjamin sampai diuji pada staging dengan observability dan dataset representatif. RPO selama planned cutover adalah zero hanya bila write freeze benar-benar ditegakkan.
