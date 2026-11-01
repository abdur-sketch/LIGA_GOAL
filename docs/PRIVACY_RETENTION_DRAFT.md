# Draft Privacy & Data Retention — Human Review Required

Status: **DRAFT — belum merupakan nasihat hukum atau kebijakan final**
Tanggal: 1 November 2026
Aktivasi retention/deletion otomatis: **DILARANG** sampai disetujui pemilik dan reviewer hukum.

## Peran dan tujuan

Pemilik platform dan organizer perlu menetapkan siapa pengendali/pemroses data untuk tiap kegiatan. Data hanya diproses untuk pendaftaran, verifikasi kelayakan, operasional lomba, penilaian, publikasi hasil yang disetujui, dukungan, keamanan, audit, serta kewajiban hukum yang terdokumentasi. Identitas controller, kontak privacy, dasar pemrosesan, yurisdiksi, vendor/subprocessor, dan mekanisme pengaduan masih memerlukan keputusan manusia.

## Klasifikasi

| Kelas | Contoh | Akses default |
| --- | --- | --- |
| Publik | nama kompetisi, jadwal, hasil yang telah `PUBLISHED`, profil organizer yang disetujui | Public read-only |
| Internal tenant | workflow, assignment, status verifikasi, audit operasional | Anggota organisasi berizin |
| Data pribadi | nama peserta, email, telepon, instansi, form jawaban | Verifikator/organizer least privilege |
| Sangat sensitif | dokumen persyaratan, data anak/wali, token registrasi, security evidence | Private storage, explicit permission, audited access |
| Sistem/keamanan | password hash, session, token hash, secret provider | Server-only; tidak masuk log/audit payload |

## Consent dan anak di bawah umur

- Pendaftaran menyimpan versi notice, waktu, dan konteks persetujuan; checkbox saja bukan satu-satunya evidence.
- Jika `isMinor=true`, nama/kontak wali dan consent timestamp wajib. Organizer harus memverifikasi kewenangan wali melalui prosedur yang disetujui, bukan mengandalkan input form semata.
- Data anak tidak boleh dipakai untuk marketing, profiling, atau publikasi tambahan tanpa dasar dan persetujuan terpisah.
- Public result harus meminimalkan identitas; tanggal lahir, kontak, dokumen, token, dan data wali tidak boleh ditampilkan.

## Draft retention schedule

Angka retensi **belum ditetapkan**. Pemilik harus mengisi dan menyetujui matriks berikut setelah legal/tax/contract review:

| Dataset | Trigger | Usulan durasi | Aksi akhir | Legal hold / backup |
| --- | --- | --- | --- | --- |
| Registrasi peserta | kompetisi selesai | TBD | Anonimisasi selektif | Hold wajib menang; propagasi backup TBD |
| Dokumen persyaratan | verifikasi/kompetisi selesai | TBD, sesingkat mungkin | Hapus object + metadata sensitif | Restore tombstone procedure TBD |
| Data anak/wali | tujuan berakhir | TBD, prioritas pendek | Anonimisasi/hapus | Human review wajib |
| Hasil resmi | publikasi/finalisasi | TBD | Pertahankan data publik minimum | Koreksi harus teraudit |
| Audit/security log | event tercatat | TBD | Delete/archive terkontrol | Integrity dan regulatory needs |
| Privacy request | selesai | TBD | Simpan bukti minimum | Jangan simpan token plaintext |

Implementasi Phase 22 hanya menyediakan `retentionUntil`, `deletionRequestedAt`, `anonymizedAt`, request workflow, dan **dry-run preview**. Tidak ada scheduler delete/anonymize aktif.

## Permintaan subjek data

1. Pemohon mengirim nomor registrasi, token, dan email yang cocok melalui halaman privasi; endpoint rate-limited dan tidak memberi data registrasi.
2. Sistem membuat request idempotent berstatus `VERIFIED`; token disimpan dalam bentuk hash.
3. Petugas dengan `privacy.request.view/manage` menilai identitas, cakupan, legal hold, kepemilikan tenant, dan dampak hasil resmi.
4. Koreksi harus menghasilkan audit history. Erasure menggunakan anonymization bila penyimpanan minimum masih diwajibkan.
5. Eksekusi, bukti, alasan penolakan, tanggal penyelesaian, backup propagation, dan komunikasi kepada pemohon harus dicatat oleh prosedur yang disetujui.

## Kontrol teknis dan gap

- RLS tenant, cross-tenant trigger, immutable sensitive-access log, hashed token, private document storage, malware gate, PII-redacted logging, RBAC, dan rate limit tersedia secara lokal.
- Akses queue sensitif dicatat; update/delete access log ditolak database.
- Belum tersedia legal-approved fulfillment UI, legal-hold registry, deletion worker, backup tombstone propagation, data export package, DPA/subprocessor register, atau breach notification workflow final.
- Sebelum pilot: lakukan DPIA/risk assessment khusus anak, review notice bahasa Indonesia, setujui retensi per data class, dan uji request fulfillment end-to-end dengan data sintetis.
