# Development Migration Remediation Plan

Status: **REHEARSED LOCALLY — ORIGINAL DATABASE UNCHANGED**

## Temuan

`liga_goal` mencatat Phase 22 checksum `3566b4f91aa22f503de8b6fdaf449d9e87e0cbcb09590b17eca8ca30818111cb`; file Git final memiliki checksum `4513d32a9b2e0ccfe14dfe9f1508cb9a73fd7f31541454adea21fd0b44c139b6`. `prisma migrate status` tetap menyatakan 35 migration lengkap karena perintah itu tidak memvalidasi perubahan checksum applied migration.

Datamodel tabel sesuai, tetapi database lama masih memiliki:

- `phase22_submit_privacy_request` 8 argumen, tanpa verifikasi email plaintext yang ditambahkan pada versi final;
- validator trigger generik `phase22_validate_privacy_tenant` untuk dua tabel, yang sebelumnya menyebabkan referensi field record salah;
- source final memiliki fungsi privacy 9 argumen dan dua validator trigger khusus.

Risiko: privacy request dan sensitive access logging pada development dapat gagal; menjalankan `migrate dev` dapat meminta reset; menyamakan checksum manual akan menyembunyikan perbedaan executable database objects.

## Backup evidence

Backup custom-format dibuat sebelum rehearsal, mode file `0600`, ukuran 688,143 byte, 1,477 TOC entries, SHA-256 `ab69c13a7b4cf1aa3b1f25e6b4052258b1622967030100abd720db7a7bdc8c9f`. Lokasi sementara: `/tmp/portal-lomba-phase23-backup.i1JXJp/`. Backup mengandung data development dan tidak boleh masuk Git, dikirim, atau dipakai di staging tanpa review privacy.

## Remediation yang direkomendasikan

Jangan edit `_prisma_migrations`, jangan menjalankan `migrate reset`, dan jangan menimpa `liga_goal`.

1. Verifikasi backup/checksum dan hentikan write lokal selama cutover.
2. Buat database baru dengan nama eksplisit, misalnya `liga_goal_rebuilt_phase23`.
3. Terapkan seluruh 35 migration final dengan `prisma migrate deploy`.
4. Pada database baru saja, kosongkan tabel aplikasi sambil mempertahankan `_prisma_migrations` final.
5. Ambil data-only dump dari database lama dengan `--exclude-table=public._prisma_migrations`.
6. Restore dengan trigger sementara dinonaktifkan oleh owner pada target disposable/rebuild; aktifkan kembali otomatis setelah restore.
7. Bandingkan row count dan logical content hash seluruh tabel, orphan/integrity query, sequence, function/trigger signature, RLS, schema drift, dan full regression.
8. Ubah `DATABASE_URL` lokal ke database baru hanya setelah persetujuan pemilik. Simpan database lama read-only selama rollback window.
9. Setelah cutover terverifikasi, keputusan arsip/penghapusan database lama memerlukan persetujuan terpisah.

## Bukti rehearsal

- Full backup restore: PASS.
- Fresh 35 migration target: PASS.
- Data-only restore tanpa migration history: PASS.
- 129/129 table row counts: identical.
- 129/129 logical content hashes: identical.
- Target checksum Phase 22: final `4513d3…`.
- `prisma migrate status`: up to date.
- Schema drift: no difference.
- Final privacy function: 9 argumen.
- Database disposable dibersihkan; database asli tidak diubah.

Melakukan cutover database development asli merupakan perubahan state bermakna dan sengaja dihentikan sampai ada persetujuan eksplisit.
