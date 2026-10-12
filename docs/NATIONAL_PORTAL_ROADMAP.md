# LIGA GOAL — National Portal Roadmap

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Product and architecture roadmap only

## 1. Baseline

The existing portal already provides:

- national-style home feed with live/today/upcoming/results;
- competition directory and detail;
- public match detail and realtime replay;
- standings, player/team statistics, top scorer and top assist;
- public club and consent-eligible player profiles;
- articles, in-app follows/notifications, fixtures and reports;
- sitemap, robots controls and `SportsEvent` structured data;
- publication predicates for active organizations, published matches/results and approved club entries;
- minor/guardian consent filtering and private-document separation.

Missing or incomplete for national discovery:

- normalized province/regency/city taxonomy and filters;
- full-text/fuzzy search and search analytics;
- public organizer profiles and verification badges;
- governed featured-competition workflow;
- geography/organizer SEO landing pages and scalable sitemap partitioning;
- explicit publication profile/settings per tenant;
- discovery moderation, stale-data policy and national-scale caching/search projections.

## 2. Public data contract

Only a dedicated projection may enter national discovery. Proposed allowlist:

| Entity | Allowed when | Public fields |
|---|---|---|
| Organization | `ACTIVE`, not deleted, public profile published | Display name, slug, approved logo, public bio, public website/contact channel, verified status, service geography |
| Competition | Organization publishable; competition status/publication flag valid | Name, slug, description, logo, category, normalized geography, dates, format/status, public regulations |
| Club | Active, approved in a public competition | Name, short name, slug, logo, city/regency, founded year, public description, public venue summary |
| Match | Explicitly published and competition public | Teams, schedule, venue public fields, status, score, approved timeline/lineup and officials per policy |
| Standings/statistics | Published snapshot only | Official computed tables and freshness timestamp |
| Player | Adult or valid active publication consent | Existing public profile/statistics allowlist only |
| Article | Published/scheduled-effective under active tenant | Sanitized title, excerpt/body, category and references |

Never expose owner/member email, private player profile, identity/age documents, medical detail, invitation/billing data, audit payloads or internal risk/suspension notes.

## 3. Geography model

Current free-text `Competition.location`, `Club.city` and `Venue.city` are useful display fields but insufficient for national filtering. Add canonical reference data:

- `AdministrativeArea`: stable national code, type (`PROVINCE`, `REGENCY`, `CITY`), parent, official name, slug, active/version dates;
- nullable area references on organization public profile, competition, club and venue;
- keep existing text fields for venue/address display and migration compatibility;
- map legacy values through a reviewed reconciliation tool; never guess silently;
- store taxonomy version/source and allow platform correction with audit.

Use official Indonesian administrative codes/data selected by the owner/legal team. A taxonomy update must not break stable public URLs; redirect retired slugs.

## 4. Discovery experience

### National home

- live and upcoming matches;
- featured competitions with editorial/sponsorship disclosure;
- browse by province/city/category;
- recent official results and published standings;
- verified organizer highlights;
- clear freshness labels and empty-state coverage.

### Search

One input with scoped results for competitions, organizers, clubs, matches and consent-eligible players. Filters: province, city/regency, category, status, date and organizer. Use PostgreSQL full-text/trigram and a denormalized public search projection first; add a managed search engine only after measured need.

Search indexing is outbox-driven after the source transaction commits. Each document contains publication state/version. Withdrawal, suspension or consent revocation must remove the document promptly and invalidate caches.

### Organizer profile

Shows verified display identity, public description, service areas, active/past public competitions, contact channel, published policies and last activity. “Verified” means an approved platform process, not a paid-plan badge.

### Competition and club pages

Extend existing pages with canonical geography, breadcrumbs, share metadata, organizer link, season archive and clearer official/unofficial freshness. Preserve existing standings, bracket, match, news and player-statistics modules.

## 5. Featured competitions governance

Use a separate campaign/editorial assignment with start/end time, placement, rank/weight, actor, reason, disclosure type and audit. Eligibility may depend on plan, quality, safety and completeness, but selection must be reviewable. Expired/suspended/unpublished competitions disappear automatically. Do not add a simple ungoverned `featured=true` flag to `Competition`.

## 6. SEO architecture

Proposed stable routes:

- `/indonesia/kompetisi`
- `/provinsi/{provinceSlug}/kompetisi`
- `/kota/{citySlug}/kompetisi`
- `/penyelenggara/{organizationSlug}`
- existing `/kompetisi/{slug}`, `/klub/{slug}`, `/pertandingan/{id}`, `/pemain/{id}`

Requirements:

- unique canonical URL and server-rendered metadata per publishable page;
- title/description templates based only on public fields;
- `SportsEvent`, `SportsOrganization`, `SportsTeam`, `BreadcrumbList` and list structured data where accurate;
- paginated sitemap indexes by entity/geography after current 500/1,000 caps become insufficient;
- `noindex` for search parameters, empty/thin pages, pending organizers, private/admin and notification pages;
- redirect strategy for slug/geography changes;
- Open Graph images with safe generated templates;
- Indonesian language first; localization architecture only when content ownership exists.

SEO never overrides privacy. Consent withdrawal and unpublication must update sitemap, cache and search projection.

## 7. Performance and capacity

- Cache national lists and details by publication version/tag, not by leaking tenant transaction state.
- Keep live score polling/realtime separate from long-lived page caches.
- Use cursor pagination for growing directories; avoid loading every club/competition as the current small-data implementation does.
- Precompute search documents, featured feeds and aggregate geography counts.
- Add CDN caching for public media and cache-safe pages; private/quarantine objects remain inaccessible.
- Measure p50/p95/p99, cache hit rate, database rows scanned, search zero-result rate and index lag.
- Set a freshness target: match events seconds, fixtures/minutes, directory/SEO changes minutes, not a single universal TTL.

## 8. Trust, safety and moderation

- Publish organizer/competition profiles only after verification and policy acceptance.
- Provide abuse/reporting intake with category, evidence reference, status and SLA; do not expose reporter identity.
- Prevent impersonation and trademark abuse through slug/name review and verified badge policy.
- Sanitize user content and URLs; retain existing upload quarantine/scanning.
- Suspension removes or labels content according to legal/safety policy, while preserving official results where justified.
- Editorial and sponsored placements are disclosed and audited.
- Provide correction/unpublication workflow and contact ownership.

## 9. Roadmap

| Stage | Priority | Scope | Estimate | Dependencies | Exit gate |
|---|---|---|---:|---|---|
| NP-0 | P0 | Public data contract, privacy review, publication settings | 1–2 engineer-weeks + legal | Owner/legal decisions | Field allowlist approved |
| NP-1 | P0 | Geography references, migration/reconciliation and filters | 2–3 engineer-weeks | Official taxonomy source | Legacy mapping reviewed |
| NP-2 | P0 | Organizer profiles and verification/publication workflow | 2–3 engineer-weeks | Onboarding and moderation | Cross-tenant/privacy tests pass |
| NP-3 | P1 | Search projection, FTS/trigram, filters and analytics | 3–4 engineer-weeks | NP-0/1/2, outbox worker | Search latency/relevance UAT |
| NP-4 | P1 | Featured feed governance and home discovery | 1–2 engineer-weeks | Editorial policy | Disclosure/audit UAT |
| NP-5 | P1 | SEO landing pages, metadata and sitemap partitioning | 2–3 engineer-weeks | Stable geography/profile routes | Crawl/privacy checks pass |
| NP-6 | P1 | CDN/cache tags, pagination and load validation | 2–3 engineer-weeks | Staging infrastructure | Approved national portal SLO |
| NP-7 | P2 | Moderation/reporting and operating dashboard | 2–3 engineer-weeks | Trust/safety owner | Runbook and escalation drill |

Total: 15–23 engineer-weeks, overlapping with onboarding/platform work.

## 10. Metrics

- discovery: search success, filter usage, page-to-competition engagement;
- supply: publish-ready organizations/competitions by province;
- freshness: event/search/index lag and stale page rate;
- quality: zero-result queries, duplicate entities, mapping error rate;
- safety: report volume, resolution time, consent/unpublication propagation;
- performance: Core Web Vitals, server latency, cache hit and database load;
- commercial: qualified organizer leads and conversion, separated from editorial ranking.

## 11. Owner decisions required

1. Approve the public field allowlist, consent/legal basis and unpublication SLA.
2. Select the authoritative Indonesian geography dataset and update process.
3. Define organizer verification and badge policy.
4. Define featured/editorial/sponsored placement rules.
5. Approve public portal SLO, search relevance acceptance and moderation ownership.
6. Decide whether historical official results remain public after tenant cancellation/suspension.

No national publication expansion occurs in Phase 12. Production remains **NO-GO**.
