# PORTAL LOMBA — Backup Protection Report

Tanggal verifikasi: 2–3 November 2026
Scope: database development lokal; tidak ada akses produksi.

## Status

**PASS — satu salinan aman telah dibuat dan diverifikasi.**

Backup custom-format Phase 23 berukuran 688.143 byte dengan 1.477 TOC entry. SHA-256 yang diverifikasi sebelum dan sesudah penyalinan adalah:

`ab69c13a7b4cf1aa3b1f25e6b4052258b1622967030100abd720db7a7bdc8c9f`

## Lokasi dan perlindungan

- Sumber saat pemindahan: `/tmp/portal-lomba-phase23-backup.i1JXJp/`.
- Salinan aman: `/Users/macbook/Library/Application Support/Portal Lomba/Backups/phase23-pre-phase24/`.
- `fdesetup status` menyatakan FileVault aktif pada disk sistem. Volume workspace `ABDUR` tidak memiliki FileVault, sehingga backup tidak dipindahkan ke workspace.
- Direktori backup aman menggunakan mode `0700`; seluruh sepuluh artefak menggunakan mode `0600`.
- Saat penyalinan, hash sumber, tujuan, dan nilai referensi identik; ukuran sumber dan tujuan juga identik.
- Pada validasi akhir 3 November 2026, lifecycle temporary storage telah menghapus direktori `/tmp`; workflow Phase 24 tidak menghapusnya. Salinan aman tetap berukuran 688.143 byte, memiliki 1.477 TOC entry, mode `0600`, dan hash referensi yang benar.
- Tidak ada backup, dump, hash data, atau `.env` yang masuk Git.

Backup dapat mengandung data development yang sensitif. Pemeriksaan dilakukan pada metadata, ukuran, TOC, permission, dan hash; isi baris tidak dicetak ke log atau dokumen.

## Artefak yang dilindungi

Salinan aman berisi full backup, data-only backup tanpa `_prisma_migrations`, checksum, restore list, row-count/hash evidence, serta output sintetis Phase 23. File checksum lama memuat path sumber absolut; verifikasi pascapemindahan karena itu dilakukan dengan menghitung hash sumber dan tujuan secara independen, bukan hanya menjalankan file checksum tersebut.

## Batasan dan tindakan berikutnya

- Perlindungan ini bergantung pada FileVault host dan akun lokal; belum merupakan off-host backup atau bukti disaster recovery.
- Retensi, rotasi, recovery key escrow, dan lokasi off-host terenkripsi masih memerlukan keputusan pemilik.
- Jangan menghapus salinan aman sebelum pemilik menyetujui retensi dan minimal satu restore berikutnya berhasil dari media off-host yang disetujui.
- Jangan menyalin backup development ke staging sebelum privacy review memastikan tidak ada data nyata yang ikut dipindahkan. Staging harus memakai dataset sintetis.
