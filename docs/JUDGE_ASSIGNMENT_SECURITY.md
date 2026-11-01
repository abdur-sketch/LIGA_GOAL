# Judge Assignment Security — Phase 21

## Boundary

Penilaian generik kini memerlukan dua lapis izin: permission `generic_scoring.manage` dan `JudgeAssignment` aktif untuk organisasi, kompetisi, serta sesi/babak yang sama. Penugasan dapat dibatasi waktu, dinonaktifkan karena konflik kepentingan, atau dicabut langsung. Trigger database menolak referensi lintas tenant; RLS menolak akses tanpa context.

## Role dan permission

| Role | Akses utama | Batasan |
| --- | --- | --- |
| Organizer/owner | Mengelola assignment dan operasi lomba | Tetap tunduk pada self-approval dan tenant boundary |
| Admin kompetisi | Operasional sesuai permission yang diberikan | Tidak otomatis menjadi juri/approver |
| Juri | Melihat assignment dan menginput nilai | Hanya sesi aktif yang ditugaskan |
| Verifikator | Melihat/review pendaftaran | Tidak mendapat akses nilai atau approval hasil |
| Viewer | Read-only | Tidak dapat mengubah assignment, nilai, atau hasil |

## Kontrol keamanan

- Assignment divalidasi terhadap membership dan permission juri sebelum dibuat.
- Scope competition, session, stage, dan organization wajib konsisten.
- `validFrom`, `validUntil`, status, serta deklarasi konflik diperiksa pada setiap input nilai.
- Konflik yang dideklarasikan membuat assignment `INACTIVE` dan wajib memiliki catatan.
- Pencabutan mengubah status menjadi `REVOKED`, menyimpan aktor, waktu, alasan, dan audit log.
- Idempotency key dan advisory transaction lock mencegah provisioning ganda.
- Perubahan assignment dan nilai dicatat pada `AuditLog`.
- Juri tanpa assignment, assignment kedaluwarsa/dicabut, viewer, dan aktor lintas tenant ditolak.

## Bukti regresi

Integration test Phase 21 membuktikan penilaian ditolak sebelum assignment, diterima setelah assignment sah, dan ditolak untuk outsider. Runtime-role suite membuktikan default deny dan isolasi tenant pada tabel assignment. Human UAT tetap wajib menguji pencabutan saat layar juri sedang terbuka.
