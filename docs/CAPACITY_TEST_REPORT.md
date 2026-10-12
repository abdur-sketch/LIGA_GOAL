# Phase 11 Capacity Test Report

PROJECT: LIGA GOAL
DATE: 2026-10-12
STATUS: **PASS (local target)**

## Predeclared test contract

- Hardware: Apple host, 12 logical CPUs, 16 GB RAM.
- Database: PostgreSQL 16.14; `max_connections=100`, `shared_buffers=128MB`, `work_mem=4MB`.
- Application: two Next.js 16.4 production instances; non-owner `liga_goal_runtime`; Prisma `connection_limit=5` per instance.
- Workload: realtime snapshot/outbox polling, 50 isolated live matches, one request per viewer per second.
- Duration: 10 seconds per 100/500/750/1,000 tier; 30 seconds sustained at 1,000.
- Acceptance: 0 HTTP/P2028/order/duplicate errors; p95 < 2,000 ms; p99 < 3,000 ms; realtime freshness < 2 seconds; restart recovery < 5 seconds.

## Results

| Viewers | Matches | Duration | Requests | Errors / P2028 | p50 | p95 | p99 | DB p95 | Result |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 100 | 10 | 10 s | 996 | 0 / 0 | 23.38 ms | 454.52 ms | 466.40 ms | 55.93 ms | PASS |
| 500 | 50 | 10 s | 3,980 | 0 / 0 | 358.26 ms | 775.04 ms | 803.30 ms | 236.11 ms | PASS |
| 750 | 50 | 10 s | 5,782 | 0 / 0 | 379.16 ms | 940.59 ms | 968.92 ms | 258.45 ms | PASS |
| 1,000 | 50 | 10 s | 6,634 | 0 / 0 | 607.44 ms | 1,320.19 ms | 1,392.21 ms | 525.30 ms | PASS |
| 1,000 sustained | 50 | 30 s | 22,123 | 0 / 0 | 343.38 ms | 971.71 ms | 1,382.97 ms | 339.68 ms | PASS |

All runs recorded zero ordering errors and zero duplicate messages. Peak observed database connections were 11, consistent with two five-connection application pools plus the observer. Peak sampled application RSS was approximately 441 MB per process; the highest sampled CPU was about 127% per process during the 750-viewer burst.

## Recovery and write integrity

- Instance restart/reconnect: snapshot/outbox SHA-256 stayed `f327f9bc23ffa14308b4b404085de5765b9cfd78574803e815e17e377be58ef7` on the survivor and restarted instance; recovery was below the 5-second target.
- Realtime freshness: a newly inserted outbox event was visible in 5.228 ms.
- Concurrent operators: exactly one of two same-version writes committed, one conflicted, the conflict retried successfully, idempotent replay returned the same event, and the database contained two unique events with no duplicate.
- Tenant isolation: runtime-role RLS suite passed before load; context did not leak after pool reuse, rollback, timeout, or restart.

## Before / after

Phase 10 at 1,000 viewers produced 409 failures from 2,082 requests, Prisma P2028 evidence, p95 3,092.53 ms and p99 3,391.24 ms. Phase 11 produced 0 failures from 6,634 requests, no P2028, p95 1,320.19 ms and p99 1,392.21 ms with the same 5×2 pool limit.

The local capacity gate passes. This is not a production-shaped multi-host or managed-pooler certification; staging verification remains an owner action.
