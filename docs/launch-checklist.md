# Meridian Web: launch checklist

Status: prepared at M7 (2026-11-19). **Launched 2026-11-19**: the owner did section 2's checks and said "launch", and the launch PR removed the noindex. The .com and .dev redirects (2.4) went live on 2026-11-20 and were checked (L-3). Making the repo public (2.5) is still the owner's to do. The gate itself is `docs/hosting-plan.md` section 8; this file says where each item stands and what's left, in order. Steps marked **Graham** are console, device or decision steps I can't do. Steps marked **Claude** are mine.

## 1. Where the gate stands

| Gate item | Status | Evidence |
|---|---|---|
| M0 to M5, plus the launch parts of M6 | Done | PRs 21 to 28 merged. M6 also built Rename and Jump from here. |
| About credits (GeoNames CC BY 4.0, OurAirports, MIT) | Done | `AboutDialog.test.tsx`, `e2e/settings.spec.ts` |
| Storage unavailable, unreadable data, unrecognised zone | Done | `e2e/clocks.spec.ts` (error states) |
| Card menu: Remove with Undo, Move up and down | Done | `e2e/menu.spec.ts`, `CardMenu.test.tsx` |
| Settings: time format and dark mode | Done | `e2e/settings.spec.ts` |
| Time-math suite with the old app's DST cases | Done | `src/time/**` tests, run on native Temporal and on the polyfill |
| Contrast, both themes | Done | `src/styles/contrast.test.ts`: every token pair, no exceptions (R-7) |
| axe on every screen, both themes | Done | Every spec in `webapp/e2e/`. `e2e/a11y.spec.ts` lists where each screen is checked. |
| Keyboard-only walkthrough | Done | `e2e/a11y.spec.ts` (a whole session by keyboard, Tab order, focus rings), plus a manual pass (M7-1) |
| One screen-reader pass | Done by the owner before launch (R-25) | Step 2.1 |
| Bundle within budget | Done | 101 KB Brotli initial JS against 300 KB. First visit 221 KB as sent. `docs/hosting-plan.md` section 3. |
| Safari, Chrome and Firefox, including the Temporal fallback | Done: CI, and real Safari by the owner (R-25) | Playwright runs Chromium, Firefox, WebKit without Temporal (Safari's path) and a phone on every PR. Step 2.2. |
| Blaze with a $5 budget alert (R-8) | Done by the owner (R-25) | Billing enabled on `meridian-web-a5829`, checked with `gcloud billing projects describe` on 2026-11-19. The budget itself I can't read from here. |
| Remove noindex | Done at launch | The launch PR (section 3). |

## 2. Graham's steps

### 2.1 Screen-reader pass (about 20 minutes)
Use VoiceOver on your iPhone (Settings > Accessibility > VoiceOver), on the M7 preview link or the live site. Swipe right to move through the page, double-tap to press. Anything that's confusing or wrong, tell me and I'll fix it before launch. If you have a Windows PC, NVDA with Firefox is a good second check, but it's optional.

1. **The page.** From the top you should hear: "Meridian, heading level 1", "Settings, button", "About Meridian, button", "Live. Showing the current time", "Jump to a time, button", "Add city, button", then "Your clocks, list".
2. **A card.** For each card: its name as a heading, "Day" or "Night", its country (or "Detected:" and your zone), the time, "Today" or "Tomorrow", then the date, zone and offset as separate words (for example "Tue, Nov 17, CST, UTC−6:00"), the difference, and "More options for …, button". Check the zone and offset aren't run together.
3. **Add city.** Double-tap "Add city". You should land in "Search cities". Type "london": the number of results is read out. Swipe to "London, England, United Kingdom" and double-tap: you should hear "London, England, United Kingdom, added." Close with the Close button or a two-finger scrub (a Z shape).
4. **Card menu.** On London, double-tap "More options for London". The menu reads its items ("Jump from here", "Rename", "Move up", …). Choose "Move up": you should hear "London moved to position 1 of 2."
5. **Remove and Undo.** Open the menu again and choose Remove: "London removed" is read. Find "Undo" (after the cards) and double-tap it: London comes back.
6. **Jump.** Double-tap "Jump to a time", change the time, and Apply. The banner is read: "Jumped …". Then "Reset to live".
7. **Settings.** The choices read as radio buttons ("12-hour, radio button, 2 of 3"). Changing one takes effect at once. Close with the scrub gesture.
8. **About.** The headings and links read sensibly.

### 2.2 Real Safari check (about 10 minutes)
On iPhone Safari, and Mac Safari if you have one: add New York, open Jump and try New York on 2027-03-14 at 2:30 AM (a skipped time: it should say so and offer 3:00 AM instead), use the card menu, switch Settings to Dark, open About. Real Safari has no Temporal, so this exercises the polyfill on Apple's own engine.

### 2.3 Blaze plan and the $5 budget alert (R-8)
Console labels change from time to time; follow the console if they differ from these.
1. In the Firebase console, open project `meridian-web-a5829`.
2. Click the gear next to Project Overview, then **Usage and billing**, then **Details & settings**, then **Modify plan**, and choose **Blaze**. Pick or create the billing account.
3. If the upgrade flow offers a budget, set it to **$5**. Either way, then open the Google Cloud console: **Billing** > **Budgets & alerts** > **Create budget**.
4. Scope: the project `meridian-web-a5829`. Amount: **$5** per month. Alert thresholds: 50%, 90% and 100% of actual spend, plus 100% of forecast. Email alerts to billing admins.
5. Save. A budget only warns; it never caps spending (hosting plan section 2).

### 2.4 Redirect the .com and .dev addresses (R-12)
Done 2026-11-20: both 301 to the .io address (L-3).

Only the `meridian` host on each domain. Never change an apex record or the marketing site.
1. Firebase console > **Hosting** > **Add custom domain**.
2. Enter `meridian.blueanvildesigns.com`. Tick the option to **redirect** it to an existing website, and choose `meridian.blueanvildesigns.io`.
3. The wizard shows the DNS records to add. Add exactly those, for the `meridian` host only, at the registrar for blueanvildesigns.com. Don't use values from anywhere else. If `meridian` already has A or CNAME records there, remove them first.
4. Repeat for `meridian.blueanvildesigns.dev`. (.dev only works over HTTPS, so that address won't load at all until Firebase's certificate is issued.)
5. Wait for the console to show both as connected (usually a few hours, up to 24). Then tell me, and I'll check each one redirects to the .io address.

### 2.5 Make the repo public, at launch
1. **Repo visibility.** It stays private until launch (M0-17). To make it public: GitHub > the repo > **Settings** > **General** > **Danger Zone** > **Change visibility**. I checked the history for keys and tokens and found none; the Firebase deploy key is a GitHub secret, not in the repo. Pull requests from forks never get the deploy key or a preview.
2. **The root README** is the first thing visitors see. The launch PR rewrites it for the web app, with a line saying the original Flutter app is still in the repo (R-27).

## 3. Launch (Claude, after section 2)
When you say "launch" (after section 2, R-25), I'll open one small PR that:
- removes the noindex meta tag from `webapp/index.html` and the comment above it,
- makes `webapp/public/robots.txt` allow everything,
- removes the `X-Robots-Tag` header from `firebase.json`,
- turns the pre-launch test in `e2e/hosting.spec.ts` into a check that the site is indexable,
- rewrites the root `README.md` for the web app: what it is, the live link, privacy, a pointer to `webapp/README.md`, and a line saying the original Flutter app is still in the repo (R-27). The Flutter app itself isn't touched.

The not-found page keeps its noindex. Preview links stay out of search: on Firebase's own `web.app` addresses Firebase adds `X-Robots-Tag: noindex` itself (M0-21).

Merging that PR deploys live. I'll then check the live site: headers, `robots.txt`, no noindex, Brotli, the CSP, and a clean console.

## 4. If something goes wrong after launch
Firebase console > **Hosting** > release history > **Roll back** on the previous release. Or tell me and I'll revert the commit on `main`, which redeploys.
