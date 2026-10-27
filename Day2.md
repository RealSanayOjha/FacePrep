# MongoDB Indexing: Complete Notes

Indexes help MongoDB find documents without scanning an entire collection. They can make reads and sorts faster, but they also use storage and add work to inserts, updates, and deletes. Create indexes for real query patterns, not for every field.

## 1. Sample collection

The examples below use a collection named `students`.

```javascript
use college

db.students.insertMany([
  { name: "Aarav", age: 20, department: "IT", skills: ["Java", "MongoDB"], cgpa: 9.1 },
  { name: "Diya", age: 21, department: "CSE", skills: ["Python", "SQL"], cgpa: 8.8 },
  { name: "Kabir", age: 20, department: "IT", skills: ["Java", "Spring Boot"], cgpa: 9.4 },
  { name: "Meera", age: 22, department: "ECE", skills: ["C", "Python"], cgpa: 8.6 }
])
```

> Run the insert only in a practice database. If documents with these values already exist, inserting them again will create duplicates.

## 2. Creating an index

`createIndex()` creates an index on one or more fields. The value `1` means ascending order and `-1` means descending order.

```javascript
// Index on one field
db.students.createIndex({ department: 1 })

// List indexes on the collection
db.students.getIndexes()

// Remove an index by its name
db.students.dropIndex("department_1")
```

MongoDB automatically creates a unique index on `_id`. Avoid dropping an index unless you know it is safe to remove.

## 3. Common index types

### A. Single-field index

An index on one field can help queries that filter or sort by that field.

```javascript
db.students.createIndex({ age: 1 })

// Can use the age index
db.students.find({ age: 20 })

// Can also use it for an age sort
db.students.find().sort({ age: 1 })
```

### B. Compound index

A compound index contains multiple fields. Field order matters.

```javascript
db.students.createIndex({ department: 1, age: 1 })

// Matches the leading field and can use the index
db.students.find({ department: "IT" })

// Matches both indexed fields
db.students.find({ department: "IT", age: 20 })

// Can use the index for this prefix and compatible sort
db.students.find({ department: "IT" }).sort({ age: 1 })
```

This index is generally not a good fit for a query that filters only by `age`, because `age` is not the leading field. A separate index may be needed if age-only queries are common.

### C. Multikey index

When a field contains an array, MongoDB can create a multikey index on that field. MongoDB automatically makes it multikey when the indexed field contains array values.

```javascript
db.students.createIndex({ skills: 1 })

// Find students who have Java in their skills array
db.students.find({ skills: "Java" })
```

A compound multikey index has restrictions: for a given document, at most one indexed field in a compound index can be an array. Check MongoDB documentation for the exact limitations of your schema and server version.

### D. Unique index

A unique index prevents duplicate index keys for the indexed field or combination of fields.

```javascript
// Use only if every student's email should be unique
db.students.createIndex({ email: 1 }, { unique: true })
```

Before creating a unique index, check existing data for duplicates. A unique single-field index also has special behavior for missing and `null` values; multiple documents with missing/null values can cause a creation failure.

## 4. Explain plan: understand query performance

`explain("executionStats")` shows how MongoDB executed a query and how many documents and index keys it examined.

```javascript
db.students.find({ department: "IT" }).explain("executionStats")
```

Look at these fields in the output:

- `winningPlan`: the plan MongoDB selected.
- `stage`: `IXSCAN` generally indicates an index scan; `COLLSCAN` indicates a collection scan.
- `nReturned`: documents returned by the query.
- `totalKeysExamined`: index keys examined.
- `totalDocsExamined`: documents examined.

A `COLLSCAN` is not automatically bad for a small collection or a query that must read much of the collection. Compare the work performed with the number of results returned and test with realistic data.

## 5. Hidden indexes

A hidden index remains maintained by MongoDB but is invisible to the query planner. Hiding an index is useful for testing the impact of removing it before actually dropping it. Hidden indexes still consume storage and add write overhead.

```javascript
// Hide an existing index by its name
db.students.hideIndex("department_1")

// Check the indexes and their hidden status
db.students.getIndexes()

// Unhide it if query performance gets worse
db.students.unhideIndex("department_1")
```

Use an index name returned by `getIndexes()`; do not assume the name if it was created with a custom name. Hidden indexes cannot be used by the query planner while hidden.

## 6. Validate whether a query uses an index

Use `explain("executionStats")` on the exact query shape you care about.

```javascript
db.students.find({ department: "IT" }).explain("executionStats")
```

Check whether the winning plan contains `IXSCAN` instead of `COLLSCAN`. Also compare `totalDocsExamined`, `totalKeysExamined`, and `nReturned`.

To compare before and after creating an index:

```javascript
// First inspect the query plan
db.students.find({ department: "IT" }).explain("executionStats")

// Create an index for this filter
db.students.createIndex({ department: 1 })

// Inspect the plan again
db.students.find({ department: "IT" }).explain("executionStats")
```

The planner may still choose a collection scan if it estimates that scanning the collection is cheaper. An index existing does not guarantee every matching query will use it.

## 7. Optimizing compound-index field order

A useful starting point is to design indexes around the query's equality filters, sort, and range conditions. The commonly used guideline is **Equality, Sort, Range (ESR)**:

1. **Equality:** fields matched to a specific value.
2. **Sort:** fields used for sorting, when appropriate.
3. **Range:** fields matched with comparisons such as `$gt`, `$gte`, `$lt`, or `$lte`.

Example: an application often finds IT students with a minimum age and sorts by CGPA.

```javascript
db.students.createIndex({ department: 1, cgpa: -1, age: 1 })

db.students.find({
  department: "IT",
  age: { $gte: 20 }
}).sort({ cgpa: -1 })
```

This is an example, not a universal best index. The best order depends on actual query patterns, selectivity, sort requirements, and the data distribution. Test candidate indexes with `explain("executionStats")`.

### Prefix rule

For an index `{ department: 1, age: 1 }`, queries on `department` and on both `department` + `age` can generally benefit from the index prefix. Queries on `age` alone generally cannot efficiently use that index as a normal prefix lookup.

```javascript
db.students.createIndex({ department: 1, age: 1 })

// Uses the index prefix
db.students.find({ department: "IT" })

// Can use both fields
db.students.find({ department: "IT", age: 20 })

// Usually needs a separate age index for efficient age-only lookup
db.students.find({ age: 20 })
```

## 8. Common index-creation errors and issues

### Duplicate values with a unique index

If existing documents contain duplicate values, creating a unique index fails.

```javascript
// Check for duplicate email values before creating a unique index
db.students.aggregate([
  { $group: { _id: "$email", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

For a real collection, decide how missing or `null` email values should be handled before creating the index.

### Index already exists with different options

MongoDB can reject an index creation request when an index with the same key pattern already exists but incompatible options are specified. Inspect existing indexes first:

```javascript
db.students.getIndexes()
```

### Invalid or unsuitable index design

- Too many indexes increase disk use and slow writes.
- An index on a low-selectivity field may provide little benefit for some queries.
- A compound index with the wrong field order may not support the query well.
- A multikey index has limitations, especially for compound indexes on array fields.
- Unique indexes cannot be created while conflicting duplicate keys remain.

Check the exact error message and MongoDB server version before changing a production index.

## 9. Practical checklist

- Identify frequent and slow queries before creating an index.
- Match the index to the query's filter and sort.
- Put compound-index fields in a deliberate order; consider ESR.
- Use `explain("executionStats")` to verify real behavior.
- Review existing indexes with `getIndexes()`.
- Test index changes against realistic data.
- Remember that indexes speed up some reads but add storage and write costs.
- Hide an index to test the effect of removing it before dropping it.

## Quick reference

| Task | Command |
|---|---|
| Create ascending index | `db.students.createIndex({ age: 1 })` |
| Create descending index | `db.students.createIndex({ cgpa: -1 })` |
| Create compound index | `db.students.createIndex({ department: 1, age: 1 })` |
| Create unique index | `db.students.createIndex({ email: 1 }, { unique: true })` |
| List indexes | `db.students.getIndexes()` |
| Explain query | `db.students.find({ age: 20 }).explain("executionStats")` |
| Hide index | `db.students.hideIndex("age_1")` |
| Unhide index | `db.students.unhideIndex("age_1")` |
| Drop index | `db.students.dropIndex("age_1")` |

---

**Note:** These examples use MongoDB Shell (`mongosh`) syntax. Always test index changes in a development environment before applying them to production.
