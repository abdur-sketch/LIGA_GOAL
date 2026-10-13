# Staging Architecture — Phase 18

## Recommended topology

Gunakan staging terpisah dengan bentuk mendekati production: satu web service, satu worker terisolasi, managed PostgreSQL, S3-compatible public/private/quarantine buckets, ClamAV service, email sandbox, payment sandbox, centralized logging/monitoring, secret manager, dan backup ke failure domain terpisah. Tidak boleh berbagi account project, database, bucket, key, webhook secret, domain cookie, atau data pengguna dengan production.

```text
staging DNS/TLS
      |
web service ---- realtime HTTP/polling
      |  \
      |   worker/jobs ---- email/payment sandbox
      |
managed PostgreSQL (migration/backup/runtime roles)
      |
object storage: public | private | quarantine ---- ClamAV
      |
logs/metrics/alerts + encrypted backup copy
```

## Options and planning cost

| Opsi | Bentuk | Estimasi/bulan | Risiko | Status |
|---|---|---:|---|---|
| Single VPS | Web, worker, PostgreSQL pada satu host; object external | USD 41–61 | Satu failure domain, patch/PITR manual | Tidak direkomendasikan untuk staging release gate |
| Hybrid | VPS web/worker + managed PostgreSQL + object storage | USD 74–110 | OS/app tetap dioperasikan tim | **Rekomendasi pilot cost/control** |
| Fully managed | PaaS web/worker + managed PostgreSQL/storage | USD 92–150+ | Unit cost/vendor constraints | Rekomendasi bila operator terbatas |

Angka adalah planning estimate sebelum pajak/FX/overage. Dokumen resmi DigitalOcean saat audit menyebut App Platform 1 vCPU/2 GiB USD 25/bulan dan job/worker ditagih saat berjalan; PostgreSQL single-node mulai USD 15/bulan, sedangkan HA memerlukan primary dan standby. Verifikasi ulang saat approval: [App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/), [PostgreSQL pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/).

## Minimum staging controls

- Web 1 vCPU/2 GiB sebagai titik awal; worker terpisah; jangan build pada runtime container kecil.
- PostgreSQL minimal 2 GiB untuk UAT/load, TLS/VPC, PITR, connection cap, query insights, dan role `NOBYPASSRLS`. Managed DB menyediakan backup/PITR tetapi restore tetap wajib diuji: [managed database features](https://docs.digitalocean.com/products/databases/).
- Persistent media wajib object storage karena filesystem PaaS ephemeral: [App Platform limits](https://docs.digitalocean.com/products/app-platform/details/limits/).
- Bucket public/private/quarantine terpisah; private-by-default, versioning/retention, checksum, scoped IAM.
- Email/payment hanya sandbox. Webhook memakai secret berbeda, allowlist event, idempotency, replay test.
- Metrics: request p95/p99/error, DB connections/CPU/IO, queue lag, realtime freshness, storage scan lag, backup age.
- Logs terstruktur dengan redaction token, email, medical/minor data; retention disetujui privacy owner.
- Secrets disuntikkan saat runtime; rotasi dan break-glass tercatat.

## Scaling and release sequence

1. Provision isolated staging setelah budget/provider approval.
2. Restore synthetic snapshot; apply migration melalui guarded deploy.
3. Integrasikan storage/scanner/email sandbox, lalu payment sandbox.
4. Ulangi 50 E2E, RLS, backup/restore, provider failure, dan load test dengan telemetry provider.
5. Tambah instance/LB hanya berdasarkan p95, CPU, memory, DB connections, dan queue lag.

Tidak ada resource cloud atau billing dibuat pada Phase 18.
