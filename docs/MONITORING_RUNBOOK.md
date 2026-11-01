# Monitoring & Observability Runbook

Tanggal: 1 November 2026
Status: **lokal tersedia; provider staging/production BLOCKED**

## Surface

- Liveness: `/api/health/live`; proses hidup, tidak mengklaim database siap.
- Readiness: `/api/health/ready`; konektivitas/runtime dependency.
- Metrics: `/api/metrics`; wajib Bearer `METRICS_TOKEN`, `no-store`, tidak public.
- Internal status: `/admin/readiness`; memerlukan `platform.operations.view`.
- Structured log: JSON timestamp/level/event/context; key PII, contact, guardian, document, token, cookie, IP, dan identity direduksi. Error hanya name + fingerprint opaque.

Metrics utama: live match, failed jobs, pending notification, pending public registration, pending result approval, active judge assignment, pending privacy request, registration rejection lima menit, database connection/max connection, dan database size.

## Pemeriksaan operator

1. Pastikan liveness dan readiness HTTP 200 dari jaringan internal.
2. Ambil metrics dengan secret manager-injected token; jangan tempel token ke tiket/log.
3. Periksa failed/dead job, backlog notification/registration/approval/privacy, serta rasio koneksi DB.
4. Korelasikan fingerprint error dengan request/audit ID tanpa menyalin payload PII.
5. Untuk score anomaly atau akses data sensitif, bekukan publikasi yang relevan, pertahankan evidence, dan eskalasi security owner.

## Alert draft

| Event | Default lokal | Severity | Respons awal |
| --- | ---: | --- | --- |
| Database unavailable | sekali | critical | Hentikan mutation, cek pool/DB, aktifkan incident. |
| Failed jobs | > 0 | warning | Review retry/idempotency dan dead-letter. |
| Notification backlog | > 100 | warning | Cek provider/rate limit; jangan replay tanpa dedupe. |
| Registration rejects/5m | > 10 | warning | Cek abuse, regression, quota, provider. |
| Score anomaly/5m | > 0 | critical | Kunci publikasi; audit assignment dan history. |
| DB connection ratio | > 80% | critical | Kurangi traffic/job, cek leak/pool, jangan naikkan limit tanpa kapasitas. |
| Backup age | > 26 jam | critical | Tandai recovery gate FAIL/BLOCKED. |

Threshold di atas adalah default operasional lokal, bukan SLO produksi. Owner/SRE harus menyetujui traffic model, SLO, escalation window, dan paging policy di staging.

## Incident flow

`DETECT → TRIAGE → CONTAIN → RECOVER → VERIFY → REVIEW`. Catat waktu, severity, sistem/tenant terdampak, keputusan, evidence reference, dan owner. Jangan mencatat data peserta atau secret. Security/privacy incident memerlukan containment akses, preservation audit log, assessment notification, dan human/legal decision.

Provider alert saat ini fail-closed: tanpa `ALERT_WEBHOOK_URL` dan token, delivery berstatus blocked dan tidak dianggap berhasil. Sebelum staging pilot wajib ada dashboard, synthetic probe, pager/on-call, acknowledgement test, provider outage test, log retention/access review, dan incident drill.
