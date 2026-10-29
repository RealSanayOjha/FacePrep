// Idempotent migration. Connect to the intended database first:
// mongosh "mongodb://127.0.0.1:27017/student_management" database/indexes.js
// Keep names/keys/weights in sync with MongoIndexInitializer.java.
// Use the database command because each index has different options.
const result = db.runCommand({
  createIndexes: "students",
  indexes: [
    { key: { email: 1 }, name: "uq_students_email", unique: true },
    { key: { studentCode: 1 }, name: "uq_students_code", unique: true },
    { key: { course: 1, status: 1, yearLevel: 1, createdAt: -1, _id: 1 }, name: "idx_course_status_year_created" },
    { key: { status: 1, createdAt: -1, _id: 1 }, name: "idx_status_created" },
    { key: { createdAt: -1, _id: 1 }, name: "idx_created" },
    { key: { lastName: 1, firstName: 1, _id: 1 }, name: "idx_name" },
    { key: { yearLevel: 1, createdAt: -1, _id: 1 }, name: "idx_year_created" },
    {
      key: { _fts: "text", _ftsx: 1 },
      name: "txt_students_search",
      weights: { studentCode: 10, lastName: 8, firstName: 6, email: 5, course: 2 },
      default_language: "none"
    }
  ]
});
if (!result.ok) throw new Error("Index migration failed: " + tojson(result));
printjson(result);
printjson(db.students.getIndexes());
