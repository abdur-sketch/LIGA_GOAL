# Human UAT & Organizer Pilot Checklist

Status: **NOT EXECUTED / BLOCKED**
Aturan: data sintetis saja. Kolom actual result, evidence, tester, tanggal, dan sign-off harus diisi manusia yang benar-benar menguji; tidak boleh dipraisi atau dibuat oleh automation.

## Gate lingkungan dan peran

- [ ] Staging terisolasi tersedia; tidak memakai production DB/storage/secret.
- [ ] Admin platform, organizer, verifikator, juri, reviewer, approver, peserta, dan pengunjung publik memakai akun terpisah.
- [ ] Runtime role tanpa `BYPASSRLS`; provider sandbox, monitoring, backup, dan rollback tervalidasi.
- [ ] Tidak ada peserta nyata; upload memakai fixture aman.

## Skenario wajib

Gunakan langkah yang sama untuk tiap template: admin/organizer membuat event dan cabang; membuka registration; peserta mendaftar; verifikator approve/reject/revision; organizer menugaskan juri; juri hanya menilai sesi assigned; reviewer dan approver berbeda memproses hasil; organizer publish; pengunjung melihat hasil; tester negatif mencoba cross-tenant, self-approval, replay, dan akses PII publik.

| # | Template | Expected result | Actual result | Status | Tester/peran | Evidence | Tanggal | Sign-off |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sepak Bola | Fixture/live/statistik lama tetap bekerja; hasil publik hanya setelah approval. | — | BLOCKED | — | — | — | — |
| 2 | LCT | Tim, babak, nilai, ranking, dan publikasi benar. | — | BLOCKED | — | — | — | — |
| 3 | Lomba Sekolah | Instansi/peserta dan form khusus tervalidasi. | — | BLOCKED | — | — | — | — |
| 4 | Seni | Rubrik/juri/sesi dan koreksi teraudit. | — | BLOCKED | — | — | — | — |
| 5 | Keagamaan | Data minimum, scoring, dan privacy boundary benar. | — | BLOCKED | — | — | — | — |
| 6 | Gebyar/Festival | Beberapa cabang independen tanpa kebocoran peserta/nilai. | — | BLOCKED | — | — | — | — |
| 7 | E-sports | Tim, match/session, score, approval, publication benar. | — | BLOCKED | — | — | — | — |
| 8 | Custom | Schema/form/rubrik custom tetap tenant-safe dan tervalidasi. | — | BLOCKED | — | — | — | — |

## Checklist per peran

| Peran | Langkah dan expected result | Actual / status / evidence / tester / tanggal / sign-off |
| --- | --- | --- |
| Admin platform | Readiness Center tidak mengklaim GO; suspension/audit tidak bocor lintas tenant. | — / BLOCKED / — / — / — / — |
| Organizer | Membuat event/cabang, konfigurasi registration, assignment, review queue; tidak dapat tenant lain. | — / BLOCKED / — / — / — / — |
| Verifikator | Melihat PII hanya dengan permission; approve/reject/revision tercatat. | — / BLOCKED / — / — / — / — |
| Juri | Hanya sesi assigned/aktif; self-approval dan unassigned scoring ditolak. | — / BLOCKED / — / — / — / — |
| Reviewer | Review aktor lain; nilai approved terkunci; reopen memerlukan alasan/audit. | — / BLOCKED / — / — / — / — |
| Approver | Approve setelah review oleh aktor berbeda; race/replay aman. | — / BLOCKED / — / — / — / — |
| Peserta | Register, menerima nomor/token, cek status, revision, privacy request; PII peserta lain tak terlihat. | — / BLOCKED / — / — / — / — |
| Publik | Hanya kompetisi dan hasil published; draft/raw score/contact/document tidak terlihat. | — / BLOCKED / — / — / — / — |

## Exit

Pilot hanya boleh dilanjutkan jika semua baris PASS, evidence dapat ditinjau, defect severity tinggi ditutup, privacy/retention disetujui, staging restore dan incident drill lulus, serta release owner menandatangani keputusan terpisah. Automation bukan pengganti human sign-off.
