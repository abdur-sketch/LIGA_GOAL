# Phase 18 Release Blockers

Phase 17 memenuhi local technical scope, tetapi production tetap **NO-GO**.

## P0 sebelum staging pilot

1. Bangun staging terisolasi dengan runtime DB role NOBYPASSRLS, managed secret, TLS, backup/PITR, dan restore drill.
2. Jalankan full 25-step competition UAT serta concurrent operator fixture pada database disposable.
3. Jalankan S3-compatible emulator tests lalu staging object storage restore/malware workflow.
4. Security review independen: platform grant escalation, public insert abuse, IDOR, CSRF/session, audit tampering, webhook replay, dan log redaction.
5. Tetapkan appeal SLA, segregation of duties, dan notification sandbox; UI review dasar sudah tersedia.
6. Definisikan legal retention/deletion untuk report contact, evidence verification, notes, appeals, dan audit.
7. Uji search pada 100k/1m projections, deep pagination, pooled connections, latency jaringan, dan failure injection. Pertimbangkan cursor/keyset.
8. Tambahkan durable outbox worker monitoring, alert routing, runbook on-call, dan immutable/off-platform audit sink.

## P1 sebelum commercial validation

- Provider sandbox integration untuk email, storage, dan payment; tidak boleh memakai live key.
- Reconciliation/chargeback/refund operational UAT dengan finance segregation.
- Organizer verification evidence vault, purpose-limited access, reviewer access audit, dan malware scanning.
- Abuse deduplication/spam scoring yang explainable; jangan membuat keputusan suspension otomatis.
- Tenant export/offboarding, data retention clock, legal hold, dan deletion approval workflow.
- Capacity budget serta SLO nasional untuk search, match live, jobs, notification, DB saturation, dan storage.

## Owner decisions required

- Legal/privacy owner: evidence dan reporter-contact retention.
- Trust & Safety owner: verification criteria, moderation matrix, appeal SLA.
- Security owner: staging controls, audit sink, secret/provider review.
- Product/commercial owner: pilot cohort dan support coverage.
- Finance owner: sandbox-to-live gateway acceptance dan reconciliation responsibility.
- Infrastructure owner: deployment topology dan scaling thresholds.

Tidak ada blocker di atas yang boleh dianggap terselesaikan hanya dari hasil benchmark lokal.
