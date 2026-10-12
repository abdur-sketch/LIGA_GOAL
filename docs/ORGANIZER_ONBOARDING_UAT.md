# Organizer Onboarding UAT — Phase 13

## Prasyarat lokal

Gunakan database non-produksi dengan 22 migration, `NEXTAUTH_SECRET` lokal, dan `NEXTAUTH_URL=http://127.0.0.1:3000`. Jangan mengisi endpoint provider email. Jalankan `npm run dev`, lalu buka `http://127.0.0.1:3000/daftar` di Chrome.

## Skenario penerimaan

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| REG-01 | Daftar dengan input valid | Respons generik 202; akun nonaktif; preview sandbox tersedia lokal |
| REG-02 | Daftar ulang email existing | Respons tetap generik; tidak mengungkap keberadaan akun |
| REG-03 | Password lemah/honeypot | Ditolak atau diperlakukan aman tanpa provisioning |
| VER-01 | Buka token valid | Email ditandai verified; akun aktif; login tersedia |
| VER-02 | Replay token | Ditolak dengan pesan invalid/expired |
| VER-03 | Token kedaluwarsa | Ditolak; pengguna dapat meminta kirim ulang setelah cooldown |
| ONB-01 | Submit form dan dua consent | Organization, roles, membership, consent, onboarding receipt, dan audit dibuat atomik |
| ONB-02 | Retry key yang sama | Organization ID sama dan tidak ada duplikasi |
| ONB-03 | Slug existing/key berbeda | Konflik aman; tidak ada data parsial |
| TEN-01 | Akses ID tenant lain | Default deny/RLS; data tenant lain tidak terlihat |
| INV-01 | Owner mengundang viewer | Token sandbox dibuat dan status PENDING |
| INV-02 | Email lain mencoba token | Ditolak tanpa membocorkan tenant |
| INV-03 | Penerima menerima | Membership tepat satu; status ACCEPTED; audit tercatat |
| INV-04 | Replay accept | Ditolak |
| INV-05 | Invite role owner/lebih tinggi | Ditolak 403 |
| INV-06 | Revoke/resend | Hanya pending invitation; resend merotasi token dan tunduk cooldown |
| UI-01 | Desktop Chrome | Seluruh register–onboarding flow usable |
| UI-02 | Pixel 7/mobile Chrome | Seluruh register–onboarding flow usable |

## Evidence otomatis 12 Oktober 2026

- Playwright desktop/mobile Chromium: **34/34 passed**, termasuk dua eksekusi end-to-end Phase 13.
- Unit: **49/49 passed**.
- Integration standar/RLS regression: **50 passed, 5 opt-in skipped** pada suite gabungan; Phase 13 runtime-role lifecycle dijalankan terpisah dan **4/4 passed** setelah penambahan expiry case.
- Phase 11 full competition UAT dan membership-runtime opt-in dijalankan terpisah: **2/2 passed**.
- TypeScript, ESLint, Prisma validate, production build: **PASS**.
- Fresh migration dan upgrade migration: **PASS**; migration diff: **no schema drift**.

## Checklist manual tambahan sebelum staging

- Validasi copy legal final dan bump versi consent bila berubah.
- Uji provider email sandbox yang dipilih, bounce, delay, retry, dan deliverability.
- Uji suspend organization, retention, dan support recovery setelah kebijakan bisnis diputuskan.
- Jalankan pentest IDOR/CSRF/rate-limit dari jaringan staging multi-node.
