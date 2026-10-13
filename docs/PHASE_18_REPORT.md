# LIGA GOAL — Phase 18 Report

- Tanggal: 13 Oktober 2026 (Asia/Jakarta)
- Execution: local audit and staging preparation only
Production: **NO-GO**

## Baseline

- Branch `main`; HEAD dan `origin/main` tetap `4a7d06e69934d4eee635a35cf8885f81a9826ec7`.
- Seluruh perubahan Phase 12–17 yang belum di-commit dipertahankan.
- Worktree awal Phase 18 mengandung perubahan Phase 17 yang sah; tidak ada reset, clean, checkout paksa, commit, push, atau deploy.
- 29 direktori migration terdeteksi. Fresh deploy pada `liga_goal_phase18_fresh_20261013` menghasilkan 29/29 PASS.
- Baseline checkpoint mencakup 429 tracked/untracked non-ignored file di `/tmp/liga-goal-phase18-checkpoint-20261013`. Final checkpoint mencakup 438 file di `/tmp/liga-goal-phase18-final-checkpoint-20261013`. Pada keduanya jumlah entry arsip cocok, tar terbaca, SHA-256 dan mode 0600 tersedia. `.env`, `.git`, dependency, serta build output tidak masuk.

## Implemented release-safety controls

- Identitas environment eksplisit: `LIGA_GOAL_ENVIRONMENT`.
- Allowlist exact untuk nama database dan host.
- Confirmation terpisah untuk operasi mutating; production juga memerlukan approval marker, change ticket, dan backup terverifikasi maksimal 24 jam.
- `migrate dev` hanya local/test dan wajib memakai shadow database berbeda yang ikut di-allowlist.
- Build, migration, integration, E2E, backup, dan restore memiliki preflight fail-closed.
- E2E memastikan URL setup dan aplikasi mengarah ke database yang sama; integration memastikan owner/runtime URL tidak melintasi database.
- Pending migration dipindai untuk `DROP`, `TRUNCATE`, dan `DELETE`; temuan memerlukan review eksplisit.
- Database legacy selalu ditolak oleh automation guard.

## Verification results

| Pemeriksaan | Hasil |
|---|---|
| TypeScript / ESLint | PASS |
| Unit | 65/65 PASS |
| Integration + full competition UAT | 81 PASS, 3 SKIP eksplisit |
| E2E desktop/mobile dengan runtime `NOBYPASSRLS` | 50/50 PASS |
| Fresh migration | 29/29 PASS |
| Schema drift (fresh DB vs Prisma datamodel) | No difference detected |
| Production build pada DB Phase 18 | PASS, 88 static-generation steps |
| Backup checksum + isolated restore | PASS; 29 migration, 27 organisasi, 15 kompetisi, 71 pertandingan |
| Discovery 10k | p95 18,151 ms, 0 error |
| Realtime 1.000 viewer, 50 match, 30 detik | 20.819 request, 0 error/P2028/order/duplicate; p95 1.050,15 ms |
| Statistics reconciliation | 4 scope, 0 stale |
| Production dependency audit | 0 vulnerability |

Raw local evidence (ephemeral, non-production): `/tmp/liga-goal-phase18-search-benchmark.txt`, `/tmp/liga-goal-phase18-realtime-1000-valid.json`, `/tmp/liga-goal-phase18-realtime-1000-sustained.json`, `/tmp/liga-goal-phase18-npm-audit*.json`, `/tmp/liga-goal-phase18-operational-alerts.json`, `/tmp/liga-goal-phase18-statistics-reconcile.txt`, dan `/tmp/liga-goal-phase18-backup-TEj05y`.

## Performance interpretation

- Phase 16 direct/local search benchmark mencatat p95 10,697 ms, tetapi belum mengukur runtime-RLS path yang sama sehingga bukan perbandingan apple-to-apple.
- Profil runtime-RLS Phase 17 sebelum optimasi: p95 392,539 ms; sesudah materialized candidate path: 21,733 ms.
- Rerun Phase 18 dengan dataset/metodologi Phase 17 yang sama: p95 18,151 ms.
- Realtime memakai dua instance, masing-masing `connection_limit=5`; sustained test tidak menghasilkan P2028. Peak koneksi tidak disampling pada run Phase 18, sehingga bounded configuration dan hasil bebas-error tidak boleh disebut bukti pooler managed.
- Concurrent organizer quota/idempotency dan billing reconciliation tercakup integration suite. Background health check bekerja, tetapi alert delivery provider belum tersedia.
- Semua angka berasal dari satu workstation/PostgreSQL lokal, bukan SLO staging atau capacity guarantee.

Satu integration run awal gagal akibat fixture transfer memakai `Date.now()` pada tanggal assertion. Fixture dibuat deterministik (`2026-06-01`), lalu suite lulus. Satu load attempt awal seluruhnya 404 akibat generator ID dua digit versus fixture tiga digit; bucket sintetis dibersihkan dan run yang benar diulang. Kedua kegagalan harness dicatat dan tidak dihitung sebagai PASS.

## Security and operational findings

- Tidak ditemukan P0 pada audit lokal.
- `npm audit --omit=dev`: 0 vulnerability. Full audit: lima high pada toolchain ESLint melalui `braces`/`micromatch`/`fast-glob`; saran otomatis meminta downgrade mayor dan tidak diterapkan.
- Alert check menemukan backlog realtime sintetis dan delivery alert `blocked` karena provider belum dikonfigurasi. Ini blocker staging, bukan defect yang disembunyikan.
- Dua test object-storage tetap skip karena emulator S3 tidak tersedia; restore database tidak membuktikan restore object.
- External payment/email/storage/monitoring/DNS belum diintegrasikan atau diuji.
- Audit immutable/WORM, DPA/data residency, privacy/legal approval, on-call, SLO/RPO/RTO, dan production-like staging masih memerlukan keputusan pemilik.

## Release conclusion

- Local technical preparation: **PASS dengan blocker eksternal terdokumentasi**.
- Staging readiness: **BLOCKED**.
- Pilot approval: **BLOCKED**.
- Production readiness: **NO-GO**.

## Files changed in Phase 18

- Database safety module, tests, preflight script, environment templates/validation, guarded package scripts, integration/E2E safety setup.
- Fixture tanggal Phase 6 dibuat deterministik.
- Sembilan dokumen Phase 18.

Gunakan `git status --short` sebagai inventaris lengkap Phase 12–18. Semua perubahan tetap **uncommitted**; tidak ada push atau deployment.
