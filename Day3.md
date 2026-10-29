# MongoDB Replication, Backup & Recovery, and Student Management Project

These notes use MongoDB Shell (`mongosh`) syntax. Run practice commands in a test database before applying them to production.

---

# 1. Replication and the Oplog

## What is replication?

Replication keeps copies of data on multiple MongoDB servers in a **replica set**. A typical replica set contains:

- **Primary:** receives writes from clients.
- **Secondary:** replicates changes from the primary and may serve eligible reads.
- **Arbiter (optional):** votes in elections but does not store data.

If the primary becomes unavailable, eligible members can elect a new primary. Replication improves availability, but it is not a substitute for backups: accidental deletes and unwanted updates can also replicate.

## What is the oplog?

The **oplog** (operations log) is a capped collection named `local.oplog.rs` on replica-set members. It records operations that secondaries use to replicate changes. Secondaries read entries from the oplog and apply them locally.

The oplog has a limited retention window. If a secondary falls too far behind and required entries have been removed, it may need resynchronization or initial sync.

## Check replica-set status

```javascript
// Show replica-set health, members, states, and replication information
rs.status()
```

Important fields include:

- `set`: replica-set name.
- `members`: configured members.
- `members[n].name`: host and port for a member.
- `members[n].stateStr`: readable state such as `PRIMARY`, `SECONDARY`, `STARTUP2`, or `RECOVERING`.
- `members[n].health`: commonly `1` for reachable/healthy and `0` for unhealthy.
- `members[n].optimeDate`: a member's most recently applied/known operation time, depending on the status field and server version.
- `date`: time at which the status was reported.

### Quick health check

```javascript
const status = rs.status();

status.members.forEach(member => {
  print(
    member.name,
    "state:", member.stateStr,
    "health:", member.health,
    "optime:", member.optimeDate
  );
});
```

A healthy setup usually has one `PRIMARY` and the expected number of `SECONDARY` members with `health: 1`. Newly started members may briefly show startup or recovery states.

To assess replication lag, compare operation times for the primary and secondaries. Exact fields and interpretation can vary by MongoDB version. A growing time difference, unhealthy member, or repeated state changes may indicate network, disk, CPU, or replication problems.

## Inspect oplog information

Run this on a replica-set member with permission to read the local database:

```javascript
use local

// Inspect a few recent oplog entries
db.oplog.rs.find().sort({ $natural: -1 }).limit(5)

// Inspect the oldest retained entry
db.oplog.rs.find().sort({ $natural: 1 }).limit(1)
```

Oplog entries are internal replication data. Do not edit or delete them manually.

## Common replication problems

- **Member unreachable:** check network connectivity, DNS, firewall rules, and configured hostnames.
- **Secondary lag increasing:** check CPU, disk I/O, network throughput, and write volume.
- **Member needs resync:** required oplog history may no longer be available.
- **No primary:** check voting-member availability, replica-set configuration, and logs.
- **Authentication or TLS failure:** verify member keyfiles/certificates and configuration.

Use server logs and `rs.status()` to investigate before changing replica-set configuration.

---

# 2. Backup and Recovery

## Why backups matter

Replication maintains availability, but it does not protect against every disaster. If a user drops a collection or corrupts data, that change may replicate to all members. Backups provide a separate recovery point.

A good backup plan defines:

- **RPO (Recovery Point Objective):** how much data loss, measured in time, is acceptable.
- **RTO (Recovery Time Objective):** how long the system can be unavailable.
- **Retention:** how long backups are kept.
- **Restore testing:** whether the backup can actually be restored.
- **Off-site or isolated copies:** protection from server, account, or site-wide failure.

## Create a logical backup with `mongodump`

`mongodump` is a MongoDB Database Tools command run in a terminal, not inside `mongosh`.

```bash
# Back up one database to a directory
mongodump --uri="mongodb://localhost:27017" \
  --db=student_system \
  --out="./mongo-backup"
```

For an authenticated deployment, use an approved credential-handling method. Avoid putting real passwords in shell history or committing them to GitHub.

For a replica set, use a connection string containing the replica-set name and member hosts. For production backups, choose an approach that provides the consistency guarantees required by your workload. A dump of a changing database may require additional planning for consistency.

## Restore a backup with `mongorestore`

Run this in a terminal:

```bash
# Restore the student_system database from the dump directory
mongorestore --uri="mongodb://localhost:27017" \
  --nsInclude="student_system.*" \
  "./mongo-backup"
```

`mongorestore` does not automatically replace everything. If you intend to drop existing target collections first, understand the impact and explicitly choose the appropriate options, such as `--drop`, only after confirming the target and backup.

## Replica-set backup considerations

- Use a backup method supported for your deployment and MongoDB version.
- Options for self-managed deployments include `mongodump`/`mongorestore`, coordinated filesystem snapshots, and managed backup tools where available.
- For a replica set with active writes, plan for a consistent backup; do not assume copying live database files with a normal file-copy command is safe.
- Store backups separately from source servers and encrypt them where appropriate.
- Restrict access to backup files because they can contain sensitive data.
- Regularly perform a test restore and verify recovered collections and records.

## Disaster recovery strategy

1. Identify the incident and stop harmful operations where safe.
2. Determine the required recovery point and target environment.
3. Select a verified backup and restore it into an isolated or approved target.
4. Validate document counts, indexes, application behavior, and critical records.
5. Reconnect applications only after validation and approval.
6. Record the incident and improve the backup schedule or procedures.

For point-in-time recovery, the backup method and retained oplog or other point-in-time data must support the target recovery time. A simple `mongodump` alone is not a complete point-in-time recovery strategy.

---

# 3. Project: Student Management & Performance System

## Objective

Build a small MongoDB database with two collections:

- `students`: student details, course enrolments, and marks.
- `courses`: course information.

The project inserts sample records, updates marks, indexes the courses collection, and aggregates the number of students and average marks per course.

## Step 1: Create the database

Run in `mongosh`:

```javascript
use student_system
```

MongoDB creates the database when data is first stored in it.

## Step 2: Insert course records

```javascript
db.courses.insertMany([
  {
    courseId: "CS101",
    title: "Database Management Systems",
    department: "Computer Science",
    credits: 4
  },
  {
    courseId: "CS102",
    title: "Java Programming",
    department: "Computer Science",
    credits: 3
  },
  {
    courseId: "IT201",
    title: "Web Development",
    department: "Information Technology",
    credits: 3
  }
])
```

## Step 3: Insert student records

Each student has a `marks` array. Each element records a course ID and the student's mark in that course.

```javascript
db.students.insertMany([
  {
    studentId: "S001",
    name: "Aarav Sharma",
    semester: 5,
    marks: [
      { courseId: "CS101", score: 88 },
      { courseId: "CS102", score: 91 }
    ]
  },
  {
    studentId: "S002",
    name: "Diya Verma",
    semester: 5,
    marks: [
      { courseId: "CS101", score: 92 },
      { courseId: "IT201", score: 85 }
    ]
  },
  {
    studentId: "S003",
    name: "Kabir Singh",
    semester: 5,
    marks: [
      { courseId: "CS101", score: 79 },
      { courseId: "CS102", score: 87 },
      { courseId: "IT201", score: 90 }
    ]
  },
  {
    studentId: "S004",
    name: "Meera Joshi",
    semester: 5,
    marks: [
      { courseId: "CS102", score: 95 },
      { courseId: "IT201", score: 89 }
    ]
  }
])
```

## Step 4: Verify inserted data

```javascript
db.students.find().pretty()
db.courses.find().pretty()

// Count documents in each collection
db.students.countDocuments()
db.courses.countDocuments()
```

Expected initial counts: **4 students** and **3 courses**.

## Step 5: Update student marks

Update Aarav's DBMS score from 88 to 90:

```javascript
db.students.updateOne(
  {
    studentId: "S001",
    "marks.courseId": "CS101"
  },
  {
    $set: { "marks.$.score": 90 }
  }
)
```

The positional `$` updates the matching element in the `marks` array. Verify the update:

```javascript
db.students.findOne(
  { studentId: "S001" },
  { _id: 0, name: 1, marks: 1 }
)
```

## Step 6: Create indexes

Create a unique index on `courseId` so course identifiers cannot be duplicated:

```javascript
db.courses.createIndex(
  { courseId: 1 },
  { unique: true }
)
```

This index helps queries that look up a course by its identifier:

```javascript
db.courses.find({ courseId: "CS101" })
```

If the application often queries courses by department, consider an additional index:

```javascript
db.courses.createIndex({ department: 1 })
```

Check indexes:

```javascript
db.courses.getIndexes()
```

Indexes improve matching queries but use storage and add work to writes. Validate their benefit with `explain("executionStats")` and realistic data:

```javascript
db.courses.find({ courseId: "CS101" }).explain("executionStats")
```

## Step 7: Aggregation — student count and average marks per course

The pipeline expands each student's marks, groups by course ID, then joins the course title.

```javascript
db.students.aggregate([
  // Turn each course mark into a separate pipeline document
  { $unwind: "$marks" },

  // Count mark records and calculate the average score per course
  {
    $group: {
      _id: "$marks.courseId",
      totalStudents: { $sum: 1 },
      averageMarks: { $avg: "$marks.score" }
    }
  },

  // Join course details from the courses collection
  {
    $lookup: {
      from: "courses",
      localField: "_id",
      foreignField: "courseId",
      as: "courseDetails"
    }
  },

  {
    $unwind: {
      path: "$courseDetails",
      preserveNullAndEmptyArrays: true
    }
  },

  {
    $project: {
      _id: 0,
      courseId: "$_id",
      courseTitle: "$courseDetails.title",
      totalStudents: 1,
      averageMarks: { $round: ["$averageMarks", 2] }
    }
  },

  { $sort: { courseId: 1 } }
])
```

### How the aggregation works

1. `$unwind` creates one pipeline document per student-course mark.
2. `$group` groups marks by course ID, counts mark records, and calculates their average.
3. `$lookup` joins the course title from `courses`.
4. `$project` formats the output.
5. `$sort` orders results by course ID.

Because each student has at most one mark entry per course in this sample, `totalStudents` equals the number of students with a mark for that course. If duplicate entries are possible, deduplicate them before counting.

### Expected result after the update

| Course ID | Course | Total students | Average marks |
|---|---|---:|---:|
| CS101 | Database Management Systems | 3 | 87.00 |
| CS102 | Java Programming | 3 | 91.00 |
| IT201 | Web Development | 3 | 88.00 |

The averages include Aarav's updated CS101 score of 90.

**Note:** This aggregation returns courses with at least one student mark. A course with zero enrolled students will not appear because the pipeline starts from `students`. To include courses with no marks, start from `courses` and use a `$lookup` pipeline.

## Step 8: Useful validation queries

```javascript
// Find students with a CS101 score of at least 85
db.students.find({
  marks: {
    $elemMatch: {
      courseId: "CS101",
      score: { $gte: 85 }
    }
  }
})

// Count all students
db.students.countDocuments()

// List available courses
db.courses.find({}, { _id: 0, courseId: 1, title: 1 })

// Explain a course lookup
db.courses.find({ courseId: "CS101" }).explain("executionStats")
```

## Concepts demonstrated

- Creating and selecting a MongoDB database.
- Designing two related collections.
- Inserting and updating documents and array elements.
- Creating unique and query-oriented indexes.
- Validating query plans with `explain()`.
- Using `$unwind`, `$group`, `$avg`, `$sum`, `$lookup`, `$project`, and `$sort`.
- Understanding replica-set health, oplog-based replication, backups, restores, and disaster recovery.

---

## Safety reminders

- Use a test database for practice.
- Never commit database passwords, private connection strings, or backup files containing real user data to a public repository.
- Test restores regularly; a backup is useful only if it can be recovered.
- Replica sets improve availability but do not replace independent backups.
