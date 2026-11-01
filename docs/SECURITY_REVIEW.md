# Security Review — Phase 20

## Ringkasan

Dua celah high pada boundary multi-kompetisi ditemukan dan diperbaiki: relasi session-entry lintas boundary dan bypass policy publik Phase 19 melalui context legacy. Security regression final: **PASS**.

## Matriks audit

| Area | Kontrol yang diverifikasi | Status |
| --- | --- | --- |
| Authentication | bcrypt, generic login failure, verified/active account, rate limit, audit LOGIN | PASS |
| Session | JWT 8 jam, HttpOnly, SameSite Lax, Secure di production, `sessionVersion` revocation | PASS |
| RBAC | permission per organisasi, viewer read-only, scoring manage wajib untuk nilai | PASS |
| RLS | runtime `NOBYPASSRLS`, default deny, context transaction-local, Phase 19 public/tenant split | PASS |
| Tenant isolation | application authorization, RLS, relation triggers, negative cross-tenant tests | PASS |
| Rate limiting | bucket database atomik dan opaque; mutation Phase 19 30/menit per actor | PASS |
| Idempotency | quota/event key kompetisi, unique key entry/score, advisory lock result | PASS |
| Audit log | create participant/competition/session/criterion/score dan publication dicatat | PASS |
| Input validation | strict Zod, length/format/date/score/penalty bounds | PASS |
| Upload | size/type/signature validation, quarantine, malware adapter, tenant path check | PASS |
| API authorization | actor verified, organization permission, runtime route boundary | PASS |
| Public publication | generic public tables hanya via policy published; raw score default deny | PASS |
| Score manipulation | max score, session membership, criterion ownership, idempotency, permission | PASS |
| Organizer escalation | viewer write ditolak; cross-organization actor ditolak | PASS |
| Competition ownership | competition, participant, session, criterion, result divalidasi satu tenant | PASS |

## Temuan terselesaikan

### SEC-20-01 — Session entry cross-boundary

Severity: High. API telah memvalidasi entry, tetapi tabel junction belum memiliki trigger sendiri. Migration `20261101010000_phase_20_multi_competition_guards` menambah validation preflight dan trigger insert/update. Regression test membuktikan tenant A tidak dapat memasukkan entry tenant B.

### SEC-20-02 — Public context inherited platform bypass

Severity: High. Public scope legacy memakai flag platform agar portal sepak bola lama dapat membaca data melalui DAL terfilter. Policy tenant Phase 19 sebelumnya menerima flag tersebut. Semua policy tenant Phase 19 kini mensyaratkan mode bukan `public`; policy publik eksplisit tetap membatasi publication. Raw score tetap tanpa policy publik.

### SEC-20-03 — Score/result outside session

Severity: High integrity. Trigger score dan result sekarang mensyaratkan pasangan session-entry yang sah. Migration menolak upgrade jika data existing sudah inkonsisten, sehingga tidak ada silent data rewrite.

## Risiko residual

- Portal sepak bola legacy masih menggunakan public context berkemampuan platform dan mengandalkan predicate DAL. Phase 19 sudah dipisahkan, tetapi migrasi seluruh portal lama ke role/database credential publik read-only khusus direkomendasikan sebelum production.
- RLS membatasi row, bukan kolom. Public DAL Phase 19 hanya memilih field peserta aman, namun credential publik terpisah atau public view diperlukan untuk defense-in-depth terhadap kolom kontak.
- Permission `generic_scoring.manage` berlaku pada tingkat organisasi; assignment juri per competition/session dan dual-control publication belum tersedia.
- Rate limiter database bersifat single-cluster; strategi distributed/provider edge perlu divalidasi pada staging multi-instance.
- Malware scanner lokal menggunakan adapter signature; engine staging/production belum diintegrasikan.

Risiko residual tersebut tidak menghalangi staging sintetis terkontrol, tetapi tetap menjadi blocker production readiness.
