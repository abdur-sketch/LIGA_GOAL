# Multi-Competition UAT

## Organizer

1. Masuk sebagai organizer terverifikasi.
2. Buka `/organizer/competitions`.
3. Pilih template `Lomba Cerdas Tangkas` dan buat kompetisi.
4. Pastikan mode `TEAM`, metode `POINTS`, serta kriteria awal tampil.
5. Tambahkan regu, daftarkan ke lomba, dan buat babak penyisihan.
6. Pilih minimal satu peserta serta waktu sesi, kemudian terbitkan sesi.
7. Catat nilai untuk regu dan kriteria.
8. Publikasikan hasil sesi dan verifikasi peringkat.

Ulangi smoke test untuk template sekolah (`BOTH`/`JUDGES`) dan Gebyar (`FESTIVAL`). Untuk Gebyar, buat kompetisi cabang dengan memilih acara induk. Sistem harus menolak parent yang bukan `FESTIVAL`.

## Public portal

- `/kompetisi`: filter jenis lomba dan hitungan peserta/sesi sesuai domain.
- `/agenda`: hanya sesi terpublikasi dari kompetisi terpublikasi.
- `/hasil`: hanya hasil berstatus `PUBLISHED`.
- `/peserta`: tidak menampilkan email, telepon, atau metadata registrasi private.
- `/kompetisi/[slug]`: sepak bola menampilkan klub/match/klasemen; lomba umum menampilkan peserta/sesi/hasil.
- Desktop dan mobile: navigasi, kartu, form, serta tabel dapat digunakan tanpa horizontal overflow yang tidak disengaja.

## Negative/security cases

- Tenant A tidak dapat memakai participant, parent competition, session, venue, stage, atau criterion Tenant B.
- Viewer tidak dapat membuat peserta, sesi, atau nilai.
- Participant mode `TEAM` menolak peserta `INDIVIDUAL`; mode `INDIVIDUAL` menolak tim/instansi.
- Sesi tanpa waktu atau peserta tidak dapat diterbitkan.
- Nilai di atas `maxScore` ditolak.
- Idempotency key yang sama tidak menggandakan kompetisi atau nilai.
- Draft score/result dan unpublished session tidak boleh muncul di public scope.

## Bukti lokal 31 Oktober–1 November 2026

- Prisma validate/generate: PASS.
- Fresh migration: PASS, seluruh migrasi Phase 0–19 diterapkan pada database test terisolasi.
- Upgrade migration: PASS pada database lokal existing.
- Schema drift: PASS, `No difference detected`.
- TypeScript: PASS.
- ESLint: PASS.
- Unit: 26 files / 82 tests PASS.
- Integration standard: 15 files PASS, 64 tests PASS, 7 files/21 tests opt-in RLS skipped karena runtime URL tidak diberikan pada run tersebut.
- Production build: PASS, 97 pages/routes generated or recognized.
- Phase 19 E2E targeted: 4/4 PASS (desktop dan mobile).
- Phase 16 discovery targeted setelah copy update: PASS desktop dan mobile.
- Full E2E regression: 56/56 PASS pada desktop Chromium dan profil mobile Pixel 7.
