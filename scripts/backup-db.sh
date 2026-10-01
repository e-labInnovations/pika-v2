#!/usr/bin/env bash
#
# Nightly database backup for the production server. Meant for cron:
#
#   30 2 * * * /www/wwwroot/pika.elabins.com/app/backup-db.sh >> /www/wwwroot/pika.elabins.com/app/shared/logs/backup.log 2>&1
#
# What it does:
#   1. pg_dump (custom format, compressed) of DATABASE_URL from shared/.env
#   2. checks the dump is readable (pg_restore --list) before keeping it
#   3. keeps the newest BACKUP_KEEP dumps in shared/backups/, deletes older ones
#   4. optionally sends an encrypted copy off the box to Telegram
#
# Restore:
#   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" shared/backups/<file>.dump
#   (an encrypted Telegram copy first: openssl enc -d -aes-256-cbc -pbkdf2 -in <file>.enc -out <file>.dump)
#
# Off-box copy (optional). Put these in shared/backup.env, chmod 600:
#   BACKUP_TELEGRAM_TOKEN=...      bot token
#   BACKUP_TELEGRAM_CHAT=...       chat id
#   BACKUP_TELEGRAM_THREAD=...     topic id (optional)
#   BACKUP_PASSPHRASE=...          required: the dump is encrypted before upload
# Without BACKUP_PASSPHRASE nothing is uploaded; plaintext dumps never leave the server.
#
# Overridable: DEPLOY_ROOT, BACKUP_KEEP.

set -euo pipefail

ROOT="${DEPLOY_ROOT:-/www/wwwroot/pika.elabins.com/app}"
KEEP="${BACKUP_KEEP:-14}"
DIR="$ROOT/shared/backups"
TELEGRAM_MAX_BYTES=$((49 * 1024 * 1024))

die() { printf '%s error: %s\n' "$(date -Is)" "$*" >&2; exit 1; }
log() { printf '%s %s\n' "$(date -Is)" "$*"; }

for bin in pg_dump pg_restore; do
  command -v "$bin" >/dev/null || die "$bin is not installed"
done

# Read only the one line we need instead of sourcing the whole app .env.
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/shared/.env" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g')"
[ -n "$DATABASE_URL" ] || die "DATABASE_URL not found in $ROOT/shared/.env"

[ -f "$ROOT/shared/backup.env" ] && . "$ROOT/shared/backup.env"

umask 077
mkdir -p "$DIR"
FILE="$DIR/pika-$(date +%Y-%m-%dT%H%M).dump"
TMP="$FILE.partial"
trap 'rm -f "$TMP" "$FILE.enc"' EXIT

log "dumping to $FILE"
pg_dump --format=custom --compress=9 --no-owner --no-acl "$DATABASE_URL" -f "$TMP"
pg_restore --list "$TMP" >/dev/null || die "dump is not readable, keeping the previous backups"
mv "$TMP" "$FILE"
log "ok, $(du -h "$FILE" | cut -f1)"

# Prune: newest $KEEP stay.
ls -1t "$DIR"/pika-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  log "pruning $(basename "$old")"
  rm -f "$old"
done

if [ -n "${BACKUP_TELEGRAM_TOKEN:-}" ] && [ -n "${BACKUP_TELEGRAM_CHAT:-}" ]; then
  [ -n "${BACKUP_PASSPHRASE:-}" ] || die "BACKUP_PASSPHRASE is not set; refusing to upload an unencrypted dump"
  command -v openssl >/dev/null || die "openssl is not installed"
  command -v curl >/dev/null || die "curl is not installed"

  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$FILE" -out "$FILE.enc"
  size=$(wc -c <"$FILE.enc")
  if [ "$size" -gt "$TELEGRAM_MAX_BYTES" ]; then
    log "encrypted dump is $size bytes, over Telegram's bot upload limit; skipped upload"
  else
    curl -fsS "https://api.telegram.org/bot${BACKUP_TELEGRAM_TOKEN}/sendDocument" \
      -F chat_id="$BACKUP_TELEGRAM_CHAT" \
      ${BACKUP_TELEGRAM_THREAD:+-F message_thread_id="$BACKUP_TELEGRAM_THREAD"} \
      -F caption="pika db backup $(basename "$FILE") (aes-256-cbc, pbkdf2)" \
      -F document=@"$FILE.enc;filename=$(basename "$FILE").enc" >/dev/null
    log "uploaded encrypted copy to Telegram"
  fi
fi
