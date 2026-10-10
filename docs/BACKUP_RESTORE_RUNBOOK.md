# Backup and Restore Runbook

PROJECT: LIGA GOAL  
PHASE: 8

## Targets

- Initial database RPO: 24 hours; target after pilot validation: 1 hour using managed PITR/WAL archiving.
- Initial RTO: 4 hours for database plus storage recovery.
- Retention proposal: 7 daily, 4 weekly, 12 monthly encrypted backups. Provider-side immutability and deletion protection are required before launch.

## Database backup

Run from an access-controlled job runner; secrets must come from its secret manager, never source control:

```bash
DATABASE_URL='postgresql://…' \
BACKUP_DIR='/approved/backup/path' \
BACKUP_ENCRYPTION_KEY='from-secret-manager' \
./scripts/backup.sh
```

The script creates a custom-format pg_dump, encrypts it using AES-256-CBC/PBKDF2, removes plaintext and writes a SHA-256 manifest. Restrict the directory and backup IAM principal. Copy to a separate failure domain only after provider approval.

## Isolated restore drill

Create a new empty database whose name contains `test`, `restore`, or `drill`, verify it is not production, then run:

```bash
RESTORE_DATABASE_URL='postgresql://…/liga_goal_restore_drill' \
BACKUP_FILE='/approved/backup/file.dump.enc' \
BACKUP_ENCRYPTION_KEY='from-secret-manager' \
CONFIRM_ISOLATED_RESTORE=YES \
./scripts/restore-drill.sh
```

After restore, validate migrations and counts for users, organizations, competitions, clubs, players, registrations, fixtures, events, official results, standings, transfers, disciplinary data and private-document references. Run smoke and authorization tests before cutover.

## Drill evidence (2026-10-10)

- Source: isolated `liga_goal_phase7_fresh`.
- Backup: `/tmp/liga-goal-phase8-backup-drill/database-20261010T013253Z.dump.enc` (ephemeral local evidence, not a retained production backup).
- Restore target: `liga_goal_phase8_restore_drill_20261010`.
- Result: PASS; 17 migrations, 13 users, 25 organizations, 18 competitions, 20 clubs, 21 players, 17 matches and 20 events verified.

## Object storage and disaster recovery

**BLOCKED:** local upload folders are not a production backup architecture. Before launch, select an approved object provider, enable private versioned buckets, cross-region or separate-account replication as required, lifecycle/retention locks, encrypted inventory, restore sampling, and documented orphan reconciliation. A database restore without matching object versions is not a complete recovery.

Rollback uses a forward-fix migration by default. Before a risky release, take a verified backup, record the application version and migration boundary, and rehearse restoring both database and objects into an isolated environment. Never run the restore script against an ambiguously named target.
