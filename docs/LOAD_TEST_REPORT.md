# PORTAL LOMBA — Load & Concurrency Test Report

Tanggal: 1 November 2026
Environment: local Next.js production build + PostgreSQL loopback, data sintetis; bukan production-shaped staging.

## HTTP sample Phase 22

| Endpoint | Concurrency | Duration | Requests | RPS | Fail | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/api/health/live` | 20 | 10 s | 6,664 | 666.4 | 0 | 24.60 ms | 51.96 ms | 79.66 ms |
| `/api/health/ready` | 10 | 10 s | 6,248 | 624.8 | 0 | 13.74 ms | 26.51 ms | 31.51 ms |

Sampel ini hanya mengukur overhead endpoint lokal. Tidak ada target PASS/FAIL karena owner belum menyetujui expected organizer count, registration burst, sustained traffic, latency/error SLO, topology, atau budget. Angka tidak boleh dipakai sebagai klaim kapasitas produksi.

## Concurrency correctness

| Kasus | Status lokal | Evidence |
| --- | --- | --- |
| Pendaftaran bersamaan / kuota terakhir | PASS | Transactional function locks profile and checks active count. |
| Duplicate submission | PASS | Tenant dedupe key + idempotency uniqueness. |
| Input nilai bersamaan | PASS | 10 idempotent writes converge without duplicate score. |
| Approval race | PASS | Tepat satu transition berhasil. |
| Publication race | PASS | Tepat satu publication berhasil. |
| Replay privacy request | PASS | Idempotency key returns existing request. |
| Rate limiting | PASS regression | Mutation/public route limiter tests retained. |
| Database connection handling | PARTIAL | Metrics exposes current/max; soak/pool exhaustion staging belum dilakukan. |

Post-run point sample: 11/100 koneksi database (termasuk sesi pemeriksaan), ukuran database 16,940,055 byte, dan RSS proses Next.js sekitar 482,500 KiB. Ini bukan peak telemetry dan tidak dianggap evidence staging. Database test kemudian dihapus; tidak ada database/role CI sementara tertinggal. Historical Phase 9 realtime samples tetap ada dalam Git history, tetapi tidak menggantikan workload multi-kompetisi Phase 22.

## Test berikutnya

Setelah owner menyetujui target, lakukan di staging terisolasi: registration burst dan last-slot race, scoring write workload, read/publication mix, 30–60 minute soak, provider/storage latency, pool exhaustion/recovery, single-instance loss, serta resource telemetry (CPU, RSS, DB CPU/IO/connections/locks). Tetapkan acceptance sebelum test, bukan setelah melihat hasil.
