# LIGA GOAL — Phase 17 Report

- Tanggal audit: 13 Oktober 2026 (Asia/Jakarta)
- Execution: lokal saja
Production readiness: **NO-GO**

## Baseline dan perlindungan data

- Baseline: branch `main`, HEAD/upstream `4a7d06e69934d4eee635a35cf8885f81a9826ec7`, worktree awal bersih.
- Snapshot Phase 11 tersedia di `/tmp/liga-goal-phase11-source-20261011-214700`.
- Checkpoint Phase 17 tracked-source dibuat di `/tmp/liga-goal-phase17-checkpoint-20261013`: arsip `LIGA_GOAL-4a7d06e.tar.gz`, manifest 391 file, dan `SHA256SUMS`; mode file 0600 dan verifikasi hash/tar PASS. `.env` dan secret tidak masuk arsip.
- Database yang digunakan hanya database lokal berawalan `liga_goal_phase17_`: baseline, fresh, upgrade, dan performance. Database legacy/Phase 16 tidak dimutasi.
- Baseline integration: 59 PASS, 17 SKIP, 0 FAIL. Klasifikasi skip ada di `TEST_SKIP_RESOLUTION.md`.

### Catatan insiden harness lokal

Saat pemeriksaan drift, database baseline terisolasi keliru dipakai sekaligus sebagai shadow database. Prisma menghapus metadata `_prisma_migrations` pada database uji tersebut; tabel/data aplikasi tetap ada dan database legacy, Phase 16, source, serta production tidak tersentuh. Database itu langsung dihentikan dari pemakaian dan tidak diperbaiki dengan reset. Verifikasi kemudian diulang pada dua database disposable baru: fresh migration 29/29 dan upgrade 25→29, keduanya PASS. Detail klasifikasi ada di `TEST_SKIP_RESOLUTION.md`.

## Implemented features

- Operations center nasional dengan indikator tenant, kompetisi, moderation, verification, jobs, outbox, statistics, reconciliation, dan audit.
- Direktori organisasi serta oversight user/membership dengan platform grant terpisah.
- Lifecycle verifikasi organizer: `UNVERIFIED → PENDING_REVIEW → VERIFIED/REJECTED/SUSPENDED`, terpisah dari publication status.
- Badge publik hanya bila verification benar-benar `VERIFIED`.
- Public abuse report untuk organizer/kompetisi, rate limit, source fingerprint ter-hash, antrean moderation, internal notes, action, dan appeal tenant-scoped.
- Suspension mengubah status/visibilitas dan mempertahankan kompetisi, pertandingan, subscription, invoice, serta riwayat finansial.
- Optimistic concurrency (`version`) mencegah dua moderator menimpa keputusan satu sama lain.
- Search query berteks memakai materialized candidate set sebelum join RLS; p95 runtime-RLS 10.000 kompetisi turun dari 392,539 ms menjadi 21,733 ms.

## Database migrations

1. `20261013070000_phase_17_platform_operations`: empat enum dan empat tabel additive; indeks, FK/check constraint, target trigger, backfill, grant, serta RLS.
2. `20261013071000_phase_17_verification_provisioning`: tenant dapat membuat satu submission baru dengan default deny.
3. `20261013072000_phase_17_verified_badge`: public dapat melihat row `VERIFIED` saja; service hanya memilih status.
4. `20261013073000_phase_17_suspended_appeals`: permission appeal sempit tetap tersedia bagi membership aktif saat tenant disuspensi.

Tidak ada drop table/column, destructive migration, atau penghapusan data.

## RLS coverage dan permission boundary

- `OrganizerVerification`: tenant read/submit; public hanya verified; platform full scope melalui entrypoint terotorisasi.
- `AbuseReport`: public insert-only dengan bentuk aman; tenant read-only untuk tenant sendiri; platform moderation.
- `ModerationNote`: platform-only.
- `ModerationAppeal`: tenant read/insert miliknya; platform review boundary.
- Platform operations memerlukan kombinasi `isPlatformAdmin=true` dan grant eksplisit. Tenant role tidak memenuhi boundary ini.
- Runtime-RLS Phase 17: 3/3 PASS; suite runtime lintas Phase 11/14/15: 30/30 PASS setelah role lokal diprovision dengan benar.

## Security

- Default deny, least privilege, cross-tenant filtering, published-target validation, target tenant/competition trigger, report rate limiting, redacted audit view, dan no secret exposure diterapkan.
- Evidence verification tidak dikirim ke UI publik atau antrean ringkas; audit verification meredaksi evidence.
- Moderator action memerlukan alasan minimal delapan karakter dan ditulis ke audit trail.
- Public report response tidak membocorkan konten nonpublik.
- Reaktivasi tidak otomatis memublikasikan ulang konten yang pernah disuspensi.

## Verification status

- TypeScript: PASS
- ESLint: PASS
- Unit tests: 58/58 PASS
- Integration owner baseline + Phase 17: 64/64 PASS, 20 skip (17 baseline + 3 Phase 17 runtime opt-in)
- Runtime RLS targeted: PASS
- Prisma validate/generate: PASS
- Fresh migration (29 migrations): PASS
- Upgrade migration 25→29 pada database disposable: PASS
- Search 10k + RLS: PASS, p95 21,733 ms (<500 ms)
- Production build: PASS (88 routes terdaftar/dihasilkan)
- E2E Chrome desktop/mobile: efektif 50/50 PASS. Full run awal menghasilkan 48/50 dengan dua kegagalan selector Phase 16; selector diperbaiki dan kedua kasus lulus 2/2. Suite terfokus Phase 16–17 kemudian lulus 8/8 pada database fresh.

## Known issues dan remaining blockers

- Angka lokal bukan capacity guarantee; perlu staging topology, network latency, pooled connection, dan production-like load.
- Shared cache sengaja belum ditambahkan: query setelah optimasi sudah jauh di bawah target dan cache berisiko stale visibility setelah moderation.
- Pagination kompatibel tetap offset-based untuk non-search dan kontrak API lama; keyset/cursor dibutuhkan sebelum direktori berskala jauh di atas 10k.
- AuditLog dilindungi RLS dari runtime yang tidak berkonteks, tetapi belum memakai WORM/external immutable sink.
- Appeal review tersedia dengan explicit grant; reactivation setelah appeal dikabulkan tetap tindakan terpisah agar tidak terjadi pemulihan akses otomatis.
- Object-storage emulator dan provider/webhook nyata tetap tidak aktif.

## Files changed

Perubahan mencakup schema/migration Phase 17, `src/modules/phase17`, API organizer/public/platform, operations UI, public badge/report UI, optimasi Phase 16 search, benchmark, E2E fixtures/spec, serta tujuh dokumen Phase 17. Gunakan `git status --short` sebagai daftar otoritatif.

## Commit dan deployment

- Commit status: **tidak di-commit**.
- Push status: **tidak dilakukan**.
- Deployment status: **tidak dilakukan**.
- Production access/payment/provider: **tidak dilakukan**.
