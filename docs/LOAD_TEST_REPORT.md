# Load Test Report

PROJECT: LIGA GOAL
PHASE: 9
DATE: 2026-10-11

Environment: two local Next.js 16.4 production processes, shared PostgreSQL 16, LocalStack S3, synthetic data only. Workload: realtime match polling through `scripts/realtime-load-test.mjs`, 1-second polls, 10-second samples.

| Matches | Viewers | Requests | Errors | Ordering / duplicates | p50 | p95 | p99 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 100 | 901 | 0 | 0 / 0 | 98.26 ms | 585.54 ms | 612.40 ms |
| 50 | 250 | 2,164 | 0 | 0 / 0 | 126.01 ms | 807.77 ms | 839.40 ms |
| 50 | 500 | 3,235 | 0 | 0 / 0 | 667.58 ms | 1,104.20 ms | 1,246.99 ms |
| 50, one surviving instance | 250 | 1,716 | 0 | 0 / 0 | 491.35 ms | 941.18 ms | 985.74 ms |

Peak observed database connections after two-instance runs: 27. Post-run memory was about 370 MB per Next process; this is a point sample, not peak telemetry. Restarted and surviving instances returned byte-identical realtime payload hashes for the same cursor and readiness remained HTTP 200.

An earlier 500-viewer attempt returned 431 failures and a subsequent 250-viewer attempt returned 208 HTTP 429 responses because synthetic rate-limit buckets from consecutive runs were retained. After clearing only the disposable test database buckets between independent samples, the reported runs had zero errors. This proves limiter behavior; it is not omitted from the evidence.

Limits: no load balancer, managed DB, multi-host latency, sustained soak, write-heavy 50-match operator workload, or production cost was measured. No production capacity claim is made. Provider/topology selection and SLO approval are required before staging capacity testing.
