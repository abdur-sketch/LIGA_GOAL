# LIGA GOAL — Infrastructure and Cost Plan

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Planning estimate only; no service purchased or billing enabled

## 1. Assumptions

- Region near Indonesian users, initially Singapore when the selected provider supports it.
- One staging environment and a separate production environment; no shared database/secrets.
- Next.js application remains stateless. PostgreSQL is authoritative; public/private/quarantine media use S3-compatible object storage.
- Baseline load evidence is local only: 1,000-viewer tests passed in Phase 11, but this is not a production capacity guarantee.
- Planning exchange rate: **USD 1 = Rp16.500**, with ±10% contingency. This is a budgeting assumption, not a quoted exchange rate.
- Estimates exclude VAT/tax, domain, payment fees, email/SMS, malware service, external observability/support, engineering labor and traffic overages unless stated.

Official price anchors checked on 2026-10-12:

- [DigitalOcean Basic Droplets](https://www.digitalocean.com/pricing/droplets): 2 vCPU/4 GiB at USD 24/month; 4 vCPU/8 GiB at USD 48/month; backups quoted as 20% weekly or 30% daily of Droplet cost.
- [DigitalOcean Managed PostgreSQL](https://www.digitalocean.com/pricing/managed-databases): approximately USD 15.15/month for 1 GiB/1 vCPU and USD 30.45 for 2 GiB/1 vCPU at the listed minimum storage ranges; additional nodes increase cost.
- [DigitalOcean Spaces](https://docs.digitalocean.com/products/spaces/details/pricing/): USD 5/month includes 250 GiB storage; additional standard storage USD 0.02/GiB-month. The product page lists 1 TiB outbound transfer with the base plan.
- [DigitalOcean App Platform](https://docs.digitalocean.com/products/app-platform/details/pricing/): shared containers are USD 25/month for 1 vCPU/2 GiB and USD 50/month for 2 vCPU/4 GiB; additional transfer is USD 0.02/GiB.
- [DigitalOcean Load Balancers](https://docs.digitalocean.com/products/networking/load-balancers/details/pricing/): regional HTTP load balancer starts at USD 12/month per node.
- Alternative object storage reference: [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/) lists standard storage at USD 0.015/GB-month, request charges, a monthly free tier and zero Internet egress fees. Provider/IAM/region/legal review is still required.

Prices can change. Recheck official calculators immediately before budget approval; do not treat this document as a vendor quote.

## 2. Option A — Single VPS

### Topology

One 2 vCPU/4 GiB VPS runs reverse proxy, Next.js, worker and PostgreSQL; object media is external S3-compatible storage. Encrypted database backups are copied to a separate failure domain.

### Cost estimate

| Item | Monthly USD |
|---|---:|
| 2 vCPU/4 GiB VPS | 24 |
| Daily VPS backup (30% example) | 7.20 |
| Object storage base | 5 |
| External backup copy/monitoring allowance | 5–25 |
| **Planning total** | **41–61** |
| **Approx. IDR** | **Rp0,68–1,01 juta** |

### Minimum and capacity

- Minimum 2 vCPU, 4 GiB RAM, 80 GiB SSD; 8 GiB is safer for application + PostgreSQL + build activity.
- Suitable only for developer preview or tightly controlled pilot with accepted downtime, not national production.
- Capacity is unknown until the production build, TLS proxy, database, storage and monitoring are load-tested together.

### Risks

Single failure domain, maintenance downtime, noisy-neighbor/resource contention, operator-managed patching/database/PITR, difficult failover, local disk risk and high operational burden. A VPS snapshot is not a complete database/object restore strategy.

### Recommendation

Use only for short-lived staging or a non-critical pilot after explicit risk acceptance. Do not call it production-ready.

## 3. Option B — Hybrid VPS + managed database/storage

### Topology

One or two application VPS instances, managed load balancer when using two, managed PostgreSQL with PITR/backups, managed S3-compatible storage, separate job process and external monitoring.

### Cost estimate

| Item | Lean pilot | Commercial baseline |
|---|---:|---:|
| App compute | 1 × USD 24 | 2 × USD 24 = 48 |
| Regional load balancer | 0 | 12 |
| Managed PostgreSQL | 30.45 (2 GiB) | 60.90+ (4 GiB; HA/additional node extra) |
| Object storage | 5 | 5+ |
| Backups/monitoring/worker allowance | 15–40 | 30–80 |
| **Planning total USD** | **74–99** | **156–206+** |
| **Approx. IDR** | **Rp1,22–1,63 juta** | **Rp2,57–3,40 juta+** |

### Minimum and capacity

- Pilot app: 2 vCPU/4 GiB; managed PostgreSQL at least 2 GiB; explicit connection pool limits.
- Commercial baseline: two stateless app instances, managed LB, 4 GiB database starting point, dedicated worker or controlled jobs.
- Repeat Phase 11 public polling and write-heavy match-operation tests with provider telemetry, then size from CPU, memory, connection, IOPS and p95/p99 data.

### Risks

Application OS/runtime remains operator-managed; deployment/failover scripting and patching are still required. Managed database does not automatically validate RLS roles, pooler compatibility, PITR or restore. Cross-provider storage can add latency/egress and IAM complexity.

### Recommendation

Best cost/control candidate for the first commercial pilot if the team can own server operations. Prefer two app instances before external commercial promises.

## 4. Option C — Fully managed application platform

### Topology

Managed App Platform/PaaS for web and worker, managed PostgreSQL, managed object storage/CDN, managed load balancing/autoscaling where supported, plus external observability and email/scanner providers.

The selected platform must support the Next.js runtime behavior, health checks, long-running jobs or separate workers, environment secrets and connection pooling. App Platform local disks are ephemeral; its [documented limits](https://docs.digitalocean.com/products/app-platform/details/limits/) require persistent files to live in object storage/database.

### Cost estimate

| Item | Managed pilot | Managed commercial baseline |
|---|---:|---:|
| Web service | 1 × USD 25 | 2 × USD 25 = 50 |
| Worker/job capacity | 12–25 | 25–50 |
| Managed PostgreSQL | 30.45 | 60.90 plus HA node where approved |
| Object storage | 5 | 5+ |
| Monitoring/provider allowance | 20–50 | 50–120 |
| **Planning total USD** | **92–135** | **191–286+** |
| **Approx. IDR** | **Rp1,52–2,23 juta** | **Rp3,15–4,72 juta+** |

### Minimum and capacity

- One 2 GiB web container is a pilot starting point, not an SLO.
- Commercial baseline needs at least two web instances and isolated worker capacity; autoscaling thresholds must use measured request latency/CPU.
- Managed platform reduces infrastructure operations but not application, database, privacy, security or incident-response responsibility.

### Risks

Higher unit cost, provider limits, usage/egress surprises, cold starts or runtime differences, vendor lock-in and less low-level control. Provider-managed does not mean application-supported Next.js behavior is automatically correct.

### Recommendation

Best option when a small team values deployment/patching simplicity over lowest unit cost. Evaluate in staging alongside the hybrid option; decide from measured total cost and operational load.

## 5. Comparison

| Dimension | Single VPS | Hybrid | Fully managed |
|---|---|---|---|
| Lowest cash cost | Best | Medium | Highest |
| Operator burden | Highest | Medium | Lowest infrastructure burden |
| Failure isolation | Poor | Good with two app nodes/managed DB | Good when correctly configured |
| Scaling | Manual vertical | Horizontal app + managed DB | Platform scaling/managed runtime |
| Database operations | Self-managed | Managed | Managed |
| Fit for controlled pilot | Conditional | **Recommended** | Recommended if budget allows |
| Fit for national production | No | Candidate after gates | Candidate after gates |

## 6. Staging budget

A production-shaped staging environment should not share production data or secrets. A practical starting allowance is USD 75–150/month (approximately Rp1,24–2,48 juta) for app, managed PostgreSQL, object storage, monitoring and provider sandboxes. It may scale to zero or smaller resources when not testing only if restore/load/failover rehearsals remain representative.

No production architecture decision should be based on the current free local database or workstation cost.

## 7. Scaling stages and triggers

| Stage | Architecture | Evidence-based trigger to advance |
|---|---|---|
| S0 Local | Current local PostgreSQL/files | Planning/development only |
| S1 Staging | Managed DB/storage + one app/worker | Providers, migrations, RLS roles, backup and UAT verified |
| S2 Pilot | Hybrid or PaaS, isolated production-like environment | Pilot approval; SLO/RPO/RTO and support owner accepted |
| S3 Commercial | Two app instances, LB, managed DB/PITR, independent workers | Paying-customer launch and failover/restore/security gates pass |
| S4 National growth | Autoscale, cache/search projection, pooler, DB scale/replica | Sustained p95/CPU/IOPS/connections/queue lag reach approved thresholds |
| S5 High availability | Multi-zone/provider-specific HA, tested recovery | Contractual SLO/enterprise need justifies cost |

Suggested investigation thresholds, not automatic purchases: p95 > 1.5 s for 15 minutes, DB connections >70%, CPU >70%, memory >75%, job lag >60 s, or cache hit <70% under representative traffic. Confirm root cause before scaling.

## 8. Mandatory controls regardless of option

- separate staging/production accounts, networks, buckets and secrets;
- non-owner/NOBYPASSRLS runtime database role; separate migration and backup roles;
- TLS, firewall, least privilege, secret rotation and no public database;
- PITR plus encrypted logical backup and object-version restore drill;
- public/private/quarantine storage with scanner and checksum inventory;
- health/readiness, metrics, logs, alert delivery and on-call owner;
- spending alerts and hard/soft usage controls;
- dependency/build provenance, rollback/canary and tested migration runbook;
- privacy/DPA/data residency review and incident-response process.

## 9. Cost risks

- live match polling and media delivery can drive egress/request cost;
- database HA can approximately multiply node cost;
- logs/metrics often exceed compute cost if retention/cardinality is uncontrolled;
- malware scanning, email, support and payment fees are not in base estimates;
- backups in the same provider/account are an incomplete failure-domain strategy;
- tax and USD/IDR movement require contingency;
- “free tier” is not a production availability or support commitment.

## 10. Recommended decision path

1. Approve an SLO/RPO/RTO and monthly staging ceiling.
2. Evaluate Hybrid and Fully Managed in isolated staging using the same production build.
3. Run restore, failover, runtime-role/RLS, 1,000-viewer, write-heavy live-match and provider-outage tests.
4. Compare measured cost per competition, operator hours, latency and recovery outcome.
5. Select the pilot topology; do not purchase production resources until the owner approves the release gate.

## 11. Owner decisions required

1. Monthly staging and pilot budget ceilings, plus FX/tax contingency.
2. Region/data residency and approved provider shortlist.
3. Target availability, RPO/RTO, retention and support hours.
4. Hybrid operational ownership versus PaaS premium.
5. Vendor/DPA/IAM approval for database, storage, scanner, email, observability and payment sandbox.

No account, paid service, billing method or infrastructure was created. Production remains **NO-GO**.
