#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
: "${CONFIRM_ISOLATED_RESTORE:?Set CONFIRM_ISOLATED_RESTORE=YES after verifying the target}"
[[ "$CONFIRM_ISOLATED_RESTORE" == "YES" ]] || { echo "Restore confirmation missing" >&2; exit 2; }
[[ "$RESTORE_DATABASE_URL" =~ (test|restore|drill) ]] || { echo "Target name must contain test, restore, or drill" >&2; exit 2; }

temporary_dump="$(mktemp "${TMPDIR:-/tmp}/liga-goal-restore.XXXXXX.dump")"
pg_restore_url="${RESTORE_DATABASE_URL%%\?schema=*}"
trap 'rm -f "$temporary_dump"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP_FILE" -out "$temporary_dump" -pass env:BACKUP_ENCRYPTION_KEY
pg_restore --exit-on-error --no-owner --no-acl --clean --if-exists --dbname="$pg_restore_url" "$temporary_dump"
psql "$pg_restore_url" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS migrations FROM "_prisma_migrations";'
echo "Isolated restore drill completed."
