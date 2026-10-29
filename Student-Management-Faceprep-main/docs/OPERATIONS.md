# Operations Guide — Docker-free local deployment

The normal installation runs the Spring Boot application and MongoDB directly on your Mac. **Docker is not required; Docker deployment files have been removed.** The standard development mode uses one MongoDB process. A separate, optional section shows how to launch a three-member local replica set with native `mongod` processes.

## 1. Install and start on macOS

Install Java 17 and MongoDB 8 with Homebrew:

```bash
brew install --cask temurin@17
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb-community@8.0
```

Check the installs:

```bash
java -version
mongod --version
```

From the project directory, launch the app:

```bash
chmod +x mvnw
./mvnw spring-boot:run
```

Open **http://localhost:8080**. Stop the app with Ctrl+C. The MongoDB service runs independently; stop/start it with:

```bash
brew services stop mongodb-community@8.0
brew services start mongodb-community@8.0
```

The app connects to the local database `student_management`, creates its indexes at startup, and inserts 12 fictional demo students only when the collection is empty. The app does not require mongosh or MongoDB Database Tools to run.

Build and run the executable JAR instead:

```bash
./mvnw clean package
java -jar target/student-management-1.0.0.jar
```

To change the port:

```bash
PORT=8082 java -jar target/student-management-1.0.0.jar
```

## 2. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/student_management?...` | Application MongoDB connection string, including database |
| `PORT` | `8080` | Application HTTP port |
| `MONGO_AUTO_INDEX` | `true` in development, `false` in `prod` profile | Create indexes at startup |
| `SEED_DEMO_DATA` | `true` in development, `false` in `prod` profile | Insert fictional students only into an empty collection |
| `SPRING_PROFILES_ACTIVE` | none | Set `prod` for controlled index/seed behavior |
| `MONGODB_DATABASE` | `student_management` | Database used by backup/restore scripts |
| `BACKUP_DIR` | `./backups` | Backup script output directory |

For backup/restore scripts, `MONGODB_URI` is server-only, without a database path: `mongodb://127.0.0.1:27017`. For the application, the URI includes the database name.

Never commit real credentials. Use environment variables or a secret manager.

## 3. Index strategy

Development startup creates indexes automatically. To run the idempotent migration manually, install `mongosh` and run:

```bash
mongosh "mongodb://127.0.0.1:27017/student_management" database/indexes.js
```

| Index | Supports |
|---|---|
| `uq_students_email` | Unique normalized email; exact lookup |
| `uq_students_code` | Unique normalized student code |
| `idx_course_status_year_created` | Course/status/year equality filters plus newest-first sort |
| `idx_status_created` | Status filter plus newest-first sort |
| `idx_created` | Default newest-first listing |
| `idx_name` | Name sorting with stable tie-breaker |
| `idx_year_created` | Year filter plus newest-first sort |
| `txt_students_search` | One weighted text index across code, names, email, course |

Design notes:

- Equality fields precede sort fields in the compound index, following the equality-sort-range guideline.
- `_id` is included as a final deterministic tie-breaker.
- MongoDB permits only one text index per collection; searchable fields are combined in it.
- Text search uses `default_language: "none"` to avoid stemming names/identifiers.
- Indexes accelerate reads but consume memory and add write overhead. Remove unused indexes only after checking workload evidence.
- The `prod` profile disables startup index creation; apply the migration as a controlled deployment step instead.
- Pagination is bounded to offset 10000. For very large datasets, consider range/keyset pagination.

Inspect query examples:

```bash
mongosh "mongodb://127.0.0.1:27017/student_management" database/queries.js
```

Run the isolated 20,000-document benchmark:

```bash
mongosh "mongodb://127.0.0.1:27017" database/performance-lab.js
```

It uses `student_management_benchmark`, not the application database, and drops its benchmark collection afterward.

Measured local results (MongoDB 8.0.34, warm cache, 20,000 documents):

| Query | Before indexes | After indexes |
|---|---|---|
| Exact email | `COLLSCAN`, 20,000 docs examined, ~8.875 ms avg | `EXPRESS_IXSCAN`, 1 doc examined, ~1.625 ms avg |
| Course + status + year, newest 10 | `COLLSCAN + SORT`, 20,000 docs examined, ~10.425 ms avg | `IXSCAN + FETCH + LIMIT`, 10 docs examined, ~1.425 ms avg |

These are educational measurements on one local machine, not production capacity guarantees.

## 4. Optional three-node replica set (native MongoDB)

The standard app uses one local MongoDB process and is the lightest setup. Only run this optional drill if you specifically need to demonstrate replica-set behavior. Three MongoDB processes need more memory and disk than the regular standalone setup. Stop the normal app first so port 8080 is free.

These commands assume Homebrew MongoDB installed `mongod` and `mongosh` on your PATH. In Terminal:

```bash
mkdir -p "$HOME/mongo-rs/node1" "$HOME/mongo-rs/node2" "$HOME/mongo-rs/node3" "$HOME/mongo-rs/logs"

mongod --replSet rs0 --bind_ip localhost --port 27021 \
  --dbpath "$HOME/mongo-rs/node1" --fork --logpath "$HOME/mongo-rs/logs/node1.log"
mongod --replSet rs0 --bind_ip localhost --port 27022 \
  --dbpath "$HOME/mongo-rs/node2" --fork --logpath "$HOME/mongo-rs/logs/node2.log"
mongod --replSet rs0 --bind_ip localhost --port 27023 \
  --dbpath "$HOME/mongo-rs/node3" --fork --logpath "$HOME/mongo-rs/logs/node3.log"
```

Initialize the set (only once for these data directories):

```bash
mongosh --host localhost --port 27021 --eval \
  'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27021",priority:3},{_id:1,host:"localhost:27022",priority:2},{_id:2,host:"localhost:27023",priority:1}]})'
```

Wait for a primary and verify:

```bash
mongosh "mongodb://localhost:27021,localhost:27022,localhost:27023/?replicaSet=rs0" \
  --eval 'rs.status().members.map(m => ({name:m.name,state:m.stateStr}))'
```

Start the app against the replica set (for example, from the project directory):

```bash
MONGODB_URI='mongodb://localhost:27021,localhost:27022,localhost:27023/student_management?replicaSet=rs0&retryWrites=true&w=majority&readConcernLevel=majority&readPreference=primary' \
./mvnw spring-boot:run
```

The app's automatic index initializer creates the database indexes. To observe an election, stop the member currently marked `PRIMARY` (in another Terminal, Ctrl+C only works if you started the process in the foreground; with `--fork`, use `mongosh` administrative shutdown or stop its process) and wait for a remaining member to be elected. Confirm writes and reads, then restart the stopped member. A higher-priority member may reclaim primary when it rejoins.

To shut down the three background `mongod` processes cleanly:

```bash
mongod --shutdown --dbpath "$HOME/mongo-rs/node1"
mongod --shutdown --dbpath "$HOME/mongo-rs/node2"
mongod --shutdown --dbpath "$HOME/mongo-rs/node3"
```

The application URI uses the replica-set name so the MongoDB driver can discover elections. Majority write concern acknowledges writes to a majority. Primary reads avoid stale secondary reads immediately after UI writes.

This is a local learning exercise, not production high availability. Production members should run on separate failure domains with authentication, TLS, secured networking, monitoring, and tested recovery.

Replication is **not a backup**: accidental deletes and bad application writes replicate to secondaries.

## 5. Backup strategy

The app itself does not need the MongoDB Database Tools. Install `mongosh` and the MongoDB Database Tools (`mongodump`, `mongorestore`) if you want manual migration or backup operations. On macOS Homebrew, these may be installed from the MongoDB tap:

```bash
brew install mongosh mongodb-database-tools
```

### A. Included selected-database script (quiesced)

`bash scripts/backup.sh` creates a compressed archive, SHA-256 checksum, and manifest. It backs up only `MONGODB_DATABASE`.

**Pause application writes before running it** so the selected-database dump is a consistent application snapshot. Stop the app with Ctrl+C first. The script does not use `--oplog` because MongoDB requires `--oplog` to be a full-instance dump.

```bash
MONGODB_URI="mongodb://127.0.0.1:27017" \
MONGODB_DATABASE=student_management \
bash scripts/backup.sh
```

The generated folder contains an archive, `SHA256SUMS`, and `manifest.json`. Keep an encrypted copy away from the database host and restrict file access.

### B. Live replica-set backup with oplog

For a replica set where writes continue, use a **full-instance** dump with `--oplog`, or use filesystem/cloud snapshots:

```bash
mongodump \
  --uri="mongodb://localhost:27021,localhost:27022,localhost:27023/?replicaSet=rs0" \
  --archive=backup-full.archive.gz --gzip --oplog
```

Restore an oplog archive to an isolated replica-set target:

```bash
mongorestore \
  --uri="mongodb://test1:27017,test2:27017,test3:27017/?replicaSet=rs0" \
  --archive=backup-full.archive.gz --gzip --drop --oplogReplay --stopOnError
```

A full-instance archive may contain more than the application database. Review its contents and target carefully.

### C. Restore drill

Always restore to a **separate test database/server** first. The included restore script requires explicit confirmation and drops collections contained in the archive.

```bash
MONGODB_URI="mongodb://127.0.0.1:27017" \
MONGODB_DATABASE=student_management \
bash scripts/restore.sh backups/student_management-<timestamp> --confirm RESTORE
```

Never point a restore drill at production. Verify counts, unique indexes, and application smoke tests before relying on the restored data.

### D. Suggested schedule and objectives

- Daily quiesced logical backup for this small project; more frequent snapshots/oplog-based protection for larger systems.
- Retain 7 daily, 4 weekly, and 12 monthly copies, adjusted to policy and storage.
- Monthly restore drill to an isolated environment.
- Example educational targets: RPO ≤ 24 hours with daily backups; RTO ≤ 2 hours after infrastructure is available.
- Monitor backup job exit status, checksum verification, age of last successful backup, and restore-drill results.

The scripts do not automatically delete old backups or upload them off-host; arrange those controls separately.

## 6. Security checklist before public deployment

The supplied project is intentionally simple and unauthenticated. Before handling real student data:

1. Add authentication and role-based authorization to the API; restrict create/update/delete to staff.
2. Enable MongoDB authentication, least-privilege users, and TLS; use keyfile/x.509 for replica-set internal authentication.
3. Keep MongoDB off the public Internet; restrict network/security groups.
4. Put the app behind HTTPS and a hardened reverse proxy; add rate limiting and request-size limits.
5. Store secrets outside source control; rotate credentials.
6. Encrypt backups and restrict access; define retention and deletion policies.
7. Add audit logging, monitoring, alerting, and privacy/consent controls appropriate to student records.
8. Patch Java, Spring Boot, MongoDB, and operating-system packages.
9. Test failure recovery and document incident procedures.

## 7. Troubleshooting

- **`Connection refused` / health DOWN:** ensure the Homebrew MongoDB service is running and `MONGODB_URI` points at the correct port.
- **Duplicate key error:** email and student code must be unique after normalization.
- **Text search finds nothing:** use whole words; text search is not substring matching.
- **Port 8080 in use:** stop the other app or run with `PORT=8082`.
- **Replica app cannot connect:** check all three `mongod` processes and the replica-set status/hostnames.
- **Index migration fails:** inspect existing index definitions; do not silently drop indexes.
- **Restore checksum fails:** do not restore a corrupted archive; use another backup copy.

## References

- MongoDB: Install MongoDB Community Edition on macOS — https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/
- MongoDB: Deploy a Self-Managed Replica Set — https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set/
- MongoDB: Back Up and Restore with MongoDB Tools — https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/
- MongoDB: mongodump — https://www.mongodb.com/docs/database-tools/mongodump/
- MongoDB: mongorestore — https://www.mongodb.com/docs/database-tools/mongorestore/
- Spring Boot Reference — https://docs.spring.io/spring-boot/
- Spring Data MongoDB — https://docs.spring.io/spring-data/mongodb/reference/
