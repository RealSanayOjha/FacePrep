// Read-only examples: mongosh mongodb://127.0.0.1:27017/student_management database/queries.js
print("=== Unique email lookup ===");
printjson(db.students.find({ email: "ananya.iyer@student.example.edu" }).explain("executionStats"));

print("=== Compound equality filter + indexed newest-first sort ===");
printjson(db.students.find({ course: "Computer Science", status: "ACTIVE", yearLevel: 2 })
  .sort({ createdAt: -1, _id: 1 }).limit(10).explain("executionStats"));

print("=== Whole-word text search (not substring search) ===");
printjson(db.students.find({ $text: { $search: "Sharma" } }, { score: { $meta: "textScore" }, firstName: 1, lastName: 1 })
  .limit(10).explain("executionStats"));

print("=== Dashboard aggregation ===");
printjson(db.students.aggregate([
  { $group: {
      _id: null,
      totalStudents: { $sum: 1 },
      activeStudents: { $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] } },
      inactiveStudents: { $sum: { $cond: [{ $eq: ["$status", "INACTIVE"] }, 1, 0] } },
      graduatedStudents: { $sum: { $cond: [{ $eq: ["$status", "GRADUATED"] }, 1, 0] } }
  } },
  { $project: { _id: 0 } }
]).toArray());
printjson(db.students.aggregate([
  { $group: { _id: "$course", count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, course: "$_id", count: 1 } }
]).toArray());
