# Entity relationship overview

```mermaid
erDiagram
  USER ||--o{ ORGANIZATION_MEMBER : joins
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
  ROLE ||--o{ ORGANIZATION_MEMBER : assigns
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : contains
  USER ||--o{ USER_PERMISSION : overrides
  ORGANIZATION ||--o{ COMPETITION : owns
  USER ||--o{ ORGANIZATION : owns
  COMPETITION ||--o{ SEASON : has
  SEASON ||--o{ STAGE : has
  STAGE ||--o{ GROUP : has
  STAGE ||--o{ MATCH : schedules
  ORGANIZATION ||--o{ CLUB : owns
  CLUB ||--o{ TEAM : enters
  CLUB ||--o{ COMPETITION_CLUB : participates
  COMPETITION ||--o{ COMPETITION_CLUB : accepts
  SEASON ||--o{ COMPETITION_CLUB : scopes
  ORGANIZATION ||--o{ VENUE : manages
  ORGANIZATION ||--o{ OFFICIAL : manages
  OFFICIAL ||--o{ OFFICIAL_ASSIGNMENT : receives
  SEASON ||--o{ OFFICIAL_ASSIGNMENT : scopes
  COMPETITION ||--o{ TEAM : includes
  MATCH ||--o{ MATCH_EVENT : records
  PLAYER ||--o{ PLAYER_REGISTRATION : registers
  SEASON ||--o{ PLAYER_REGISTRATION : scopes
  ORGANIZATION ||--o{ AUDIT_LOG : records
```

The Prisma schema is the detailed, executable data model. Additional operational tables listed in the master specification are introduced in the phase that owns their invariants rather than as inert tables in Phase 0.
