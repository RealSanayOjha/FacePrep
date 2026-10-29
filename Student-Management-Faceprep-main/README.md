# Campus Registry — Student Management System

A complete final-project application built with **Java 17, Spring Boot, Maven, MongoDB**, and a plain **HTML/CSS/JavaScript** frontend. It runs directly on macOS/Linux/Windows—**Docker is not required and Docker deployment files are not included**.

## Features

- Student CRUD API with validation and consistent JSON errors
- Unique email and student-code constraints enforced by MongoDB indexes
- Search, course/status/year filters, sorting, and bounded pagination
- Aggregation-based dashboard statistics
- Responsive frontend with add/edit dialogs and delete confirmation
- MongoDB index migration, query examples, and performance benchmark
- Separate replica-set setup guide, backup/restore scripts, and restore-drill instructions
- Unit/controller tests, real-MongoDB integration tests, and HTTP/browser smoke scripts
- Final project report, API reference, operations guide, screenshots, and verification evidence

## Run on a Mac (no Docker)

### 1. Install Java 17 and MongoDB 8

With Homebrew:

```bash
brew install --cask temurin@17
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb-community@8.0
```

Verify both are available:

```bash
java -version       # should show 17
mongod --version    # should show MongoDB 8
```

If the `temurin@17` cask is unavailable in your Homebrew setup, install a JDK 17 distribution such as Eclipse Temurin 17 from Adoptium and open a new Terminal window.

### 2. Start the app

Open Terminal in the extracted `student-management` project folder:

```bash
chmod +x mvnw
./mvnw spring-boot:run
```

The first build downloads Maven dependencies. Then open **http://localhost:8080**. The app connects to `mongodb://127.0.0.1:27017/student_management` and inserts 12 fictional sample students if the collection is empty.

To stop the app, press **Ctrl+C** in the Terminal running it. MongoDB is managed separately by Homebrew:

```bash
brew services stop mongodb-community@8.0
brew services start mongodb-community@8.0
```

### 3. Build a standalone JAR (optional)

```bash
./mvnw clean package
java -jar target/student-management-1.0.0.jar
```

If port 8080 is already in use, run with another port:

```bash
PORT=8082 java -jar target/student-management-1.0.0.jar
```

Then visit `http://localhost:8082`.

## Tests (no Docker)

Unit and controller tests do not need MongoDB:

```bash
./mvnw test
```

Real-MongoDB integration tests require a locally running MongoDB. The test suite uses and clears only the dedicated `student_management_it` database:

```bash
./mvnw verify -Pintegration
```

The database must end with `_it` or `_test`; never point integration tests at your real application database.

HTTP smoke test (with the app running in another terminal):

```bash
bash scripts/smoke-test.sh
```

Optional browser workflow test:

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/browser-smoke.cjs
```

## MongoDB tools (optional)

The app itself needs a running MongoDB server, but not `mongosh` or the Database Tools. Install `mongosh`, `mongodump`, and `mongorestore` only if you want to run the index migration manually or use the backup/restore scripts. Development startup creates indexes automatically.

## Optional: try the replication setup

The regular app uses a single local MongoDB instance. For the replication demonstration, follow the **native MongoDB process** instructions in [Operations](docs/OPERATIONS.md); it starts three local `mongod` processes and does not use Docker.

## API at a glance

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/students` | Create a student |
| GET | `/api/students` | List/search/filter with pagination |
| GET | `/api/students/{id}` | Read one student |
| PUT | `/api/students/{id}` | Replace editable student fields |
| DELETE | `/api/students/{id}` | Delete a student |
| GET | `/api/dashboard/stats` | Aggregated totals and course counts |
| GET | `/actuator/health` | Health/readiness probe |

Full examples: [docs/API.md](docs/API.md).

## Project structure

```text
student-management/
├── src/main/java/com/example/students/   # Spring Boot application
├── src/main/resources/static/             # HTML, CSS, JavaScript frontend
├── src/test/java/                        # unit, controller, MongoDB integration tests
├── database/                             # index migration, queries, replica init, benchmark
├── scripts/                              # backup, restore, API/browser smoke tests
├── docs/                                 # report, API, operations, evidence, screenshots
├── mvnw, mvnw.cmd                        # Maven wrapper
└── pom.xml
```

## Verification performed

- **22 unit/controller tests + 16 real-MongoDB integration tests passed**.
- Browser workflow passed on desktop/mobile: CRUD, duplicate validation, search, filters, pagination.
- Standalone backup restored to an isolated MongoDB instance: **12 records and 9 indexes** verified.
- Three-node native replica set verified: majority write, secondary read, election/failover, rejoin, and Spring Boot CRUD.
- Replica backup/restore and full-instance oplog backup/restore were verified on an isolated test replica.
- 20,000-document benchmark showed email lookup changing from `COLLSCAN` to `EXPRESS_IXSCAN` and filtered listing changing from `COLLSCAN + SORT` to an indexed query plan. See [performance results](docs/performance-results.json).

## Documentation

- [Final project report](docs/FINAL_REPORT.md) and [Word report](docs/FINAL_REPORT.docx)
- [API reference](docs/API.md)
- [Operations, local replica set, indexes, backup/restore, security](docs/OPERATIONS.md)
- [Verification evidence](docs/verification/)
