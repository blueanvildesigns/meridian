# Meridian Cloud Functions

One function, `reportBug` (Cloud Functions for Firebase, 2nd gen, Node 22, `us-central1`), behind the Hosting rewrite `/api/report-bug`. It turns an in-app bug report into a GitHub issue. Decisions: `docs/archive/2026-11-21-bug-reporting.md`. Owner setup and deploy: `docs/manual-setup-bug-reporting.md`.

| File                                                  | What it does                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                        | The function, its params and secret, and the real App Check, GitHub and Firestore calls                                             |
| `src/handler.ts`                                      | The request flow: method, type, size, origin, rate limit, App Check, one-use check, validation, global cap, GitHub, private contact |
| `src/validate.ts`, `src/sanitize.ts`, `src/limits.ts` | Input checks and cleaning                                                                                                           |
| `src/issue.ts`                                        | The public issue: every user field in a code block, never the email                                                                 |
| `src/github.ts`                                       | `POST /repos/{repo}/issues`                                                                                                         |
| `src/contacts.ts`                                     | The private `bugReportContacts/{issue}` Firestore document                                                                          |
| `src/tokenLedger.ts`                                  | Each App Check token works once: its ID goes in `usedAppCheckTokens/{jti}` with a create-only write                                 |
| `src/rateLimit.ts`                                    | In-memory limits: 5 an hour per address, 30 issues an hour in all                                                                   |

## Checks

```bash
cd functions
npm ci
npm run check   # lint, format, typecheck, unit tests, build
npm run test:emulator   # the one-use check against the real Firestore emulator (needs Java)
```

CI runs the same in `.github/workflows/functions-ci.yml`. Nothing deploys the function automatically.

## Local testing with the emulators (nothing touches production)

Needs Java (for the Firestore emulator) and the Firebase CLI. The emulators run on your machine; the Admin SDK talks to the Firestore emulator, and the function refuses to save a contact if the Firestore emulator isn't running rather than reach production.

1. Give the emulator a fake GitHub token, so no issue is created:
   ```bash
   cp functions/.secret.local.example functions/.secret.local
   ```
   It contains `GITHUB_BUG_TOKEN=dry-run`: in the emulator only, the function skips GitHub and answers with issue #0. To create real issues in a sandbox repo instead, put a token for that repo there and `BUG_REPORT_REPO=you/sandbox` in `functions/.env.local`.
2. Build and start the emulators from the repo root (the Hosting emulator serves `webapp/dist` with the real rewrite):
   ```bash
   npm --prefix functions run build
   npm --prefix webapp run build
   firebase emulators:start --only functions,firestore,hosting --project meridian-web-a5829
   ```
   Emulator UI: http://127.0.0.1:4000 (Firestore data, function logs).
3. In another terminal, run the smoke test (8 checks through the Hosting rewrite, then lists the private contact documents):
   ```bash
   functions/scripts/emulator-smoke.sh
   ```
4. To try the dialog itself, run the web app's dev server in emulator mode. It proxies `/api/report-bug` to the Functions emulator (`webapp/vite.config.ts`) and sends no App Check token, which the emulator doesn't ask for:
   ```bash
   echo 'VITE_BUG_REPORT_EMULATOR=true' > webapp/.env.development.local
   npm --prefix webapp run dev
   ```
   Open http://localhost:5173 → footer → **Report a bug**. Delete `webapp/.env.development.local` afterwards to go back to the normal dev setup.

In the emulator, App Check is skipped (`FUNCTIONS_EMULATOR` is set only there). To test App Check itself before going live, use the debug provider against the real service: `VITE_APPCHECK_DEBUG=true` in `webapp/.env.development.local` plus the four Firebase values from `webapp/.env.example`, and register the debug token the browser console prints.

## Deploy

By hand, after the owner setup: `firebase deploy --only functions,firestore:rules --project meridian-web-a5829` from the repo root. The predeploy hook lints and builds first. Params come from `functions/.env`; the token from Secret Manager.
