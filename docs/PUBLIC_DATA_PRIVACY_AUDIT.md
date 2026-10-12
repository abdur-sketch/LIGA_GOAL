# Public Data Privacy Audit

## Finding

Phase 16 creates an explicit public projection rather than publishing Organization records. The public boundary is allow-listed and publication-state gated. Local code/test review found no route that intentionally returns member, invitation, billing, tax, password, session, or internal organization-contact data.

## Data matrix

| Data | Public? | Basis/control |
|---|---|---|
| Organizer display name/description/logo | yes after moderation | explicit organizer submission |
| Public website/email/phone | optional after moderation | separate public fields; never copied from Organization |
| Province/city | yes after moderation | validated master reference |
| Published competition data | yes | dual organizer+competition publish predicate |
| Internal organization contacts/address | no | not selected by public DTO |
| Members, roles, invitations | no | tenant-only/RLS |
| Billing, tax, invoice, payment | no | finance boundary |
| User auth/session/token data | no | identity boundary; hashed tokens |
| Draft/pending/unpublished/suspended content | no | RLS + DAL predicate + sitemap exclusion |
| Minor player data | existing Phase 9 consent rule retained | adult-or-active-consent predicate |

## Abuse and enumeration controls

- Search query max 80 characters, page size max 24, page max 10,000, strict schemas.
- Public API rate limit: 60 requests/minute/client based on trusted-proxy policy.
- Organizer/moderator mutation limits and generic validation errors.
- Public responses use a safe DTO and never return raw Prisma models containing private relations.
- Unknown/unpublished slugs yield the same 404 behavior; redirects accept internal paths only.

## Residual risks

- Public contact scraping and spam.
- Free-text accidental personal data.
- External logo/website tracking or unsafe content.
- Cache window after suspension.
- Inference from competition timing/location and existing player consent rules.

## Required owner decisions

Approve public contact consent language, privacy notice version, moderation/takedown SLA, retention after unpublish/suspension, abuse reporting channel, image policy, legal basis by user category, and cache purge maximum. Production remains NO-GO until those controls and legal review are complete.
