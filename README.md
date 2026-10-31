# PORTAL LOMBA

**Satu Portal, Semua Kompetisi.**

PORTAL LOMBA adalah platform digital terintegrasi untuk manajemen perlombaan, workspace penyelenggara, publikasi kompetisi, live score, klasemen, statistik, dan discovery nasional. Aplikasi mempertahankan arsitektur multi-tenant, RBAC, serta PostgreSQL RLS yang dibangun pada fase sebelumnya.

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

Management tersedia di `/admin` dan self-service organizer di `/organizer`. Image uploads hanya menerima PNG, JPEG, atau WebP yang lolos validasi signature hingga 2 MB. Gunakan object storage S3-compatible dan malware scanner eksternal sebelum production.

## Quality checks

Local-first CI membuat dan membersihkan database test terisolasi secara otomatis:

```bash
npm run ci:quick
npm run ci:security
npm run ci:local
```

Lihat [`docs/GITHUB_FREE_SETUP.md`](docs/GITHUB_FREE_SETUP.md) untuk prasyarat, model keamanan database, konfigurasi GitHub Free, dan troubleshooting billing lock.

```bash
npm run lint
npm run typecheck
npm test
DATABASE_URL="postgresql://..." npm run test:integration
npm run test:e2e
npm run build
```

Architecture and security decisions live in [`docs/architecture.md`](docs/architecture.md), [`docs/erd.md`](docs/erd.md), and [`docs/threat-model.md`](docs/threat-model.md). The Phase 0 handoff is in [`docs/phase-0-report.md`](docs/phase-0-report.md).

## Compatibility identifiers

Nama database/role `liga_goal*`, `LIGA_GOAL_ENVIRONMENT`, cookie sesi, localStorage keys, metric names, webhook header, dan provider template IDs lama sengaja dipertahankan. Identifier tersebut merupakan kontrak kompatibilitas; branding yang terlihat pengguna menggunakan PORTAL LOMBA.
