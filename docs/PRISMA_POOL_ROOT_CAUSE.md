# Prisma P2028 / Pool Root Cause

PROJECT: LIGA GOAL
PHASE: 11
DATE: 2026-10-12
STATUS: **RESOLVED for local target**

## Root cause

The Phase 10 public realtime route wrapped every poll in a Prisma interactive transaction to establish public RLS context. Inside that transaction it first updated a database rate-limit bucket and then read match/outbox state. Load traffic appeared as one `direct-client`, so many polls contended on the same per-match bucket row while holding or waiting for one of five Prisma connections per instance. The request queue exceeded Prisma's interactive transaction acquisition window and emitted P2028.

Evidence ruled out a PostgreSQL connection ceiling: only 11 connections were observed against `max_connections=100`, and there was no database CPU/slow-query saturation explaining the failures. The bottleneck was application transaction acquisition amplified by row-lock contention.

## Fix

1. Execute the rate-limit update before any public tenant-data scope.
2. Resolve trusted forwarded client addresses when `TRUSTED_PROXY_HOPS` is explicitly configured, avoiding one shared bucket behind the load balancer.
3. Replace the realtime interactive transaction with one PostgreSQL statement: transaction-local RLS settings, published-match predicate, snapshot and bounded outbox replay are one CTE query.
4. Keep non-realtime snapshots inside the normal explicit public transaction.
5. Add `Server-Timing` database duration and P2028/load counters.

No pool size was increased. Retry was not used to hide capacity failures.

## Verification

| Metric | Phase 10 before | Phase 11 after |
|---|---:|---:|
| 1,000-viewer requests / sample | 2,082 | 6,634 |
| HTTP failures | 409 | 0 |
| P2028 evidence | Present | 0 |
| p95 | 3,092.53 ms | 1,320.19 ms |
| p99 | 3,391.24 ms | 1,392.21 ms |
| Application pool | 5×2 | 5×2 |
| Observed DB connections | 11 | 11 |

The 30-second 1,000-viewer soak added 22,123 requests with zero failures/P2028 and p95 971.71 ms. Restart/reconnect, freshness, concurrent writes, idempotency and tenant isolation also passed.

## Remaining risk

Local two-process results do not certify a managed pooler, cross-host network, production database sizing or real load balancer trust configuration. Repeat the same test contract in approved staging and alert on P2028, DB wait time, pool acquisition, rate-bucket contention and realtime delay.
