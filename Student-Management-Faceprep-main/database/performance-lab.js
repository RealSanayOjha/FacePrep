// Isolated, reproducible benchmark. Does NOT touch student_management.
// mongosh "mongodb://127.0.0.1:27017" database/performance-lab.js
// Optional: BENCH_COUNT=20000 (1000..100000). Results are machine-specific.
const bench = db.getSiblingDB("student_management_benchmark");
const students = bench.students;
const count = Math.max(1000, Math.min(100000, Number(process.env.BENCH_COUNT || 20000)));
const courses = ["Computer Science", "Information Technology", "Electronics", "Mechanical Engineering", "Business Administration"];
const lastNames = ["Sharma", "Iyer", "Mehta", "Nair", "Patel", "Reddy", "Singh", "Das", "Rao", "Joshi"];
let seed = 2026;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function planSummary(explain) {
  const stages = new Set(), indexes = new Set();
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value.stage) stages.add(value.stage);
    if (value.indexName) indexes.add(value.indexName);
    Object.values(value).forEach(visit);
  }
  visit(explain.queryPlan || explain.executionStats);
  const stats = explain.executionStats || {};
  return { stages: [...stages], indexes: [...indexes], keysExamined: stats.totalKeysExamined,
    documentsExamined: stats.totalDocsExamined, returned: stats.nReturned, executionMillis: stats.executionTimeMillis };
}
function measure(query, sort, iterations = 40) {
  for (let i = 0; i < 5; i++) students.find(query).sort(sort).limit(10).toArray();
  const start = Date.now();
  for (let i = 0; i < iterations; i++) students.find(query).sort(sort).limit(10).toArray();
  return { iterations, averageMillis: Number(((Date.now() - start) / iterations).toFixed(3)) };
}
students.drop();
try {
  for (let offset = 0; offset < count; offset += 1000) {
    const batch = [];
    for (let i = offset; i < Math.min(offset + 1000, count); i++) {
      const last = lastNames[Math.floor(random() * lastNames.length)];
      batch.push({ studentCode: `BENCH-${String(i).padStart(6, "0")}`, firstName: `Student${i}`, lastName: last,
        email: `bench-${i}@example.edu`, course: courses[Math.floor(random() * courses.length)],
        yearLevel: 1 + Math.floor(random() * 4), status: random() < 0.8 ? "ACTIVE" : (random() < 0.5 ? "INACTIVE" : "GRADUATED"),
        createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000), updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 1000) });
    }
    students.insertMany(batch, { ordered: true });
  }
  const emailQuery = { email: `bench-${Math.floor(count / 2)}@example.edu` };
  const filterQuery = { course: "Computer Science", status: "ACTIVE", yearLevel: 2 };
  const newest = { createdAt: -1, _id: 1 };
  const result = { generatedAt: new Date().toISOString(), serverVersion: db.version(), documents: count,
    note: "Warm-cache local benchmark; not a production capacity claim. Benchmark collection dropped after measurement.",
    baseline: { email: { plan: planSummary(students.find(emailQuery).explain("executionStats")), timing: measure(emailQuery, {}) },
      filtered: { plan: planSummary(students.find(filterQuery).sort(newest).limit(10).explain("executionStats")), timing: measure(filterQuery, newest) } } };
  const indexResult = bench.runCommand({ createIndexes: "students", indexes: [
    { key: { email: 1 }, name: "uq_students_email", unique: true },
    { key: { studentCode: 1 }, name: "uq_students_code", unique: true },
    { key: { course: 1, status: 1, yearLevel: 1, createdAt: -1, _id: 1 }, name: "idx_course_status_year_created" },
    { key: { status: 1, createdAt: -1, _id: 1 }, name: "idx_status_created" },
    { key: { createdAt: -1, _id: 1 }, name: "idx_created" },
    { key: { lastName: 1, firstName: 1, _id: 1 }, name: "idx_name" },
    { key: { yearLevel: 1, createdAt: -1, _id: 1 }, name: "idx_year_created" },
    { key: { _fts: "text", _ftsx: 1 }, name: "txt_students_search", weights: { studentCode: 10, lastName: 8, firstName: 6, email: 5, course: 2 }, default_language: "none" }
  ] });
  if (!indexResult.ok) throw new Error("Benchmark index creation failed: " + tojson(indexResult));
  const textQuery = { $text: { $search: "Sharma" } };
  result.indexed = {
    email: { plan: planSummary(students.find(emailQuery).explain("executionStats")), timing: measure(emailQuery, {}) },
    filtered: { plan: planSummary(students.find(filterQuery).sort(newest).limit(10).explain("executionStats")), timing: measure(filterQuery, newest) },
    text: { plan: planSummary(students.find(textQuery).limit(10).explain("executionStats")), timing: measure(textQuery, {}) }
  };
  print("BENCH_RESULT_JSON=" + JSON.stringify(result));
} finally {
  students.drop();
}
