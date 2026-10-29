#!/usr/bin/env bash
# Usage: bash scripts/backup.sh
# MONGODB_URI must be a SERVER-ONLY URI (no database path).
# Selected-database logical backup: pause application writes for a consistent snapshot.
# For a live replica-set backup, use a FULL mongodump --oplog or filesystem/cloud snapshots.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017}"
DATABASE="${MONGODB_DATABASE:-student_management}"
DEST="${BACKUP_DIR:-$ROOT/backups}"
[[ "$DATABASE" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid database name." >&2; exit 1; }
for tool in mongosh mongodump; do command -v "$tool" >/dev/null || { echo "Install MongoDB Database Tools and mongosh first." >&2; exit 1; }; done
if command -v sha256sum >/dev/null; then CHECKSUM=(sha256sum); elif command -v shasum >/dev/null; then CHECKSUM=(shasum -a 256); else echo "sha256sum or shasum is required." >&2; exit 1; fi
mkdir -p "$DEST"
WORK="$(mktemp -d "$DEST/.${DATABASE}.XXXXXX")"
trap 'rm -rf -- "$WORK"' EXIT
ARCHIVE="$WORK/$DATABASE.archive.gz"
TOPOLOGY="$(mongosh "$URI" --quiet --eval 'const h=db.getSiblingDB("admin").runCommand({hello:1}); print(h.setName ? "replica" : (h.msg === "isdbgrid" ? "sharded" : "standalone"));')"
ARGS=(--uri="$URI" --db "$DATABASE" --archive="$ARCHIVE" --gzip --numParallelCollections=1)
OPLOG=false
case "$TOPOLOGY" in
  replica|standalone) echo "NOTICE: pause application writes during this selected-database dump for snapshot consistency." ;;
  *) echo "This script supports standalone and replica-set deployments only." >&2; exit 1 ;;
esac
mongodump "${ARGS[@]}"
(cd "$WORK" && "${CHECKSUM[@]}" "$DATABASE.archive.gz" > SHA256SUMS)
CREATED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
TOOL_VERSION="$(mongodump --version | head -1 | tr -d '\"')"
cat > "$WORK/manifest.json" <<EOF
{
  "database": "$DATABASE",
  "createdAt": "$CREATED",
  "topology": "$TOPOLOGY",
  "oplog": $OPLOG,
  "archive": "$DATABASE.archive.gz",
  "toolVersion": "$TOOL_VERSION"
}
EOF
FINAL="$DEST/$DATABASE-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mv -- "$WORK" "$FINAL"
trap - EXIT
printf 'Backup complete: %s\nKeep a second encrypted copy off this host and test restoration regularly.\n' "$FINAL"
