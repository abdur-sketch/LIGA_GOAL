# RLS Runtime Verification — Phase 20

Tanggal verifikasi: 1 November 2026. Seluruh pengujian menggunakan PostgreSQL lokal terisolasi dan data sintetis.

## Topologi uji

- Database dibuat dengan nama unik `portal_lomba_ci_test_<marker>` pada loopback.
- Owner migration terpisah dari role runtime.
- Role runtime: `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, dan `NOBYPASSRLS`.
- Role runtime hanya menerima `CONNECT`, `USAGE` schema, CRUD tabel, dan penggunaan sequence.
- Context tenant selalu transaction-local dan diuji tidak bocor setelah commit, rollback, timeout, retry, atau perpindahan tenant.
- Database, role, credential acak, dan emulator storage dihapus otomatis setelah run.

## Hasil 21 skenario tertunda

Seluruh 21 skenario runtime-role yang sebelumnya skip telah dijalankan: **21 PASS, 0 FAIL, 0 SKIP**. Cakupan meliputi default deny tanpa context, tenant A versus tenant B, raw SQL dan Prisma, nested DAL, rollback/timeout, invalid context, job/public/identity/membership scope, concurrent operator, subscription, finance, serta operasi Phase 17.

## Regresi Phase 20

Enam test tambahan pada `multi-competition-security.integration.test.ts`: **6 PASS**.

1. Default deny pada tujuh tabel tenant Phase 19 tanpa context.
2. Isolasi participant, entry, session, score, dan result antar-tenant.
3. Penolakan relasi entry dan session-entry lintas tenant.
4. Penolakan score/result untuk entry yang tidak terdaftar di sesi.
5. Public scope hanya melihat data kompetisi terpublikasi dan tidak dapat membaca raw score.
6. Context tenant bersih setelah berpindah organisasi.

## Temuan dan perbaikan

- **High — cross-boundary session entry:** policy lama memeriksa tenant dari sesi, tetapi belum memastikan entry berasal dari kompetisi/tenant yang sama. Ditutup dengan trigger `phase20_session_entry_guard`.
- **High — public bypass pada tabel Phase 19:** context publik legacy membawa flag platform untuk kompatibilitas portal sepak bola. Policy tenant Phase 19 kini secara eksplisit menolak `access_mode='public'`, sehingga hanya policy publik terkurasi yang dapat berlaku.
- **Integrity — score/result membership:** score dan hasil sesi sekarang wajib merujuk `CompetitionSessionEntry` yang benar.
- **Integrity — stage dan parent:** stage divalidasi melalui Season/Competition; parent cabang wajib Festival dalam tenant yang sama.

## Bukti quality gate

Run final `npm run ci:full`: 24 integration files, 100 tests PASS, 0 FAIL, 0 SKIP. Fresh migration 33/33 dan schema drift `No difference detected`.
