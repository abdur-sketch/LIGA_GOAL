# Database Safety Audit — Phase 18

## Insiden Phase 17

Drift check memakai database baseline yang sama sebagai source dan shadow. Prisma menghapus metadata `_prisma_migrations` pada database uji itu. Tabel/data aplikasi tetap ada; source, legacy/Phase 16, dan production tidak terdampak. Database insiden tidak di-reset atau dipakai lagi.

Root cause: tidak ada identity/allowlist preflight dan tidak ada pemeriksaan bahwa source serta shadow berbeda.

## Guardrail baru

`src/lib/database-safety.ts` dan `scripts/database-preflight.ts` menerapkan:

- environment identity wajib (`local`, `test`, `staging`, `production`);
- allowlist exact database dan host;
- penolakan nama legacy dan mismatch production/non-production;
- confirmation mutation eksplisit;
- `migrate dev` hanya local/test;
- shadow wajib, berbeda pada host+database+schema, ter-allowlist, dan bernama shadow/Phase 18;
- test/restore hanya environment `test` dan target bernama test/Phase18/E2E;
- production melarang migrate-dev/test/restore serta mewajibkan approval marker, ticket, dan backup freshness;
- query `current_database()` memastikan server aktual cocok dengan URL;
- scan migration pending untuk pola destruktif dan review flag terpisah.

Guard dipakai oleh build, `db:migrate`, `db:deploy`, integration, E2E, backup, dan restore. Global setup E2E serta setup integration menambahkan defense-in-depth agar direct runner tidak dapat menulis lintas database.

## Evidence

- Unit guard: menerima target test yang benar; menolak identity/confirmation/allowlist kosong, production/legacy, dan shadow yang sama.
- Fresh database Phase 18: preflight PASS, 29 migration applied, status current.
- Runtime role: `rolbypassrls=false`.
- Backup encrypted + SHA-256: PASS.
- Restore ke `liga_goal_phase18_restore_drill_20261013`: PASS; 29 migration dan data sintetis terverifikasi.

## Prosedur migration staging

1. Bekukan release SHA dan migration manifest.
2. Pastikan URL migration role, runtime role, backup role, dan shadow/test tidak sama.
3. Jalankan backup/PITR checkpoint dan restore sampling; catat `BACKUP_VERIFIED_AT`.
4. Jalankan preflight serta review SQL pending. Staging memakai `migrate deploy`, bukan `migrate dev`.
5. Deploy aplikasi kompatibel setelah migration additive selesai.
6. Jalankan smoke, RLS, reconciliation, dan audit check.
7. Jika gagal, hentikan traffic/write bila perlu dan lakukan forward-fix. Restore hanya ke target baru terisolasi sebelum keputusan cutover.

## Remaining risks

- Guard process-level tidak menggantikan IAM/provider policy; migration role tetap harus dipisahkan dan tidak tersedia bagi web runtime.
- Allowlist environment harus berasal dari secret/config manager yang dilindungi, bukan input pengguna.
- PITR, replica/failover, object-version restore, dan production rollback belum diuji.
- CI harus menolak job bila source, test, atau shadow fingerprint sama.
