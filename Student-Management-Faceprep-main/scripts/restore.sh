#!/usr/bin/env bash
# DESTRUCTIVE: drops collections contained in the archive before restoring them.
# Usage: bash scripts/restore.sh backups/student_management-... --confirm RESTORE
# For a restore drill, point MONGODB_URI at a SEPARATE test deployment.
set -euo pipefail
if [[ $# -ne 3 || "$2" != "--confirm" || "$3" != "RESTORE" ]]; then
  echo "Usage: bash scripts/restore.sh <backup-directory> --confirm RESTORE" >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017}"
DATABASE="${MONGODB_DATABASE:-student_management}"
BACKUP="$(cd "$1" && pwd)"
[[ "$DATABASE" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid database name." >&2; exit 1; }
for tool in mongosh mongorestore; do command -v "$tool" >/dev/null || { echo "MongoDB tools are required." >&2; exit 1; }; done
[[ -f "$BACKUP/manifest.json" && -f "$BACKUP/SHA256SUMS" ]] || { echo "Invalid backup directory." >&2; exit 1; }
if command -v sha256sum >/dev/null; then CHECKSUM=(sha256sum); elif command -v shasum >/dev/null; then CHECKSUM=(shasum -a 256); else exit 1; fi
SOURCE_DB="$(sed -n 's/.*"database": "\([^"]*\)".*/\1/p' "$BACKUP/manifest.json")"
[[ "$SOURCE_DB" == "$DATABASE" ]] || { echo "MONGODB_DATABASE must match the backup database: $SOURCE_DB" >&2; exit 1; }
ARCHIVE="$BACKUP/$DATABASE.archive.gz"
[[ -f "$ARCHIVE" ]] || { echo "Archive is missing." >&2; exit 1; }
(cd "$BACKUP" && "${CHECKSUM[@]}" -c SHA256SUMS)
OPLOG=false
if grep -q '"oplog": true' "$BACKUP/manifest.json"; then OPLOG=true; fi
TOPOLOGY="$(mongosh "$URI" --quiet --eval 'const h=db.getSiblingDB("admin").runCommand({hello:1}); print(h.setName ? "replica" : (h.msg === "isdbgrid" ? "sharded" : "standalone"));')"
if [[ "$OPLOG" == true && "$TOPOLOGY" != replica ]]; then
  echo "An oplog backup must be restored to a replica set, not a standalone server." >&2
  exit 1
fi
if [[ "$TOPOLOGY" != standalone && "$TOPOLOGY" != replica ]]; then echo "Unsupported target topology." >&2; exit 1; fi
printf 'WARNING: restoring %s to the server in MONGODB_URI.\nCollections in this archive will be dropped. Stop application writes first.\n' "$DATABASE"
ARGS=(--uri="$URI" --archive="$ARCHIVE" --gzip --drop --stopOnError --numInsertionWorkersPerCollection=1)
if [[ "$OPLOG" == true ]]; then ARGS+=(--oplogReplay); fi
mongorestore "${ARGS[@]}"
mongosh "$URI" --quiet --eval "const d=db.getSiblingDB('$DATABASE'); const counts={}; d.getCollectionNames().forEach(c=>counts[c]=d.getCollection(c).countDocuments()); printjson({database:d.getName(),collections:counts,studentIndexes:d.getCollectionNames().includes('students')?d.students.getIndexes().map(i=>i.name):[]});"
echo "Restore completed. Run application smoke tests before resuming traffic."
