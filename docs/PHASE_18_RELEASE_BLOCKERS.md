# Phase 18 Release Blockers

Phase 17 memenuhi local technical scope, tetapi production tetap **NO-GO**.

## P0 sebelum staging pilot

1. Bangun staging terisolasi dengan runtime DB role NOBYPASSRLS, managed secret, TLS, backup/PITR, dan restore drill.
2. **Local complete:** full 25-step competition UAT dan concurrent operator fixture lulus. Ulangi bukti yang sama pada database staging disposable.
3. **Emulator complete:** S3-compatible object backup/restore dan signature quarantine lulus. Jalankan ulang pada object storage staging dan service ClamAV nyata.
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

## Closure lokal 14 Oktober 2026

- 74 unit, 85 integration tanpa skip, 50 E2E desktop/mobile, TypeScript, ESLint, dan production build lulus.
- Environment staging/production sekarang fail-closed bila release identity, metrics, email sandbox, alert webhook, S3-compatible storage, atau ClamAV belum dikonfigurasi.
- Liveness endpoint mengekspos environment, version, dan commit pendek tanpa secret.
- Provider/account/budget, TLS/DNS publik, managed PostgreSQL/PITR, immutable audit sink, on-call, legal/privacy, dan independent security review tetap memerlukan keputusan serta kredensial pemilik.
