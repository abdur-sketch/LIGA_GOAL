# LIGA GOAL

Semua Liga, Satu Platform. Phase 0 foundation for a multi-organization football competition management and live-score product.

## Local setup

Requirements: Node.js 22+, npm, Docker.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
npm run dev
```

Generate a unique `NEXTAUTH_SECRET` before starting. The baseline intentionally creates no user. Use an approved provisioning flow before enabling access.

Bootstrap the first Super Admin with explicit environment variables:

```bash
ADMIN_EMAIL="admin@example.id" ADMIN_NAME="Platform Admin" ADMIN_PASSWORD="use-a-secret-manager-value" npm run admin:bootstrap
```

Phase 1 management is available below `/admin`. Image uploads accept only signature-validated PNG, JPEG, or WebP files up to 2 MB. Set `UPLOAD_DIR` to mounted persistent storage outside local development; an S3-compatible adapter remains required before production.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
DATABASE_URL="postgresql://..." npm run test:integration
npm run test:e2e
npm run build
```

Architecture and security decisions live in [`docs/architecture.md`](docs/architecture.md), [`docs/erd.md`](docs/erd.md), and [`docs/threat-model.md`](docs/threat-model.md). The Phase 0 handoff is in [`docs/phase-0-report.md`](docs/phase-0-report.md).
