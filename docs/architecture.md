# LIGA GOAL — Architecture Decision Record

## Phase 0 baseline

LIGA GOAL uses a modular monolith for the initial product. Next.js owns the web UI, server endpoints, and application services; PostgreSQL is the system of record. This keeps transactions and authorization boundaries simple while module contracts remain separable for future extraction.

```text
Browser → Next.js (public pages / protected dashboard / API)
                    ↓
        authentication + authorization
                    ↓
          tenant-scoped services
                    ↓
           Prisma → PostgreSQL
```

## Module boundaries

- `src/app`: routes and composition only.
- `src/components`: reusable presentation components.
- `src/lib/auth`: session, RBAC, and default-deny guards.
- `src/lib/validation`: schemas at trust boundaries.
- Future domain modules belong under `src/modules/<domain>` and expose services rather than direct UI database queries.

## Tenant isolation

The organization is the primary tenant boundary. Tenant-owned reads and writes must include `organizationId` obtained from an active membership—not from an untrusted form field alone. `getEffectivePermissions` verifies the membership and active organization before combining role permissions with explicit per-user overrides. Deny overrides remove permissions after role expansion.

Database compound unique keys prevent common cross-tenant collisions. Application services must use transactions for writes spanning audit and domain records. A PostgreSQL Row Level Security hardening layer is planned before production, as defense in depth; server-side enforcement remains mandatory.

## Authentication

Auth.js credentials sessions use encrypted/signed JWT cookies with `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Passwords are represented only by a bcrypt hash. No default user or production credential is committed. Account provisioning and recovery are intentionally deferred to the organization-management phase.

## Data integrity

- Immutable permanent IDs use CUIDs; slugs are presentation identifiers.
- Soft deletion is reserved for public/business entities whose history must survive.
- Match events have an idempotency key and revision marker.
- Official statistics must be derived from approved match data, not entered independently.
- Audit records store actor, tenant, resource, request correlation, and before/after snapshots.

## Realtime direction

Phase 4 will add a server-authoritative event service. The committed event is written transactionally before a realtime notification is broadcast. Clients reconnect using the last acknowledged revision and never determine the authoritative score.

## Deployment environments

- Local: Docker Compose PostgreSQL and `npm run dev`.
- Staging: isolated database, storage bucket, Auth secret, and hostname; migrations run with `prisma migrate deploy` before switching traffic.
- Production: a separate project/account with independent secrets and backups. No staging data is promoted.

The CI workflow validates generation, lint, TypeScript, unit tests, and production build. Deployment itself is intentionally absent until a hosting target and explicit approval are provided.
