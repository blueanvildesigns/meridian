#!/usr/bin/env bash
# Exercises /api/report-bug on the local emulators (functions/README.md). Run with the emulators up
# and GITHUB_BUG_TOKEN=dry-run in functions/.secret.local, so no real issue is created.
# Usage: functions/scripts/emulator-smoke.sh [base-url]   (default: the Hosting emulator)
set -euo pipefail

BASE="${1:-http://127.0.0.1:5000}"
URL="$BASE/api/report-bug"
FIRESTORE="http://127.0.0.1:8080/v1/projects/meridian-web-a5829/databases/(default)/documents"
fails=0
OUT=$(mktemp)
trap 'rm -f "$OUT"' EXIT
# A fresh made-up address each run, so earlier runs' requests don't count against the per-address
# limit (5 an hour). The function reads the first X-Forwarded-For entry (see rateLimit.ts).
ADDR="203.0.113.$((RANDOM % 250 + 1))"

check() {
  local name="$1" want="$2" body="$3" origin="${4:-http://127.0.0.1:5000}"
  local got
  got=$(curl -s -o "$OUT" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H "Origin: $origin" -H "X-Forwarded-For: $ADDR" --data-binary "$body" "$URL")
  if [[ "$got" == "$want" ]]; then
    printf 'ok    %-28s %s %s\n' "$name" "$got" "$(cat "$OUT")"
  else
    printf 'FAIL  %-28s want %s, got %s %s\n' "$name" "$want" "$got" "$(cat "$OUT")"
    fails=$((fails + 1))
  fi
}

check 'report' 201 '{"description":"Smoke test: Sydney is an hour off","diagnostics":"App version: dev"}'
check 'report with email' 201 '{"description":"Smoke test with email","email":"smoke@example.com"}'
check 'honeypot' 400 '{"description":"x","website":"https://spam.example"}'
check 'invalid fields' 400 '{"description":"","email":"nope"}'
check 'other website' 403 '{"description":"x"}' 'https://evil.example'
check 'too large' 413 "{\"description\":\"$(head -c 20000 /dev/zero | tr '\0' a)\"}"
# Four requests above counted towards this address's 5 an hour; the fifth passes, the sixth doesn't.
check 'fifth from one address' 201 '{"description":"Smoke test: fifth"}'
check 'sixth from one address' 429 '{"description":"Smoke test: sixth"}'

echo
echo 'Private contact documents in the Firestore emulator (never in the issue):'
# "Bearer owner" is the emulator's admin token: the security rules deny every other reader.
curl -s -H 'Authorization: Bearer owner' "$FIRESTORE/bugReportContacts" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const d of JSON.parse(s).documents??[])console.log(" ",d.name.split("/").pop(),d.fields.email.stringValue)})'

exit "$fails"
