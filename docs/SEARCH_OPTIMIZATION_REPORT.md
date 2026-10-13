# Search Optimization Report — Phase 17

## Scope dan guardrail

Benchmark berjalan hanya bila `ALLOW_PHASE17_BENCHMARK=1` dan database cocok dengan allowlist `liga_goal_phase17_perf_*`. Dataset sintetis berisi 10.000 organisasi, profil publik, kompetisi, dan publication. Query dijalankan sebagai role `liga_goal_runtime` dengan public RLS context. Raw result lengkap ada di `/tmp/liga-goal-phase17-search-benchmark.json` dan tidak berisi credential.

## Profiling awal

Query awal memulai join dari `Competition`. Security barrier RLS mendorong planner melakukan:

- sequential scan 10.000 `Competition`;
- 10.000 index-only probes ke `PublicOrganizerProfile`;
- 10.000 index probes ke `CompetitionPublication`;
- baru kemudian filter `searchText` menjadi 111 kandidat.

Hasil awal runtime-RLS: cold 321,656 ms; warm p50 373,595 ms; p95 392,539 ms; max 427,667 ms; 20 concurrent 1.490,899 ms. Target lokal masih PASS, tetapi pola probe linear merupakan risiko scaling.

## Perubahan

Untuk pencarian dengan `q`, service sekarang:

1. mematerialisasi kandidat `CompetitionPublication` yang lolos text/region/age filters;
2. menerapkan organization/profile/publication RLS dan lifecycle checks;
3. menghitung total secara exact serta mengambil ID page dengan urutan stabil;
4. mengambil detail bounded untuk maksimal 24 ID dan mengembalikan urutan awal.

Semua nilai input tetap parameterized melalui `Prisma.sql`; fragment SQL dinamis hanya berasal dari enum/order allowlist. Query tanpa teks mempertahankan Prisma path lama untuk kompatibilitas.

## Hasil setelah optimasi

| Metrik | Sebelum | Sesudah |
|---|---:|---:|
| First/cold-ish query | 321,656 ms | 22,890 ms |
| Warm p50 (100 sampel) | 373,595 ms | 20,099 ms |
| Warm p95 | 392,539 ms | **21,733 ms** |
| Warm max | 427,667 ms | 23,972 ms |
| 20 concurrent wall time | 1.490,899 ms | **117,209 ms** |
| EXPLAIN search execution | 337,064 ms | 17,364 ms |
| Exact count execution | 9,854 ms | 11,635 ms |

P95 query-path membaik sekitar 94,5% dan target lokal <500 ms PASS. Pengukuran ini mencakup jalur kandidat pencarian di PostgreSQL, bukan latency jaringan/HTTP end-to-end. “Cold” berarti query pertama pada proses benchmark, bukan OS cache flush/restart PostgreSQL; nilainya tidak boleh diperlakukan sebagai disk-cold production.

## Indeks, ranking, count, N+1, pagination, cache

- `GIN(searchText gin_trgm_ops)` sudah ada. Pada dataset 10k planner memilih sequential scan 10k publication karena lebih murah; ini tervalidasi melalui EXPLAIN, bukan asumsi.
- Indeks lifecycle/sort Phase 16 tetap relevan. Tidak ditambah indeks spekulatif.
- Exact count 11,635 ms masih murah. Approximate count belum diperlukan.
- Include Prisma menghasilkan query bounded; kandidat detail maksimum 24 sehingga tidak ada N+1 tak terbatas.
- Ranking saat ini exact substring + explicit popular/newest/upcoming. Full-text weighted rank ditunda sampai ada acceptance criteria bahasa/typo.
- Offset dipertahankan demi kompatibilitas. Cursor/keyset disarankan untuk skala >100k atau deep pages.
- Shared cache ditunda karena p95 sudah aman dan moderation/suspension memerlukan invalidation ketat. CDN/ISR hanya boleh ditambahkan bersama invalidation event yang diuji.

## Reproduction

`DATABASE_URL=<isolated_phase17_perf_url> ALLOW_PHASE17_BENCHMARK=1 npm run benchmark:discovery:phase17`
