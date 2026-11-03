# Release Candidate Checklist

Tanggal: 2 November 2026

## Source dan evidence

- [x] Baseline Phase 22 teridentifikasi: `ae5cbd412971539cd14e6429d80a89be53c53608`.
- [x] Worktree awal bersih dan 34 file Phase 22 diaudit.
- [x] High-confidence secret scan dan tracked artifact scan tidak menemukan temuan.
- [x] Backup development dibuat dan diverifikasi sebelum remediation rehearsal.
- [x] Fresh 35 migration, upgrade 34→35, dan drift diuji pada database disposable.
- [x] ESLint, TypeScript, 91 unit, 109 integration/security/RLS, dan 64 E2E PASS tanpa skip.
- [x] Production build PASS dengan 100 static pages; dependency audit 0 vulnerability.
- [ ] Original development migration mismatch diremediasi dengan persetujuan pemilik.
- [ ] GitHub Actions menjalankan full workflow terhadap commit kandidat; saat ini **BLOCKED — BILLING**.
- [ ] Release evidence diikat ke SHA commit kandidat.

## Security dan data

- [x] Regression RBAC/RLS/tenant isolation tersedia.
- [x] Privacy consent, minor guardian, data-request intake, dan sensitive-access audit tersedia.
- [x] Load runner dan UAT seeder menolak target non-loopback/non-test.
- [ ] Privacy/retention policy mendapat approval manusia/legal.
- [ ] Staging IAM, object storage privat/quarantine, malware scanner, dan secrets rotation diverifikasi.
- [ ] Backup/restore provider, RPO/RTO, failover, dan incident drill PASS.

## QA dan pilot

- [x] Delapan template memiliki fixture Human UAT sintetis lokal.
- [x] Akun admin, organizer, verifier, judge, reviewer, approver, dan viewer dipisahkan.
- [ ] Human UAT aktual diisi dengan tester, actual result, evidence, tanggal, dan sign-off.
- [ ] Defect severity tinggi ditutup dan diretest.
- [ ] Limited organizer pilot disetujui pemilik.

## Release decision

- Local technical readiness: **PASS**.
- Release Candidate promotion: **NO-GO**.
- Staging: **NO-GO**.
- Organizer pilot: **NO-GO**.
- Production: **NO-GO**.

Checkpoint commit yang disarankan setelah review: `chore: prepare phase 23 release candidate package`. Jangan commit/push tanpa persetujuan eksplisit.
