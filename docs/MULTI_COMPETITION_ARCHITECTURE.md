# PORTAL LOMBA — Multi-Competition Architecture

## Tujuan

PORTAL LOMBA memakai satu SaaS core untuk banyak domain perlombaan tanpa menghapus modul sepak bola. `Organization`, membership, RBAC, subscription, quota, publication, moderation, audit, dan RLS tetap menjadi boundary utama. Modul sepak bola tetap memakai `Club`, `Player`, `Match`, lineup, event pertandingan, klasemen, dan statistik existing.

## Model domain

`Competition` tetap menjadi aggregate root. `CompetitionProfile` menentukan jenis, mode peserta, metode penilaian, template, dan konfigurasi domain. `parentCompetitionId` memungkinkan acara `FESTIVAL`/Gebyar memiliki beberapa cabang lomba.

Template aktif:

| Code | Jenis | Peserta | Penilaian |
|---|---|---|---|
| `football` | Sepak bola | tim | poin + modul existing |
| `lct` | LCT/kuis | tim | poin dan penalti |
| `school` | Akademik/sekolah | individu/tim | juri berbobot |
| `arts` | Seni | individu/tim | juri berbobot |
| `religious` | Keagamaan | individu/tim | juri berbobot |
| `festival` | Gebyar/festival | individu/tim | custom, multi-cabang |
| `esports` | E-sports | individu/tim | knockout |
| `custom` | Lainnya | individu/tim | custom |

Lapisan generik:

- `CompetitionParticipant`: master individu, regu, atau instansi per tenant.
- `GenericCompetitionEntry`: pendaftaran master peserta ke kompetisi/periode.
- `CompetitionSession`: babak, sesi, presentasi, atau agenda.
- `CompetitionSessionEntry`: peserta yang tampil pada sesi.
- `ScoringCriterion`: rubrik dan bobot penilaian.
- `GenericScoreEntry`: nilai idempotent, penalti, juri/operator, dan status.
- `GenericResult`: agregasi peringkat kompetisi atau sesi yang dapat dipublikasikan.

## Boundary keamanan

- Semua tabel tenant memakai RLS default-deny.
- Public policy hanya membaca kompetisi yang publication-nya `PUBLISHED`.
- Kontak peserta tidak dipilih oleh public DAL.
- Trigger tenant memverifikasi seluruh foreign key lintas aggregate, termasuk parent competition, participant, session, criterion, dan result.
- RBAC baru: `participant.*`, `competition_session.*`, dan `generic_scoring.*`.
- Penyelenggara tidak dapat memakai acara tenant lain sebagai parent atau memasukkan peserta tenant lain.
- Nilai menggunakan idempotency key dan publikasi hasil memakai advisory lock.
- Pembuatan kompetisi tetap melewati entitlement dan usage quota existing.

## Alur

1. Organizer memilih template.
2. Sistem membuat `Competition` dan `CompetitionProfile` dalam satu transaksi.
3. Kriteria awal dibuat dari katalog template.
4. Organizer membuat master peserta dan mendaftarkannya ke cabang lomba.
5. Organizer menyusun sesi/babak dan memilih peserta sesi.
6. Sesi diterbitkan setelah memiliki waktu dan peserta.
7. Operator memasukkan nilai; sistem memvalidasi kriteria dan maksimum nilai.
8. Publikasi menghitung nilai berbobot dikurangi penalti, menyimpan ranking, mengunci replay, dan membuat audit event.

## Kompatibilitas

- Semua kompetisi existing dibackfill sebagai `FOOTBALL`.
- Identifier database lama tidak diganti.
- Route sepak bola tetap tersedia sebagai modul khusus.
- Public navigation utama memakai istilah generik; halaman detail memilih komponen berdasarkan `CompetitionKind`.
- Tidak ada live payment, provider baru, atau perubahan production dalam Phase 19.

## Batas implementasi saat ini

Fondasi mendukung format baru melalui konfigurasi dan scoring generik. Fitur domain sangat khusus—misalnya bank soal dan buzzer LCT real-time, upload karya besar, blind judging, atau bracket e-sports otomatis—merupakan plugin lanjutan, bukan alasan membuat ulang tenant/auth/competition core.
