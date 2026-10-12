# LIGA GOAL Phase 13 — Self-Service Implementation

Tanggal verifikasi lokal: 12 Oktober 2026. Status produksi: **NO-GO**.

## Alur yang diimplementasikan

`/daftar` → email sandbox → `/verifikasi-email` → `/masuk` → `/organizer/onboarding` → `/organizer` → modul kompetisi existing.

Registrasi menormalisasi email, memvalidasi password minimal 12 karakter dengan huruf besar/kecil, angka, dan simbol, memakai bcrypt cost 12, honeypot, minimum form age, serta rate limit per IP dan email. Respons untuk email yang sudah ada tetap generik. Akun baru dibuat nonaktif dan tidak dapat login sampai token verifikasi tervalidasi.

Token verifikasi dan undangan dibuat dari 32 byte acak, hanya digest SHA-256 yang disimpan, memiliki expiry, dapat digunakan satu kali, dan token lama dicabut ketika token baru diterbitkan. Adapter email Phase 13 hanya menghasilkan preview URL lokal; tidak ada provider atau email nyata yang diaktifkan.

## Provisioning organisasi

Provisioning berjalan dalam satu transaksi dengan advisory lock per identitas. Input mencakup nama, slug unik, jenis organizer, wilayah, kontak, logo opsional, serta versi persetujuan. Transaksi membuat:

- organization aktif milik identity terverifikasi;
- role `organization-owner`, `organizer-manager`, `competition-editor`, dan `viewer`;
- owner membership dan permission links;
- receipt `OrganizerOnboarding` dengan idempotency key;
- `OrganizationConsentRecord` berisi versi, waktu, request ID, hash IP, dan hash user-agent;
- audit event organisasi.

Satu identitas hanya dapat melakukan initial self-service provisioning sekali pada Phase 13. Retry dengan idempotency key yang sama mengembalikan organisasi yang sama; key berbeda ditolak.

## Workspace

Route yang tersedia:

- `/organizer`: overview, jumlah kompetisi/anggota/undangan, CTA ke modul kompetisi existing;
- `/organizer/onboarding`: wizard provisioning;
- `/organizer/settings`: identitas/status organisasi, perubahan lanjutan tetap memakai modul admin existing;
- `/organizer/members`: daftar anggota dan role;
- `/organizer/invitations`: invite, resend, revoke, dan riwayat status;
- `/undangan`: accept/decline untuk penerima yang login dan terverifikasi.

## Invitation lifecycle

Pengundang wajib memiliki `organization.invitation.manage`. Role harus berasal dari tenant yang sama, bukan owner role, dan permission role tidak boleh melebihi permission efektif pengundang. Discovery token hanya boleh melihat satu undangan dengan digest tepat, status pending, belum kedaluwarsa, dan email yang sama dengan identity login. Accept/decline dilakukan ulang dalam transaksi tenant untuk mencegah TOCTOU; replay ditolak.

## Batas implementasi

- Tidak ada billing, subscription, pembayaran, atau provider email nyata.
- Tidak ada perubahan pada mesin kompetisi existing.
- Pengubahan detail organisasi tetap menggunakan jalur admin existing agar workflow tidak diduplikasi.
- Multi-organization self-service belum dibuka; policy produk Phase 13 adalah satu initial organization per owner identity.
