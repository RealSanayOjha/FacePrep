#!/usr/bin/env bash
# Non-destructive HTTP smoke test against a running application.
# Creates one clearly marked smoke-test record, reads/updates it, then deletes it.
set -euo pipefail
BASE="${BASE_URL:-http://127.0.0.1:8080}"
command -v curl >/dev/null
curl -fsS "$BASE/actuator/health" | grep -q '"status":"UP"'
SUFFIX="$(date +%s)-$$"
BODY="{\"studentCode\":\"SMOKE-$SUFFIX\",\"firstName\":\"Smoke\",\"lastName\":\"Test\",\"email\":\"smoke-$SUFFIX@example.edu\",\"course\":\"Smoke Testing\",\"yearLevel\":1,\"status\":\"ACTIVE\"}"
RESPONSE="$(curl -fsS -H 'Content-Type: application/json' -d "$BODY" "$BASE/api/students")"
ID="$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
trap 'curl -fsS -X DELETE "$BASE/api/students/$ID" >/dev/null || true' EXIT
curl -fsS "$BASE/api/students/$ID" | grep -q '"firstName":"Smoke"'
UPDATED="${BODY/\"yearLevel\":1/\"yearLevel\":2}"
curl -fsS -X PUT -H 'Content-Type: application/json' -d "$UPDATED" "$BASE/api/students/$ID" | grep -q '"yearLevel":2'
curl -fsS "$BASE/api/students?search=Smoke-$SUFFIX" | grep -q '"totalElements":1'
curl -fsS "$BASE/api/dashboard/stats" | grep -q '"totalStudents"'
curl -fsS -X DELETE "$BASE/api/students/$ID" >/dev/null
trap - EXIT
printf 'PASS: health, create, read, update, search, statistics and delete.\n'
