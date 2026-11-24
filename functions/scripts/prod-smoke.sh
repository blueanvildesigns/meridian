#!/usr/bin/env bash
# Production smoke test for in-app bug reports (docs/manual-setup-bug-reporting.md, part 7).
# Sends one real report to the live endpoint, shows the issue, then deletes the issue and the
# private contact document, so nothing is left behind.
#
# Needs: gh (signed in as a repo admin, to delete), firebase (signed in), curl, node, and an App
# Check debug token registered in the Firebase console (Security → App Check → Apps → Meridian
# Web's ⋮ → Manage debug tokens).
#
#   functions/scripts/prod-smoke.sh
#
# It asks for the debug token without echoing it, so it stays out of your screen and shell history.
# The token is a credential for App Check: delete it in the console when you're done.
# APPCHECK_DEBUG_TOKEN in the environment skips the prompt. FIREBASE_API_KEY and FIREBASE_APP_ID
# default to the live web app's, which are public (every visitor's browser gets them).
set -euo pipefail

PROJECT="${FIREBASE_PROJECT_ID:-meridian-web-a5829}"
FIREBASE_API_KEY="${FIREBASE_API_KEY:-AIzaSyAUiYwpITWSOZvTdhxmiJwoYUs1wrL6oIs}"
FIREBASE_APP_ID="${FIREBASE_APP_ID:-1:972119330859:web:eb9fd6d27aca698cba5a6e}"
if [[ -z "${APPCHECK_DEBUG_TOKEN:-}" ]]; then
  read -rsp 'Paste the App Check debug token (nothing will show), then press Enter: ' APPCHECK_DEBUG_TOKEN
  echo
fi
# A paste can bring spaces, quotes or a terminal's invisible bracketed-paste markers along with it.
DEBUG_TOKEN="${APPCHECK_DEBUG_TOKEN//$'\e[200~'/}"
DEBUG_TOKEN="${DEBUG_TOKEN//$'\e[201~'/}"
DEBUG_TOKEN="${DEBUG_TOKEN//[^A-Za-z0-9-]/}"
[[ -n "$DEBUG_TOKEN" ]] || { echo 'No debug token given.'; exit 1; }
if [[ ! "$DEBUG_TOKEN" =~ ^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$ ]]; then
  echo "   Warning: debug tokens look like 8-4-4-4-12 hex digits; this is ${#DEBUG_TOKEN} characters. Trying anyway."
fi
SITE="${SITE:-https://meridian.blueanvildesigns.io}"
REPO="${REPO:-blueanvildesigns/meridian}"

json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)$1;console.log(v??'')})"; }

echo '1. Exchanging the debug token for a limited-use App Check token…'
EXCHANGE=$(curl -s -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' \
  --data "{\"debugToken\":\"$DEBUG_TOKEN\",\"limitedUse\":true}" \
  "https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${FIREBASE_APP_ID}:exchangeDebugToken?key=${FIREBASE_API_KEY}")
EXCHANGE_STATUS=$(tail -n1 <<<"$EXCHANGE")
if [[ "$EXCHANGE_STATUS" != 200 ]]; then
  echo "   App Check answered $EXCHANGE_STATUS: $(head -n -1 <<<"$EXCHANGE" | tr -s ' \n' ' ')"
  [[ "$EXCHANGE_STATUS" == 403 ]] &&
    echo '   That token is not registered for Meridian Web: copy it again from Manage debug tokens (or add a new one), and paste it whole.'
  exit 1
fi
TOKEN=$(head -n -1 <<<"$EXCHANGE" | json '.token')
[[ -n "$TOKEN" ]] || { echo 'App Check answered 200 but sent no token.'; exit 1; }

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
[[ "$REPLAY" == 401 ]] || echo "   FAIL: the replayed token was accepted. If that made an issue, it's the newest one titled \"[Bug]: replay\": delete it too."

read -rp "5. Delete issue #$NUMBER and its contact document now? [y/N] " yes
if [[ "$yes" == y* ]]; then
  gh issue delete "$NUMBER" -R "$REPO" --yes
  firebase firestore:delete "bugReportContacts/$NUMBER" --project "$PROJECT" --force
fi
[[ "$REPLAY" == 401 ]]
