# SEO and Indexing Report

## Implemented

- Unique metadata and canonical URLs for competition, organizer, province, and city pages.
- Open Graph on entity pages.
- JSON-LD SportsOrganization and SportsEvent payloads escaped against `<` injection.
- Dynamic sitemap includes only published competitions/organizers and only regions with published competitions.
- Robots blocks admin, organizer, dashboard, API, auth, and notification surfaces.
- Filtered competition search pages use canonical `/kompetisi` and `noindex,follow`.
- Empty/thin region pages use `noindex,follow`.
- Missing/unpublished entities return 404; known historical paths may redirect only through validated internal redirects.
- Public slugs are globally unique; competition collision fallback includes organization slug.

## Indexability rules

| Entity/state | Sitemap | Index |
|---|---|---|
| Published organizer + active organization | yes | yes |
| Published competition + published organizer | yes | yes |
| Draft/pending/unpublished/suspended | no | no/404 |
| Region with published competition | yes | yes |
| Empty region | no | noindex,follow |
| Search/filter result URL | no | noindex,follow |

## Pre-production work

- Set the real HTTPS `NEXT_PUBLIC_APP_URL`; localhost canonical values are unacceptable in production.
- Validate sitemap/robots and structured data on staging.
- Add social fallback image and hosted image safety policy.
- Implement cache-tag invalidation on moderation transitions.
- Establish redirect governance for renamed/merged regions and changed public slugs.
- Add Search Console/Bing ownership only after owner approval; do not submit a production sitemap during Phase 16.
- Define duplicate/thin content thresholds and editorial policy for featured pages.

## Risk

The principal SEO risk is not missing metadata but indexing stale or unauthorized content. Publication predicates, sitemap exclusions, noindex rules, stable slugs, and short cache TTL reduce this risk; operational purge and takedown procedures remain required for production readiness.
