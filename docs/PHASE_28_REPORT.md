# PORTAL LOMBA — Phase 28 Scoring Integrity & Result Safety

Tanggal: 3 November 2026

## Temuan dan perbaikan

Audit menemukan nilai koreksi dengan idempotency key baru dapat membuat baris kedua untuk kombinasi juri–sesi–peserta–kriteria. Karena ranking menjumlahkan baris, kondisi itu berpotensi menginflasi total.

Perbaikan:

- advisory lock per request dan per logical score;
- satu baris nilai logis per juri, sesi, peserta, dan kriteria;
- retry idempotency key lama atau correction key mengembalikan row yang sama;
- koreksi hanya boleh saat nilai `DRAFT`/`SUBMITTED`;
- score terkunci ditolak sampai workflow dibuka kembali;
- setiap koreksi mencatat previous/current value dan idempotency key pada audit log;
- scoring hanya boleh pada sesi `SCHEDULED` atau `LIVE`;
- submission hasil ditolak bila ada peserta sesi yang belum memiliki nilai;
- tombol UI diubah dari klaim “publikasikan” menjadi “ajukan untuk review”, sesuai workflow nyata.

Dual approval lama tetap dipertahankan: submitter tidak boleh review sendiri, submitter tidak boleh approve sendiri, hasil terkunci setelah approval, dan public hanya membaca hasil `PUBLISHED`.

## Bukti

- 10 concurrent replay menghasilkan satu score ID.
- correction key baru memperbarui row yang sama; count logical score tetap satu.
- read-only audit menemukan 0 duplicate logical-score group pada database development dan dataset UAT sintetis.
- revoke assignment berlaku langsung; outsider scoring ditolak.
- submit → review → approve → publish dan race-condition approval/publication PASS.
- 111 integration/security/RLS tests PASS; 267 total automated PASS.

## Database

Tidak ada migration baru. Proteksi diterapkan di service layer di atas RLS dan trigger existing agar kompatibel dengan data lama.
