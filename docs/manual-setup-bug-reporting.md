# Bug reporting: owner setup checklist

The steps only you can do, in the order they depend on each other. Decisions: `docs/archive/2026-11-21-bug-reporting.md`. Local testing: `functions/README.md`.

- **Phase 1** (GitHub form and link) needs **part 1 only**.
- **Phase 2** (in-app form) needs parts 2 to 8, in order. Part 9 is for later.

Repo: `blueanvildesigns/meridian` · Firebase project: `meridian-web-a5829` (number `972119330859`) · Region: `us-central1`.

The terminal commands assume you're signed in to `gh`, `firebase` and `gcloud` (all three are, on this machine, as of 2026-11-21). For copying, set this once per terminal:

```bash
export P=meridian-web-a5829
```

**What I checked on 2026-11-21** (read-only): Issues are on; label `bug` exists, `needs-triage` doesn't; billing is enabled on the project (Blaze, R-8); **none** of the APIs in step 2.2 are enabled; there is no Firestore database; the CI service account has only `firebasehosting.admin`, `serviceusage.apiKeysViewer`, `serviceusage.serviceUsageConsumer`.

**Unsure, from the docs:** Firebase's docs say deploying functions needs Blaze, but don't list which Google Cloud APIs a 2nd gen deploy needs or whether the CLI turns them on (in practice it usually offers to). Step 2.2 turns them on explicitly, which is harmless if the CLI would have. Firebase's docs also don't cover the CI roles in 6.1 or what client address Hosting passes to the function.

---

## Part 1: GitHub (Phase 1)

### 1.1 Issues are on
- [x] Checked 2026-11-21 with `gh api repos/blueanvildesigns/meridian --jq .has_issues`: **true**. Nothing to do.
- If it's ever off: GitHub → the repo → **Settings** → **General** → **Features** → tick **Issues**.

### 1.2 Labels
`bug` already exists (GitHub's default, red `#d73a4a`). `needs-triage` doesn't, and the triage workflow fails until it does.

- [ ] Create `needs-triage`, either way:
  - Terminal:
    ```bash
    gh label create needs-triage -R blueanvildesigns/meridian --color FBCA04 --description "New issue, not yet looked at"
    ```
  - Or the web: the repo → **Issues** → **Labels** → **New label** → Label name `needs-triage`, Description `New issue, not yet looked at`, Color `#FBCA04` → **Create label**.
- [ ] Check both exist:
  ```bash
  gh label list -R blueanvildesigns/meridian --search triage
  ```

### 1.3 Workflow permissions
The triage workflow asks for `issues: write` in its own file, which works with the repo's read-only default token. Nothing to change. (The repo → **Settings** → **Actions** → **General** → **Workflow permissions** can stay on **Read repository contents and packages permissions**.)

### 1.4 After Phase 1 merges
- [ ] Open the live site → footer → **Report a bug**. GitHub's form should open with **Diagnostics** filled in, showing only version, browser, OS, time zone, time format and locale.
- [ ] Submit a test issue titled `[Bug]: test, please ignore`. Within a minute it should get `needs-triage` and the thank-you comment (the repo → **Actions** → **Issue triage** shows the run).
- [ ] Delete it: open the issue → right-hand sidebar, at the bottom → **Delete issue** → **Delete this issue!** (or `gh issue delete <number> -R blueanvildesigns/meridian`).
- [ ] **New issue** should show only the Bug report form, with no blank-issue link (`config.yml`).

---

## Part 2: Google Cloud project (blocks Phase 2)

### 2.1 Blaze and the budget alert
Blaze is already on (R-8, "Blaze with a $5 budget alert"; `gcloud billing projects describe $P` says `billingEnabled: True`). Check the alert covers the new services:

- [ ] https://console.cloud.google.com/billing → your billing account → **Budgets & alerts** → open the Meridian budget → **Scope**: Projects includes `meridian-web-a5829`, **Services** is **All services** (not just Firebase Hosting). Thresholds at 50%, 90% and 100% of $5 are sensible. Save if you changed anything.
- [ ] Remember a budget alert only emails you; it never stops spending. Part 9.2 is how to stop it.

What the new pieces cost at Meridian's size (Firebase pricing page, 2026-11-21): Cloud Functions has a monthly no-cost tier (2 million invocations, 400,000 GB-seconds, 200,000 CPU-seconds); Secret Manager allows 6 active secret versions and 10,000 accesses a month per secret at no cost; Firestore has a daily no-cost quota; App Check itself is free, but **reCAPTCHA Enterprise bills each assessment above a no-cost monthly quota** that Firebase's page doesn't state (check https://cloud.google.com/security/products/recaptcha#pricing). Container images for the function sit in Artifact Registry, which bills storage above a small free amount (see 6.2).

### 2.2 Turn on the APIs
- [ ] One command (takes a minute or two):
  ```bash
  gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com secretmanager.googleapis.com firestore.googleapis.com firebaseappcheck.googleapis.com recaptchaenterprise.googleapis.com iam.googleapis.com logging.googleapis.com --project $P
  ```
- [ ] Check:
  ```bash
  gcloud services list --enabled --project $P | grep -E 'cloudfunctions|cloudbuild|artifactregistry|run\.|secretmanager|firestore|firebaseappcheck|recaptchaenterprise'
  ```
  Eight lines. Or the console: https://console.cloud.google.com/apis/dashboard?project=meridian-web-a5829.

---

## Part 3: Web app, reCAPTCHA key and App Check (blocks Phase 2)

### 3.1 Register a Firebase web app
Hosting doesn't need one, so the project has none yet; App Check does.

- [ ] https://console.firebase.google.com/project/meridian-web-a5829/settings/general → **Your apps** → **Add app** → the web icon **`</>`**.
- [ ] App nickname: `Meridian Web`. **Leave "Also set up Firebase Hosting" unticked** (Hosting is already set up; ticking it can change `firebase.json`). → **Register app**.
- [ ] From the config it shows, copy `apiKey` and `appId` (looks like `1:972119330859:web:…`). Skip the "npm install" step → **Continue to console**. These are public identifiers, not secrets.

### 3.2 Create the reCAPTCHA Enterprise key
- [ ] https://console.cloud.google.com/security/recaptcha?project=meridian-web-a5829 (Google Cloud console → Security → reCAPTCHA). Enable the API if asked.
- [ ] **Create key**: Display name `Meridian App Check` → Application type **Web**.
- [ ] Domains, one per line:
  ```
  meridian.blueanvildesigns.io
  meridian-web-a5829.web.app
  meridian-web-a5829.firebaseapp.com
  ```
  **Never add `localhost`** (Firebase's docs say not to, on a production key). Preview channels (`meridian-web-a5829--pr40-….web.app`) are **not** subdomains of these, so the form can't get a token there and falls back to GitHub's link. To try a preview, add that one preview domain for the test and remove it afterwards.
- [ ] Leave **Use checkbox challenge** unticked (App Check needs a score-based key). Leave the web-application-firewall option off. → **Create key**.
- [ ] Copy the **key ID** (the site key).

### 3.3 Register the app with App Check
- [ ] https://console.firebase.google.com/project/meridian-web-a5829/appcheck (left sidebar: **Security** → **App Check**) → **Apps** tab → **Meridian Web** → **reCAPTCHA Enterprise**.
- [ ] Paste the site key from 3.2. Token time to live: leave **1 hour**. Risk threshold: leave **0.5** (Firebase's default). → **Save**.
- [ ] You don't need to press **Enforce** for anything: enforcement applies to Firebase products (Firestore, Storage and so on), and the `reportBug` function checks tokens itself, always.

### 3.4 The build's settings (do **not** commit yet: part 8)
- [ ] Copy `webapp/.env.example` to `webapp/.env.production` and fill in:
  ```
  VITE_FIREBASE_API_KEY=<apiKey from 3.1>
  VITE_FIREBASE_APP_ID=<appId from 3.1>
  VITE_FIREBASE_PROJECT_ID=meridian-web-a5829
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<key ID from 3.2>
  ```
  Committing this file is what switches the in-app form on for everyone, so it waits until the function works (part 8). The values are public (every visitor's browser gets them), which is why they live in a committed file and not in a CI secret.

---

## Part 4: Firestore, service account and secret (blocks Phase 2)

### 4.1 Create the Firestore database
It holds only the private contact emails.

- [ ] https://console.firebase.google.com/project/meridian-web-a5829/firestore → **Create database** → **Standard edition** → Database ID `(default)` → Location **`us-central1`** (beside the function; **it can't be changed later**) → **Start in production mode** → **Create**.
- [ ] Or: `gcloud firestore databases create --location=us-central1 --project $P`
- The rules (`firestore.rules`, deny every client) go up with the deploy in 6.2.

### 4.2 The function's own service account
The function runs as `report-bug@meridian-web-a5829.iam.gserviceaccount.com` (set in `functions/src/index.ts`), with only these roles: Firestore user, App Check token verifier (needed for replay protection), log writer, and (4.5) access to its one secret.

- [ ] Create it and grant the project roles:
  ```bash
  gcloud iam service-accounts create report-bug --display-name="Meridian reportBug function" --project $P
  for role in roles/datastore.user roles/firebaseappcheck.tokenVerifier roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding $P --member="serviceAccount:report-bug@$P.iam.gserviceaccount.com" --role="$role" --condition=None
  done
  ```
- [ ] Check:
  ```bash
  gcloud projects get-iam-policy $P --flatten='bindings[].members' --filter='bindings.members:report-bug@' --format='value(bindings.role)'
  ```
  Three roles.

### 4.3 The fine-grained GitHub token
- [ ] GitHub → your avatar → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
- [ ] Token name `meridian-bug-reports`. Description `Creates issues from Meridian's in-app bug report (reportBug function)`.
- [ ] **Resource owner**: `blueanvildesigns`. (If that's an organization rather than your user, the org may need to allow fine-grained tokens and approve this one: org → Settings → Personal access tokens.)
- [ ] **Expiration**: Custom, **90 days** from today. Put a reminder in your calendar a week before (rotation: 9.1).
- [ ] **Repository access**: **Only select repositories** → `blueanvildesigns/meridian`.
- [ ] **Permissions** → Repository permissions → **Issues: Read and write**. GitHub adds **Metadata: Read-only** itself. Nothing else (no Contents, no Pull requests, no account permissions).
- [ ] **Generate token** and copy it. You'll paste it once, in 4.5, and never need it again.

### 4.4 Delete contact emails after 180 days (TTL)
Each contact document carries `expireAt`, 180 days after the report.

- [ ] ```bash
  gcloud firestore fields ttls update expireAt --collection-group=bugReportContacts --enable-ttl --project $P
  ```
  Or the console: Firestore → **Time-to-live** → **Create policy** → Collection group `bugReportContacts`, Timestamp field `expireAt` → **Create**. Deletion isn't instant after the date passes. (Not tried: the command needs the database from 4.1.)

### 4.5 Store the token in Secret Manager
- [ ] From the repo root:
  ```bash
  firebase functions:secrets:set GITHUB_BUG_TOKEN --project $P
  ```
  Paste the token at the hidden prompt. (It never touches a file or your shell history.)
- [ ] Let the function's account read it:
  ```bash
  gcloud secrets add-iam-policy-binding GITHUB_BUG_TOKEN --member="serviceAccount:report-bug@$P.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor --project $P
  ```
  (The Firebase CLI may also grant this on deploy; doing it yourself is harmless.)
- [ ] Check without revealing it: `firebase functions:secrets:get GITHUB_BUG_TOKEN --project $P` lists one enabled version.

---

## Part 5: Before the first deploy (blocks Phase 2)

### 5.1 Let CI's Hosting deploys see the function
Once `firebase.json` rewrites `/api/report-bug` to a function, Hosting deploys look that function up. People report 403 errors from `action-hosting-deploy` without these read-only roles (GitHub issues on that action, not Firebase's docs). M0-23 removed broader versions of them; these two are viewer-only.

- [ ] ```bash
  for role in roles/cloudfunctions.viewer roles/run.viewer; do
    gcloud projects add-iam-policy-binding $P --member="serviceAccount:github-action-1116539194@$P.iam.gserviceaccount.com" --role="$role" --condition=None
  done
  ```
- If the PR preview deploy still fails with a permission error, its message names the missing permission; tell Claude.

---

## Part 6: Deploy (blocks Phase 2)

### 6.1 Check out the branch
- [ ] `git switch feat/bug-reporting` (or the PR's branch), then `npm --prefix functions ci`.

### 6.2 Deploy the function and the Firestore rules (by hand)
- [ ] From the repo root:
  ```bash
  firebase deploy --only functions,firestore:rules --project $P
  ```
  The predeploy hook lints and builds. If it asks for param values, the answers are in `functions/.env` (it shouldn't ask). If it offers to enable APIs, say yes.
- [ ] If it asks about an **Artifact Registry cleanup policy**, say yes and keep **1 day** of images (stops old images from slowly costing storage). Later: `firebase functions:artifacts:setpolicy --project $P`.
- [ ] If the build fails with a permission error about the **build service account**, grant the default compute account the builder role and deploy again:
  ```bash
  gcloud projects add-iam-policy-binding $P --member="serviceAccount:972119330859-compute@developer.gserviceaccount.com" --role=roles/cloudbuild.builds.builder --condition=None
  ```
- [ ] Check it's up and runs as its own account:
  ```bash
  gcloud functions describe reportBug --region us-central1 --project $P --format='value(state,serviceConfig.serviceAccountEmail,url)'
  ```
  Expect `ACTIVE`, `report-bug@…`, and a URL. `curl -i <that URL>` should answer **405** with `{"ok":false,"error":"method_not_allowed",…}`.

### 6.3 Merge Phase 2
The live site has no rewrite yet. Merging adds it (CI deploys Hosting); the form stays hidden until part 8.

- [ ] Open the PR. The **Deploy PR preview** job must pass (that proves 5.1). On the preview URL, the footer's **Report a bug** is still the GitHub link.
- [ ] Merge. Then:
  ```bash
  curl -i https://meridian.blueanvildesigns.io/api/report-bug
  ```
  Expect **405** JSON (the function, reached through Hosting). A 404 HTML page means the rewrite didn't deploy.

---

## Part 7: Smoke test on production (blocks Phase 2)

`functions/scripts/prod-smoke.sh` sends one real report with an App Check **debug token**, shows the issue, checks the email isn't in it and that a replayed token is refused, then deletes the issue and its contact document.

- [ ] Make a debug token: https://console.firebase.google.com/project/meridian-web-a5829/appcheck (left sidebar: **Security** → **App Check**) → **Apps** tab → the **⋮** at the far right of **Meridian Web**'s row (widen the window if it's cut off) → **Manage debug tokens** → **Add debug token** → name `prod smoke test` → **Generate token** → copy → **Save**.
- [ ] From the repo root, in any shell (the script is bash, but asks for the token itself, so elvish or fish work too):
  ```bash
  functions/scripts/prod-smoke.sh
  ```
  Paste the token at the prompt; nothing shows, which keeps it off your screen and out of your history. The script strips spaces, quotes and bracketed-paste markers a paste can bring along. It knows the web app's API key and app ID (public).
  Expect: a 201 with an issue number; the issue printed with label `bug` (then `needs-triage` from the workflow) and the line "The reporter left a contact email…" but no address; the replay refused with **401**; then answer `y` to delete.
- If step 1 says **403 "App attestation failed"**, App Check doesn't recognise the token: copy it again, or add a new one.
- [ ] Look at Firestore → `bugReportContacts` before you delete, if you want to see where emails land.
- [ ] **Delete the debug token** afterwards (same Manage debug tokens screen): anyone holding it can get App Check tokens.
- The script uses App Check's REST call `exchangeDebugToken` with `limitedUse: true`. Checked 2026-11-23: an unregistered token gets 403 "App attestation failed", so the call's shape, the app ID and the API key are right.
- **Open (first run, 2026-11-23):** the report and the email check passed, but **the replayed token was accepted** (201, issue #39) instead of refused. A request with no token gets 401, so App Check is enforced; it's consuming the token that didn't take. Don't do part 8 until this is understood.

---

## Part 8: Switch the in-app form on (Phase 2 goes live)

- [ ] Commit `webapp/.env.production` from 3.4 on a new branch, open a PR, merge. (On the preview the form appears but can't get a token unless you added the preview domain to the key in 3.2; it falls back to the GitHub link, which is itself worth seeing once.)
- [ ] On the live site: footer → **Report a bug** → the dialog. Type `Live test, please ignore`, untick nothing, press **Send report**.
  - Expect "Thanks! Your report is issue #N." with a link.
  - Open the browser console (F12) **before** pressing Send and check for **Content-Security-Policy** violations. reCAPTCHA under our CSP is untested with a real key; any violation lines tell Claude exactly which host or directive to add.
- [ ] Delete the test issue (`gh issue delete N -R blueanvildesigns/meridian`).

---

## Part 9: Running it

### 9.1 Rotate the GitHub token (every 90 days, or at once if it might have leaked)
1. [ ] Make a new token exactly as in 4.3 (name it `meridian-bug-reports-YYYY-MM`).
2. [ ] Store it as a new version: `firebase functions:secrets:set GITHUB_BUG_TOKEN --project $P` (paste the new one).
3. [ ] Redeploy so the function picks it up (Firebase: a function keeps the version it was deployed with): `firebase deploy --only functions --project $P`.
4. [ ] Send a test report (part 7 or 8) and delete the issue.
5. [ ] Revoke the old token: GitHub → Settings → Developer settings → Fine-grained tokens → the old one → **Delete**.
6. [ ] Optional tidy-up: `firebase functions:secrets:get GITHUB_BUG_TOKEN --project $P` shows versions; the CLI destroys unused versions on deploy by default.
7. [ ] Move the calendar reminder 90 days on.

### 9.2 Stop it quickly if it's being spammed (fastest first)
In every case the dialog shows "Your report wasn't sent" and offers GitHub's form, so users can still report.

1. **Seconds: revoke the GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens → `meridian-bug-reports` → **Delete**. No more issues can be created; the function answers 502. Undo: 9.1 steps 1 to 3.
2. **Seconds: close the endpoint.** Remove public access to the function's Cloud Run service (find its name with `gcloud run services list --project $P --region us-central1`; it's normally `reportbug`):
   ```bash
   gcloud run services remove-iam-policy-binding reportbug --region us-central1 --member=allUsers --role=roles/run.invoker --project $P
   ```
   Requests now get a 403 from Google before reaching the code. Undo: the same with `add-iam-policy-binding`.
3. **Minutes: the off switch.** Set `BUG_REPORT_ENABLED=false` in `functions/.env`, then `firebase deploy --only functions --project $P`. The function answers 503 ("switched off"). Commit the change so the next deploy doesn't undo it.
4. **Hide the form:** remove `webapp/.env.production` and merge; the footer goes back to the GitHub link.
5. **Remove it:** `firebase functions:delete reportBug --region us-central1 --project $P` (then the rewrite answers with an error; do 4 as well).

Tidying spam afterwards: `gh issue list -R blueanvildesigns/meridian --label needs-triage --search "Sent from the in-app bug report form in:body" --limit 100` lists in-app reports; `gh issue delete <n> -R blueanvildesigns/meridian --yes` removes each. The function's logs (Firebase console → Functions → reportBug → Logs) show refused requests by reason (`rate_limited`, `app_check_invalid`, `honeypot`, `global_cap`) without any report text.

### 9.3 Reading contact emails
Firebase console → Firestore → `bugReportContacts` → the document named after the issue number. Only project members can see it. Documents delete themselves 180 days after the report (4.4).
