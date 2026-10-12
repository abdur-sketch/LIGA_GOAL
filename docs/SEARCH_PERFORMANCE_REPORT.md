# Search Performance Report

## Test setup

- Date: 13 October 2026 local work session; JSON timestamp `2026-10-12T17:24:55.408Z` (UTC).
- Database: local PostgreSQL, isolated `liga_goal_phase16_perf_20261013`.
- Dataset: 10,000 synthetic active organizations, public profiles, competitions, and publications plus the 552-area master.
- Runner: `npm run benchmark:discovery`, guarded by database-name and explicit opt-in checks.
- Method: 10 warm-up calls, then 100 serial samples/query through Prisma; values include local driver round trip.

## Results

| Scenario | p50 | p95 | max |
|---|---:|---:|---:|
| `searchText` contains with trigram | 8.414 ms | 10.697 ms | 12.560 ms |
| Province + city filter | 1.760 ms | 3.104 ms | 4.401 ms |
| Popularity stable sort | 1.774 ms | 2.244 ms | 5.069 ms |

Indexes include GIN `gin_trgm_ops` on CompetitionPublication.searchText and Competition.name, plus compound status/region/popularity/publishedAt indexes. Pagination is bounded to 24 records, queries use deterministic ID tie-breakers, and request pages are capped at 10,000.

## Interpretation

The baseline is comfortable for a 10k-row local synthetic corpus, but cannot predict production latency. It excludes network, TLS, connection queueing, concurrent writes, cache invalidation, real text distribution, replicas, and noisy-neighbor effects. `%contains%` search provides discovery, not sophisticated relevance.

## Scaling triggers

- Add slow-query telemetry and `EXPLAIN` sampling before pilot.
- Review at 100k/1m published competitions and at pilot concurrency.
- Establish owner-approved SLO; proposed starting target: cached directory p95 <250 ms and uncached DB search p95 <100 ms under pilot load.
- Consider PostgreSQL full-text ranking/aliases first; adopt a dedicated search service only when relevance, typo handling, faceting, or measured load justifies operational cost.
- Do not use popularity score without anti-manipulation, bounded aggregation, and auditable platform ownership.
