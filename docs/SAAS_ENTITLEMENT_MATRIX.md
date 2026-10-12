# SaaS Entitlement Matrix — Phase 14

Status: local configuration v1, effective 12 October 2026. Values below are seeded data in the versioned catalog, not UI constants. `—` means unavailable; `∞` means no catalog limit. Prices are stored as IDR minor units in `PlanVersion.priceConfig`; they are commercial assumptions from Phase 12 and do not trigger a charge.

| Capability / limit | Free | Tournament | Pro League | Organizer Pro | Enterprise |
|---|---:|---:|---:|---:|---:|
| Billing model | Zero | Event | Recurring | Recurring | Contract |
| Configured price | Rp0 | Rp750.000/event | Rp1.500.000/month | Rp3.500.000/month | Configured |
| Active competitions | 1 | 1 | 1 | 10 | ∞ |
| Clubs / competition | 8 | 32 | 40 | 64 | ∞ |
| Players / competition | 150 | 1,000 | 2,000 | 5,000 | ∞ |
| Active staff | 3 | 10 | 20 | 100 | ∞ |
| Live match capability | 1 | 4 | 8 | 20 | ∞ |
| PDF exports / month | 3 | 50 | 100 | 500 | ∞ |
| Excel exports / month | 3 | 50 | 100 | 500 | ∞ |
| Advanced statistics | — | Yes | Yes | Yes | Yes |
| News CMS | Yes | Yes | Yes | Yes | Yes |
| Organizer branding | — | Event | Basic | Advanced | Custom |
| Multiple seasons | — | — | Yes | Yes | Yes |
| Priority support | Community | Event | Business | Priority | Contract |

## Stable keys and scope

- Organization: `competition.create`, `competition.max_active`, `member.max_active`, `match.live`, `statistics.advanced`, `export.pdf`, `export.excel`, `content.news`, `branding.organizer`, `season.multiple`, `support.priority`.
- Competition: `club.max_per_competition`, `player.max_per_competition`.
- A `CompetitionEntitlement` can override the organization plan for one competition, optionally narrowed to a season and bounded by start/end time.
- RBAC and entitlement are independent. A request needs the tenant permission and a positive server-side entitlement decision.

## Versioning rules

Published versions are immutable. A commercial change creates a new `PlanVersion`; it does not rewrite historical subscriptions. Active/effective dates select the published version. Client-supplied prices and limits are ignored. Existing Phase 0–13 organizations receive Enterprise v1 compatibility during migration; new self-service organizations receive Free v1.

## Enforcement coverage

Phase 14 gates organization provisioning paths for competition creation, active competition quota, staff membership/invitation acceptance, club participation, and multiple seasons. The central service supports all keys above. Before a feature outside those provisioning paths becomes commercially restricted, its module mutation/export boundary must call the same service and, where metered, reserve and commit usage. This is a rollout dependency, not permission to rely on hidden UI.
