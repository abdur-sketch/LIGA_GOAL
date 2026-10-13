# Pilot Launch Runbook — Phase 18

Status: planning only; no real organizer invited and nothing published.

## Pilot shape

- One organizer, one competition, one active season.
- 8 clubs, target 160–200 players, 28 round-robin matches or owner-approved smaller schedule.
- Roles: organizer owner, competition admin, registration officer, scheduler, two match operators per live match, result approver, platform support/moderator.
- Synthetic rehearsal mirrors this shape before any real data import.

## Timeline

### T-21 to T-14

- Owner approves budget, provider shortlist, region, DPA, retention, SLO/RPO/RTO, support hours, and pilot organizer.
- Provision isolated staging; configure DNS/TLS, managed DB roles, buckets, scanner, email/payment sandbox, monitoring, alert route, and backups.
- Restore synthetic data and pass Gates A–E.

### T-14 to T-7

- Train organizer on membership, club/player registration, privacy, fixture generation, match operation, result approval, moderation, and support escalation.
- Rehearse complete competition, backup restore, provider outage, lost-device/session revoke, duplicate webhook, and match-operator conflict.
- Collect UAT acceptance and unresolved issue list.

### T-7 to T-1

- Freeze release candidate and migration manifest.
- Run E2E/RLS/load/security/provider UAT on staging.
- Verify roster consent and minor-data handling; import only minimum approved pilot data.
- Publish support roster, incident channel, on-call contacts, status template, and rollback decision owner.

### Pilot day

- T-120 min: readiness, DB/queue/storage/email/alert/backup-age checks.
- T-60 min: organizer and officials confirm access; no shared accounts.
- Each match: primary/backup operator, clock/event validation, approver, realtime/public sanity check.
- On severity 1: stop affected writes/publication, preserve audit evidence, communicate status, invoke incident commander; do not improvise destructive database action.

### T+1 to T+7

- Reconcile results/statistics/billing sandbox/audit, sample private/public DTO, review incidents and support load.
- Export feedback, define fixes, and decide continue/pause. Pilot success does not automatically authorize commercial production.

## Success metrics

- 100% scheduled matches recorded and approved; zero cross-tenant/privacy incident.
- Public result/standings freshness within approved SLO; zero duplicate official events.
- Registration correction rate, organizer task completion, support response time, alert delivery, backup success, and restore objective measured.
- At least one restore drill and one provider-outage exercise PASS before real pilot.

## Rollback and recovery

- Prefer forward-fix for additive migrations.
- Feature/publication can be suspended without deleting competition history.
- Preserve financial/audit/event records; never roll them back by manual delete.
- Database recovery uses verified PITR/logical backup into an isolated target first; object versions must match database references.
- Pilot cancellation, user communication, retention, and deletion requests are owned by named operational/privacy owners.

## Required approvals

Budget/provider, technical release, database migration, security, privacy/legal, organizer UAT, support/on-call, incident response, and final pilot approval. All remain pending.
