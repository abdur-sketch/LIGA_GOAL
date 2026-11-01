# Public Registration UAT — Phase 21

## Skenario otomatis

Data yang digunakan seluruhnya sintetis. Integration suite mencakup:

1. Pendaftaran tim dengan nomor unik dan token status rahasia.
2. Replay idempotent mengembalikan pendaftaran yang sama.
3. Duplicate identity dengan idempotency berbeda ditolak.
4. Dua request konkuren pada satu slot kuota menghasilkan tepat satu sukses.
5. Runtime role tanpa context tidak melihat pendaftaran.
6. Tenant B tidak dapat membaca pendaftaran tenant A.
7. Token salah tidak dapat membaca status.
8. DTO status tidak memuat email, telepon, atau dokumen.
9. Verifikator memulai review lalu menyetujui secara transaksional.
10. Approval membuat participant dan entry pada organisasi/kompetisi yang sama.

## Human UAT

- [ ] Form individual, tim, dan instansi menampilkan field yang sesuai template.
- [ ] Festival menerima pendaftaran pada cabang yang benar.
- [ ] Periode belum buka/sudah tutup ditolak dengan pesan aman.
- [ ] Quota penuh tidak dapat dilampaui saat beberapa browser submit bersamaan.
- [ ] Honeypot, rate limit IP, duplicate identity, dan replay diuji.
- [ ] PDF/JPEG/PNG/WebP valid diterima; signature palsu, malware test, dan file >8 MB ditolak.
- [ ] Nomor registrasi/token disimpan oleh peserta dan status dapat dilihat.
- [ ] Token salah memberikan respons generik tanpa bocoran identitas.
- [ ] Organizer dapat request revision, approve, dan reject dengan alasan.
- [ ] Portal publik tidak menampilkan email, telepon, isi form privat, atau dokumen.

## Retensi dan privasi

Dokumen disimpan pada private object storage setelah signature check, quarantine, dan malware scan. Metadata publik tidak memuat lokasi file. Kebijakan retensi/penghapusan peserta untuk pilot harus ditandatangani pemilik produk sebelum staging UAT dengan calon organizer.
