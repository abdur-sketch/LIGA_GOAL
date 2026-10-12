# Indonesia Region Model

## Source and version

- Authoritative legal reference: **Keputusan Menteri Dalam Negeri Nomor 300.2.2-2430 Tahun 2025**, effective 23 June 2025.
- Official reference: <https://peraturan.bpk.go.id/Details/322912/keputusan-mendagri-no-30022-2430-tahun-2025>.
- It amends Kepmendagri 300.2.2-2138 Tahun 2025.
- Mechanical extraction was compared with the open derivative dataset `cahyadsn/wilayah`, commit `7586f4278ecbcbabd4b65f8d594913e9d256a29a`; the legal source remains authoritative.
- Imported count: 38 provinces and 514 regencies/cities (552 rows).
- Transformation SHA-256: `76775c72e819abf7f5b22cd258ba3eca59a2acb09bc99532f8b1e5d873fe56fb`.
- Source SQL SHA-256: `84aae46fa34a5c361404bcb59eb8c95d18508e8460cfdd9fb4deaa6382c2e352`.

## Data model

- `RegionDataset`: provenance, version, URL, checksum, effective/import date, active version.
- `AdministrativeArea`: stable code, type, name, stable slug, parent, active/retired state, source dataset.
- `AdministrativeAreaRevision`: immutable per-dataset snapshot for change audit.
- Competition/profile tables reference area IDs, never free-text UI constants.

Only province and kabupaten/kota are in Phase 16 scope. Kecamatan and desa/kelurahan are intentionally excluded to control size and governance.

## Update mechanism

`npm run regions:import -- /absolute/path/verified-regions.json` performs an opt-in local import. Required controls:

1. File contains provenance, effective date, expected SHA-256, and ordered rows.
2. Checksum, code format, uniqueness, and parent order are verified before transaction.
3. Existing public slugs are retained on name changes, preventing URL breakage.
4. New rows are added; missing rows are retired, never destructively deleted.
5. Dataset activation, row updates, and revisions occur in one serializable transaction.
6. Script must run with migration-owner authority, never the runtime app role.

Before any real update, a human must compare the official decree, review additions/renames/splits/mergers, create explicit redirects where semantics change, run fresh+upgrade migration tests, and approve the diff.

## Risks and owner decisions

- Administrative changes can be legally effective before downstream datasets update.
- Stable slug retention favors SEO safety over mirroring renamed labels in URLs.
- Owner must appoint data steward, legal authority hierarchy, update cadence, and correction SLA.
- Coordinates, regional aliases, and historical boundary mappings are not included; approve separately if map/search needs them.
