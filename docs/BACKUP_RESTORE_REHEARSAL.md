# Backup & Restore Rehearsal — Phase 20

Tanggal: 1 November 2026. Rehearsal menggunakan dua database PostgreSQL lokal terisolasi dan dump sementara; database lokal utama dan produksi tidak digunakan sebagai sumber.

## Prosedur

1. Buat database test sumber dengan safety allowlist.
2. Terapkan seluruh 33 migrasi dengan `prisma migrate deploy`.
3. Jalankan UAT delapan template untuk membuat dataset sintetis.
4. Ambil custom-format dump menggunakan `pg_dump --format=custom`.
5. Buat database restore kosong.
6. Restore dengan `pg_restore --exit-on-error`.
7. Bandingkan jumlah row domain dan jalankan pemeriksaan orphan relasi.
8. Hapus dump, database sumber, dan database restore.

## Hasil integritas

| Entitas | Sumber | Restore |
| --- | ---: | ---: |
| Kompetisi UAT | 8 | 8 |
| Cabang Festival | 1 | 1 |
| Participant | 16 | 16 |
| Entry | 16 | 16 |
| Session | 8 | 8 |
| Session entry | 16 | 16 |
| Score | 16 | 16 |
| Result | 16 | 16 |
| Published result | 16 | 16 |
| Orphan relation | 0 | 0 |

Status: **PASS**. JSON integritas sumber dan restore identik. Pemeriksaan akhir memastikan tidak ada database atau role sementara Phase 20 yang tertinggal.

## Runbook staging

- Gunakan credential backup terpisah dan secret manager provider.
- Enkripsi dump at rest dan batasi retensi sesuai kebijakan.
- Verifikasi checksum, versi PostgreSQL, kapasitas disk, dan restore target sebelum rehearsal.
- Restore selalu ke database baru; jangan menimpa staging/production aktif.
- Jalankan smoke test, integrity query, RLS runtime test, dan audit akses setelah restore.
- Promosi atau cutover membutuhkan persetujuan pemilik dan rollback window.
