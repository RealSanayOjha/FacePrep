# API Reference

Base URL: `http://localhost:8080`. All request/response bodies are JSON. The frontend is served from the same origin, so no CORS configuration is required.

## Student model

```json
{
  "id": "507f1f77bcf86cd799439011",
  "studentCode": "STU-2026-013",
  "firstName": "Ananya",
  "lastName": "Iyer",
  "email": "ananya.iyer@example.edu",
  "course": "Computer Science",
  "yearLevel": 2,
  "status": "ACTIVE",
  "createdAt": "2026-10-29T03:00:00Z",
  "updatedAt": "2026-10-29T03:00:00Z"
}
```

Writable fields: `studentCode`, `firstName`, `lastName`, `email`, `course`, `yearLevel`, `status`.

Validation:

- `studentCode`: 3–30 characters, letters/digits/hyphens, must start with a letter or digit; normalized to uppercase; unique.
- `firstName`, `lastName`: required, max 60 characters, trimmed.
- `email`: required, valid email format, max 254 characters; normalized to lowercase; unique.
- `course`: required, max 80 characters, trimmed.
- `yearLevel`: integer 1–6.
- `status`: `ACTIVE`, `INACTIVE`, or `GRADUATED`.
- Unknown JSON properties are rejected.
- `id`, `createdAt`, and `updatedAt` are server-owned. Timestamps use UTC with millisecond precision.

## Create

`POST /api/students`

```bash
curl -i -X POST http://localhost:8080/api/students \
  -H 'Content-Type: application/json' \
  -d '{
    "studentCode":"STU-2026-013",
    "firstName":"Ananya",
    "lastName":"Iyer",
    "email":"ananya.iyer@example.edu",
    "course":"Computer Science",
    "yearLevel":2,
    "status":"ACTIVE"
  }'
```

Response: `201 Created`, `Location: /api/students/{id}`, student body. Duplicate email/code returns `409 Conflict`.

## List, search, filter, sort, paginate

`GET /api/students`

| Parameter | Default | Notes |
|---|---:|---|
| `search` | none | Whole-word MongoDB text search across code, names, email, course; max 100 chars |
| `course` | none | Exact, case-sensitive course match after trimming |
| `status` | none | `ACTIVE`, `INACTIVE`, `GRADUATED` |
| `yearLevel` | none | 1–6 |
| `page` | `0` | Zero-based; offset `page * size` cannot exceed 10000 |
| `size` | `10` | 1–100 |
| `sort` | `newest` | `newest`, `name`, `year` |

Sort definitions include a stable `_id` tie-breaker:

- `newest`: `createdAt DESC, _id ASC`
- `name`: `lastName ASC, firstName ASC, _id ASC`
- `year`: `yearLevel ASC, createdAt DESC, _id ASC`

```bash
curl 'http://localhost:8080/api/students?course=Computer%20Science&status=ACTIVE&yearLevel=2&page=0&size=10&sort=newest'
curl 'http://localhost:8080/api/students?search=Sharma'
```

Response:

```json
{
  "content": [],
  "page": 0,
  "size": 10,
  "totalElements": 0,
  "totalPages": 0,
  "first": true,
  "last": true,
  "sort": "newest"
}
```

Text search is not substring search. For example, `Sharma` matches the indexed term; a partial fragment may not. Count and page reads are not a transactional snapshot on standalone MongoDB.

## Read one

`GET /api/students/{id}` → `200 OK` or `404 Not Found`.

## Update

`PUT /api/students/{id}` with the same writable-field body as create.

Response: `200 OK`. The update preserves `id` and `createdAt`, changes `updatedAt`, and uses an atomic single-document replacement. It does not insert a missing document. Last-writer-wins semantics apply to concurrent full updates; there is no optimistic-lock version field.

## Delete

`DELETE /api/students/{id}` → `204 No Content` or `404 Not Found`.

## Dashboard statistics

`GET /api/dashboard/stats`

```json
{
  "totalStudents": 12,
  "activeStudents": 8,
  "inactiveStudents": 2,
  "graduatedStudents": 2,
  "byCourse": [
    { "course": "Business Administration", "count": 2 },
    { "course": "Computer Science", "count": 3 }
  ]
}
```

Implemented with MongoDB aggregation (`$group`, conditional `$sum`, `$sort`).

## Health

`GET /actuator/health` → `200` with `{"status":"UP",...}` when the application and MongoDB health indicator are healthy. Only the health endpoint is exposed over HTTP.

## Error format

```json
{
  "timestamp": "2026-10-29T03:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed. Check the highlighted fields.",
  "fieldErrors": {
    "email": "must be a well-formed email address"
  }
}
```

Common statuses: `400` invalid input, `404` missing student/resource, `405` unsupported method, `409` duplicate email/code, `503` database unavailable, `500` unexpected server error. Internal stack traces and database details are not returned to clients.
