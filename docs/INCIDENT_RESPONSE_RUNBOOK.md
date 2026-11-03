# Incident Response Runbook

Status: local procedure draft; on-call contacts and external providers require owner approval.

## Severity

- SEV-1: confirmed cross-tenant/PII exposure, unauthorized score/result publication, credential compromise, unrecoverable outage/data loss.
- SEV-2: major registration/scoring failure, provider/storage/scanner outage with no safe path, backup/restore failure.
- SEV-3: degraded latency/backlog, isolated workflow error, non-sensitive UI regression.

## Flow

1. **Detect:** health/readiness, metrics, alert, audit anomaly, user report.
2. **Triage:** assign incident ID/severity/commander; record release SHA and affected tenant without copying PII.
3. **Contain:** freeze relevant mutations/publication, revoke assignment/session/token, isolate provider or tenant. Do not disable RLS/security checks to restore service.
4. **Preserve:** protect immutable audit references, redacted logs, database/provider event IDs, backup checksum, and timeline.
5. **Recover:** use idempotent replay, compatible app rollback, correct-forward migration, or isolated restore according to approved runbook.
6. **Verify:** RLS/security regression, integrity/orphan queries, publication/privacy checks, health and synthetic smoke.
7. **Communicate:** owner/legal decides participant/regulator notification; never improvise disclosure.
8. **Review:** root cause, blast radius, missed detection, action owner/deadline, evidence retention, and control update.

## Specialized playbooks

- Cross-tenant exposure: disable affected surface, preserve access audit, rotate exposed tokens, test all tenant boundaries before reopen.
- Score manipulation: lock publication, revoke judge assignment, compare score/history/audit, reopen only through audited workflow.
- Registration abuse: tighten existing rate-limit/config, preserve aggregate fingerprints, avoid logging contact/guardian fields.
- Malware/storage outage: uploads remain quarantine/fail-closed; never publish unscanned objects.
- Migration failure: stop writes, do not edit migration history, capture status/log, restore to new DB or correct-forward after approval.
- Privacy request incident: verify requester/tenant, apply legal hold, avoid automatic erasure, record human decision.

## Required evidence and exit

Timeline, incident commander, severity, affected release/tenant count, detection source, containment/recovery actions, data-integrity proof, security test results, communications decision, and postmortem approval. Service exits incident mode only after owner/security sign-off. Staging must rehearse at least database outage, provider timeout, unauthorized publication, and restore before organizer pilot.
