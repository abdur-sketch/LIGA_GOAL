# National Discovery Architecture

## Scope and boundaries

Phase 16 memperluas portal Phase 7; tidak mengganti competition engine, match center, standings, statistics, Organization, RBAC, atau RLS existing. Discovery adalah projection publik yang eksplisit di atas data tenant.

```text
Tenant workspace
  Organization + Competition (authoritative private/operational data)
       │ organizer permission + audit
       ▼
PublicOrganizerProfile + CompetitionPublication (draft projection)
       │ explicit submit
       ▼
Platform moderation queue (explicit platform grants)
       │ publish / unpublish / suspend + reason + audit
       ▼
Public DAL boundary → search / profile / region / sitemap / homepage
```

## Read invariant

Konten dapat keluar dari public DAL hanya bila seluruh kondisi benar:

1. Organization `ACTIVE` dan `deletedAt IS NULL`.
2. PublicOrganizerProfile `PUBLISHED`.
3. Competition tidak dihapus dan statusnya termasuk status publik yang diizinkan.
4. CompetitionPublication `PUBLISHED`.
5. Query memilih field publik secara eksplisit.

Invariant diterapkan pada `discoveryCompetitionWhere` dan diadopsi oleh portal Phase 7 agar URL lama tidak menjadi bypass.

## Routes

| Route | Peran | Indexing |
|---|---|---|
| `/kompetisi` | direktori/search nasional | canonical base; filtered query noindex |
| `/kompetisi/[slug]` | detail kompetisi publik | index saat published |
| `/wilayah/[province]` | landing provinsi | noindex bila kosong |
| `/wilayah/[province]/[city]` | landing kabupaten/kota | noindex bila kosong |
| `/penyelenggara` | direktori organizer | index |
| `/penyelenggara/[slug]` | profil organizer | index saat published |
| `/organizer/discovery` | authoring tenant | robots blocked + auth/RBAC |
| `/admin/discovery` | moderation platform | robots blocked + explicit grant |

## Write model and moderation

- Organizer dapat menyimpan draft dan mengajukan/tarik publikasi dengan `organization.public_profile.manage` atau `competition.publication.manage`.
- Platform admin saja belum cukup untuk moderasi; user juga wajib memiliki `discovery.moderate.view/manage`.
- Perubahan material pada konten published mengubah status menjadi `PENDING_REVIEW`.
- Semua keputusan menyimpan actor, before/after, resource, timestamp, dan alasan pada AuditLog.
- `PublicSlugRedirect` hanya menerima target internal absolut yang tidak diawali `//`.

## Availability and caching

- Halaman publik memakai ISR 60 detik pada detail/home; direktori berfilter dirender dinamis.
- Cache tidak boleh melampaui predicate publikasi. Unpublish/suspend memerlukan invalidasi atau TTL maksimum 60 detik pada baseline lokal.
- Target sebelum production: purge-by-tag setelah moderation, cache hit metrics, DB pool budget, and rollback playbook.

## Priorities and dependencies

| Priority | Work | Dependency |
|---|---|---|
| P0 | final full E2E, external security review, moderation/legal policy | owner approval |
| P0 | staging with production-like runtime DB role and cache invalidation | infrastructure decision |
| P1 | abuse reporting, moderation appeals, audit export | policy and support ownership |
| P1 | relevance tuning and query telemetry | pilot traffic |
| P2 | featured editorial tooling and personalization | commercial validation |

## Risks

- Cache staleness setelah suspension.
- Moderator overload atau inconsistent decisions.
- Region/source changes breaking discoverability if update governance is weak.
- Search popularity manipulation; score is platform-controlled and never accepted from a public request.
- Public contact misuse; rate limiting and explicit opt-in still require legal/ops controls.
