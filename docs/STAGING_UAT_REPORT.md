# Staging UAT Report — Phase 20

UAT otomatis dijalankan pada database PostgreSQL lokal fresh dengan organizer dan peserta sintetis. Tidak ada data peserta nyata.

## Alur yang diverifikasi

Untuk setiap template: buat kompetisi → daftarkan dua peserta → entry otomatis berstatus APPROVED oleh organizer → buat babak → terbitkan sesi → input nilai → hitung peringkat → terbitkan dua hasil. Custom dibuat sebagai cabang dari Gebyar/Festival.

| Jenis | Peserta | Penilaian | Hasil |
| --- | --- | --- | --- |
| Sepak Bola | 2 tim | criterion generik; modul sepak bola existing juga diregresi | PASS |
| LCT | 2 regu | points dan penalti | PASS |
| Lomba Sekolah | 2 individu | rubrik berbobot | PASS |
| Seni | 2 individu | rubrik juri berbobot | PASS |
| Keagamaan | 2 individu | rubrik juri berbobot | PASS |
| Gebyar/Festival | 2 tim, acara induk | custom criterion | PASS |
| E-Sports | 2 tim | criterion hasil | PASS |
| Custom | 2 individu, cabang Festival | custom criterion | PASS |

Hasil: **8/8 template PASS**. Test otorisasi tambahan membuktikan viewer tanpa `generic_scoring.manage` tidak dapat memanipulasi nilai: **PASS**.

## Kompatibilitas sepak bola

Seluruh 56 Playwright desktop/mobile lulus, termasuk match center, fixture, lineup, statistics, registration, player operations, portal publik, dan Phase 19. Tidak ada route atau model sepak bola yang dihapus.

## Batasan UAT

- Registrasi Phase 19 saat ini organizer-mediated dan langsung APPROVED; self-registration peserta publik dengan review queue belum tersedia.
- Assignment juri per kompetisi/sesi belum menjadi model khusus. Otorisasi saat ini menggunakan permission organisasi `generic_scoring.manage`.
- Buzzer/bank soal LCT, blind judging, upload karya, dan bracket e-sports otomatis tetap merupakan specialized module lanjutan.
- UAT ini membuktikan readiness teknis lokal. Human UAT pada infrastruktur staging dan provider sandbox masih diperlukan.
