# Load Test Report

PROJECT: LIGA GOAL  
PHASE: 8  
DATE: 2026-10-10

Environment: one local Next.js production process, one local PostgreSQL instance, Apple development workstation, `GET /api/health/live`, five seconds per run. Tool: `scripts/load-test.mjs`. CPU, memory, connection count and query latency were not captured.

| Concurrency | Requests | Errors | Throughput | p50 | p95 | p99 | Status |
|---:|---:|---:|---:|---:|---:|---:|---|
| 100 | 3,594 | 0 | 718.8 req/s | 124.16 ms | 227.63 ms | 308.60 ms | PASS for health-only baseline |
| 500 | 4,525 | 0 | 905.0 req/s | 535.18 ms | 575.88 ms | 1,106.26 ms | PASS for health-only baseline |
| 1,000 | 5,149 | 0 | 1,029.8 req/s | 881.91 ms | 1,803.09 ms | 5,774.75 ms | PASS for health-only baseline; tail latency high |

These results are **not** a capacity claim for public viewers: the endpoint performs no football query, realtime polling or rendering.

| Required scenario | Status |
|---|---|
| 100/500/1,000 real public viewers | NOT TESTED |
| 10 simultaneous live matches | NOT TESTED |
| 50 simultaneous live matches | NOT TESTED |
| Concurrent event submissions | NOT TESTED |
| Concurrent statistics reads | NOT TESTED |
| Notification burst | NOT TESTED |
| Multi-instance consistency/failover | NOT TESTED |

Next run must use production-like isolated compute and database sizing, realistic seeded matches, workload-specific checks, two or more application instances, resource and database telemetry, and agreed latency/error SLOs. Do not target production.
