# PORTAL LOMBA — Phase 26 Competition & Registration Publication

Tanggal: 3 November 2026
Scope: lokal; baseline Phase 25; tanpa commit, cutover, push, atau deployment.

## Hasil

Phase 26 menutup celah operasional yang membuat kompetisi baru tidak dapat membuka pendaftaran publik secara mandiri. Konfigurasi organizer sekarang menerima slug publik tervalidasi, membuat atau memperbarui `CompetitionPublication`, mengubah kompetisi `DRAFT` menjadi `REGISTRATION`, dan tetap berjalan dalam transaksi tenant yang sama.

- slug hanya menerima huruf kecil, angka, dan tanda hubung;
- publikasi hanya dapat dilakukan anggota dengan `competition.update`;
- lookup kompetisi dan semua write dibatasi `organizationId` serta RLS runtime boundary;
- status publik tetap mensyaratkan publication `PUBLISHED`, kompetisi `REGISTRATION`, dan profile `publicRegistrationEnabled`;
- UI menampilkan slug publik dan tidak mengubah modul sepak bola.

Tidak ada model, tabel, migration, atau identifier lama yang diubah. Konflik slug global gagal tertutup oleh constraint unik yang sudah ada.

## Bukti

- Unit validation: slug aman diterima dan path traversal ditolak.
- Integration: kompetisi sintetis baru berpindah dari `DRAFT` ke `REGISTRATION` dan memperoleh publication `PUBLISHED`.
- Runtime security suite: 111/111 PASS.
- Playwright desktop/mobile: kontrol slug dan publikasi organizer tampil pada kedua viewport.
- Regression final seluruh aplikasi: 267 PASS, 0 FAIL, 0 SKIP.

## Risiko tersisa

Human UAT belum mengesahkan copy, slug pilihan organizer, dan prosedur membatalkan publikasi. Production tetap di luar scope.
