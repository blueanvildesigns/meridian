#!/usr/bin/env bash
# Production smoke test for in-app bug reports (docs/manual-setup-bug-reporting.md, part 6).
# Sends one real report to the live endpoint, shows the issue, then deletes the issue and the
# private contact document, so nothing is left behind.
#
# Needs: gh (signed in as a repo admin, to delete), firebase (signed in), curl, node, and an App
# Check debug token registered in the Firebase console (App Check → Apps → ⋮ → Manage debug tokens).
#
#   APPCHECK_DEBUG_TOKEN=... FIREBASE_API_KEY=... FIREBASE_APP_ID=... functions/scripts/prod-smoke.sh
#
# The debug token is a credential for App Check: keep it out of shell history (read -s) and delete
# it in the console when you're done.
set -euo pipefail

: "${APPCHECK_DEBUG_TOKEN:?set APPCHECK_DEBUG_TOKEN}"
: "${FIREBASE_API_KEY:?set FIREBASE_API_KEY}"
: "${FIREBASE_APP_ID:?set FIREBASE_APP_ID}"
PROJECT="${FIREBASE_PROJECT_ID:-meridian-web-a5829}"
SITE="${SITE:-https://meridian.blueanvildesigns.io}"
REPO="${REPO:-blueanvildesigns/meridian}"

json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)$1;console.log(v??'')})"; }

echo '1. Exchanging the debug token for a limited-use App Check token…'
TOKEN=$(curl -sf -X POST -H 'Content-Type: application/json' \
  --data "{\"debugToken\":\"$APPCHECK_DEBUG_TOKEN\",\"limitedUse\":true}" \
  "https://firebaseappcheck.googleapis.com/v1/projects/$PROJECT/apps/$FIREBASE_APP_ID:exchangeDebugToken?key=$FIREBASE_API_KEY" |
  json '.token')
[[ -n "$TOKEN" ]] || { echo 'No token: check the debug token is registered for this app.'; exit 1; }

echo '2. Sending a test report…'
RESULT=$(curl -s -w '\n%{http_code}' -X POST "$SITE/api/report-bug" \
  -H 'Content-Type: application/json' -H "Origin: $SITE" -H "X-Firebase-AppCheck: $TOKEN" \
  --data '{"description":"Smoke test, please ignore (deleted automatically)","steps":"Sent by functions/scripts/prod-smoke.sh","email":"smoke-test@example.com","diagnostics":"App version: smoke test"}')
STATUS=$(tail -n1 <<<"$RESULT")
BODY=$(head -n -1 <<<"$RESULT")
echo "   $STATUS $BODY"
[[ "$STATUS" == 201 ]] || exit 1
NUMBER=$(json '.number' <<<"$BODY")

echo "3. Issue #$NUMBER as GitHub shows it (the email must not appear):"
gh issue view "$NUMBER" -R "$REPO" --json title,labels,body --jq '.title, ([.labels[].name] | join(", ")), .body'
if gh issue view "$NUMBER" -R "$REPO" --json body --jq .body | grep -q 'smoke-test@example.com'; then
  echo 'FAIL: the email is in the public issue.'; exit 1
fi

echo '4. Replaying the same token must fail (replay protection):'
REPLAY=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/report-bug" \
  -H 'Content-Type: application/json' -H "Origin: $SITE" -H "X-Firebase-AppCheck: $TOKEN" \
  --data '{"description":"replay"}')
echo "   $REPLAY (want 401)"

read -rp "5. Delete issue #$NUMBER and its contact document now? [y/N] " yes
if [[ "$yes" == y* ]]; then
  gh issue delete "$NUMBER" -R "$REPO" --yes
  firebase firestore:delete "bugReportContacts/$NUMBER" --project "$PROJECT" --force
fi
[[ "$REPLAY" == 401 ]]
