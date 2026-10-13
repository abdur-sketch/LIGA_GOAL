# Organizer Verification — Phase 17

## Prinsip

Verification menyatakan identitas organisasi telah ditinjau. Publication menyatakan konten layak tampil. Keduanya independen: published tidak berarti verified, dan verified tidak otomatis memublikasikan profil/kompetisi.

## Lifecycle

- `UNVERIFIED → PENDING_REVIEW → VERIFIED | REJECTED`
- `VERIFIED | PENDING_REVIEW | REJECTED → SUSPENDED` oleh petugas berizin.
- `REJECTED → PENDING_REVIEW` setelah organizer memperbaiki evidence.

Submission hanya dari tenant yang memiliki `organization.public_profile.manage`. Review memerlukan `organizer.verification.manage`. Update memakai version check sehingga keputusan concurrent kedua mendapat 409 dan wajib reload.

## Evidence dan privacy

- Evidence disimpan sebagai JSON bounded (maksimum 12 field; setiap nilai 500 karakter).
- Queue UI ringkas tidak mengambil evidence; workflow pemeriksaan dokumen sensitif penuh membutuhkan desain akses khusus berikutnya.
- Audit event meredaksi evidence.
- Public RLS hanya meloloskan row `VERIFIED`; public service hanya memilih `status`.
- Badge tampil tepat sebagai “Organizer terverifikasi”; direktori tidak lagi menyebut semua organizer published sebagai terverifikasi.

## Badge revocation

Status `SUSPENDED` segera menghilangkan badge. Suspension organisasi juga menyuspensi verification projection. Reactivation organisasi tidak otomatis mengembalikan badge atau publication.

## UAT

1. Organizer terverifikasi email membuka `/organizer/verification`.
2. Isi registrasi dan referensi resmi, lalu submit.
3. Pastikan publication lama tidak berubah dan badge belum tampil.
4. Operator dengan view grant melihat antrean; operator tanpa grant mendapat 403.
5. Operator verify/reject dengan alasan.
6. Pastikan satu dari dua concurrent review ditolak 409.
7. Setelah VERIFIED, badge tampil pada directory/detail; evidence/reason/reviewer tidak muncul publik.
