#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
case "$BACKUP_DIR" in ""|/|"$HOME") echo "Unsafe BACKUP_DIR" >&2; exit 2;; esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
pg_database_url="${DATABASE_URL%%\?schema=*}"
mkdir -p "$BACKUP_DIR"
database_dump="$BACKUP_DIR/database-$timestamp.dump"
encrypted_dump="$database_dump.enc"
pg_dump --format=custom --no-owner --no-acl --file="$database_dump" "$pg_database_url"
openssl enc -aes-256-cbc -salt -pbkdf2 -in "$database_dump" -out "$encrypted_dump" -pass env:BACKUP_ENCRYPTION_KEY
rm "$database_dump"
if command -v sha256sum >/dev/null 2>&1; then sha256sum "$encrypted_dump" > "$encrypted_dump.sha256"; else shasum -a 256 "$encrypted_dump" > "$encrypted_dump.sha256"; fi
echo "Encrypted backup created: $encrypted_dump"
