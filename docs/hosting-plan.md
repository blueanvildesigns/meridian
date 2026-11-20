# Meridian Web: Hosting and Deployment Plan

Status: planned 2026-11-18. Part of the design plan; behaviour lives in `docs/spec.md` section 7.

## 1. Decisions
- Repo stays on GitHub. License: MIT, copyright Blue Anvil Designs (sole authorship confirmed 2026-11-18, decision R-6).
- Hosting: Firebase Hosting (Google's infrastructure, part of the user's GCP/Firebase account).
- Live URL: `https://meridian.blueanvildesigns.io` (domain already purchased).
- Deploys: GitHub Actions. Every PR gets a temporary preview URL; merging to `main` deploys live.
- No backend, no database, no Firebase services other than Hosting.

## 2. Costs
Verified against Firebase's Hosting quota and pricing page (checked 2026-11-18). Re-check before launch; prices change.

| | Spark (free, no card) | Blaze (pay as you go) |
|---|---|---|
| Hosting storage | 10 GB. At the limit you can't deploy until you delete old releases. | 10 GB free, then $0.026 per extra GB |
| Data transfer | 10 GB/month. At the limit there is a short grace period, then the site is disabled until the next month. | 10 GB/month free, then $0.15 per extra GB |

- Custom domain and SSL certificate: the official quota page does not list any charge for these, and the setup docs describe the certificate as provisioned and renewed automatically. A third-party tutorial says it is free. Treat it as no extra cost, and confirm on the Hosting usage page after setup.
- Domains: already paid for (registrar renewal fees apply, outside Firebase).
- Preview channels: no per-channel charge is listed. Each site is limited to 50 channels including live, and previews expire (7 days by default). Hosting storage and transfer quotas are per project, not per channel, so previews count toward the 10 GB.
- Budget alerts (Google Cloud console) notify but do not cap spending.

### Expected usage (measured at M7, 2026-11-19)
- A first visit sends **221 KB**: the page, the app's JS and CSS, and five font files (sizes in section 3). Opening Add city adds the city data, **316 KB**, for **537 KB** in all. Safari adds the 18 KB Temporal polyfill.
- After that, everything but `index.html` is cached for a year, and `index.html` is revalidated (a few hundred bytes when nothing changed). A new release sends only the files whose hash changed.
- So 10 GB/month covers roughly **18,000 new visitors** who add a city (or about 45,000 who don't), plus repeat visits at almost nothing each. PR previews count toward the same quota, but each is one reviewer. The earlier guess was 3,000 to 5,000.
- Cost if the free transfer is exceeded on Blaze: about $1.50 per extra 10 GB. A very busy month of 100 GB extra would be about $13.50.

### Spark or Blaze
- Spark: guaranteed $0, but fails closed (site goes down if the monthly limit is hit) and cannot be extended without upgrading.
- Blaze: same free quota, no card-free option, fails open (you pay if traffic is high). A cost-limit can't be set natively; budget alerts only warn.
- Plan: start on Spark for development and the placeholder site. **Decided 2026-11-18 (R-8): Blaze with a $5 budget alert**, switched on before launch, because an outage on a busy day is worse than a few dollars, and the app is cache-friendly. The alert is mandatory.

## 3. Keep traffic and cost low (requirements for the build)
- Static assets served with Brotli/gzip (Firebase compresses automatically; verify).
- Hashed asset filenames with long immutable cache headers; `index.html` always revalidated.
- City data as a separate, compact file (target under 1.5 MB compressed), loaded when needed and cached. Consider loading it lazily on first Add city or search. Done at M2: hashed asset, fetched on first use (M2-10).
- Fonts self-hosted, subset to Latin where possible, `font-display: swap`.
- JS budget: under 300 KB compressed for the initial route (excluding the Temporal polyfill when native Temporal exists). Load the polyfill only when needed.
- No analytics or third-party calls (also a product decision).

### Measured sizes
| Milestone | Initial JS (gzip / Brotli) | CSS (gzip) | Fonts on first visit | City data | Notes |
|---|---|---|---|---|---|
| M0 (2026-11-18) | 69.2 KB / 59.4 KB | 2.1 KB | about 113 KB (Latin woff2, 5 weights) | none yet | Shell only: React plus header and footer. Budget: 300 KB JS. |
| M2 (2026-11-18) | 69.8 KB gzip (no new imports; the M2 modules are wired in at M3/M4) | 2.1 KB | unchanged | **393 KB gzip / 294 KB Brotli** (943 KB raw), lazy-loaded as `/assets/cities.v1-<hash>.json` with immutable caching. Bundled zone file: 6.9 KB gzip. | 12,481 places (50,000+ people, capitals, one per zone) with 20,786 aliases (decisions M2-3, M2-4, M2-10). Meets D18's 400 KB target; a unit test fails past 450 KB gzip. Brotli measured locally at quality 11; Firebase's level is unverified. |
| M3 (2026-11-18) | **99.8 KB / 86.3 KB** (312 KB raw), plus the Temporal polyfill only where Temporal is missing (Safari): 19.3 KB / 17.5 KB | 4.2 KB | unchanged | unchanged (not fetched until add-city, M4) | Clock list live: dnd-kit for reordering (M3-6) and the bundled zone table now in the initial bundle. About a third of the 300 KB budget. |
| M4 (2026-11-18) | **108.1 KB / 92.1 KB** (332 KB raw), plus the polyfill where Temporal is missing (unchanged) | 5.4 KB | unchanged | **423 KB gzip / 316 KB Brotli** (1,018 KB raw), fetched when add-city first opens | Add city live: the search, dataset decoding and dialog join the initial bundle (M4-12). The dataset gains 2,690 airport codes and 488 airport towns (M4-1, M4-2), passing D18's ~400 KB target in gzip. Firebase serves it as Brotli, 316,179 bytes on the live site (checked 2026-11-19, the same as the local quality-11 figure), and the target is now measured as sent (R-14). |
| M5 (2026-11-19) | **115.0 KB / 97.8 KB** (352 KB raw), plus the polyfill where Temporal is missing (unchanged) | 7.0 KB | unchanged | unchanged | Jump live: picker with its time list, banner and URL-hash state in the initial bundle, no new dependencies (M5-11). |
| M6 (2026-11-19) | **119.3 KB / 101.3 KB** (367 KB raw), plus the polyfill where Temporal is missing (unchanged) | 8.3 KB | unchanged | unchanged | Card menu, rename, Undo toast, Settings and About in the initial bundle, no new dependencies (M6-13). Still well under the 300 KB budget. |
| M7 (2026-11-19) | **119.3 KB / 101.2 KB** (367 KB raw), plus the polyfill where Temporal is missing: 19.7 KB / 17.5 KB | 8.3 KB (7.4 KB Brotli) | **112 KB** (5 Latin woff2). Until M7 it was about 190 KB: all ten files, Latin Extended too, loaded on every first visit (M7-2). | unchanged: 316 KB Brotli, on first add-city | **A first visit sends 221 KB** (was 301 KB before M7-2), **537 KB with the city data.** Measured file by file from the requests a first visit makes, as Firebase sends them: Brotli for text, woff2 as is. Also new: `third-party-licenses.txt`, 2 KB Brotli, fetched only if someone opens it (M7-3). |

## 4. Firebase configuration
Implemented in `/firebase.json` (repo root) at M0. Its headers and rewrites are mirrored locally by `webapp/scripts/serve-dist.ts`, and e2e runs against that. It was checked on a real preview channel too (M0-20, M0-21): the rewrite now covers only extensionless paths, and Firebase overrides `Strict-Transport-Security`. Decisions M0-12 to M0-16 and M0-20 to M0-21 in `docs/decisions-log.md`. Original outline:
- `public`: the Vite build output directory.
- Rewrite extensionless paths to `/index.html` (single-page app; Jump links use the URL hash). Missing files 404 (`public/404.html`).
- Headers:
  - `/assets/**`: `Cache-Control: public, max-age=31536000, immutable`
  - `/index.html` and `/`: `Cache-Control: no-cache`
  - Security headers: Content-Security-Policy (self only, plus whatever the build needs), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricting unused features. Test CSP against the production build.
- Add `robots.txt` and a `<meta name="robots" content="noindex">` until public launch. **Removed at launch (2026-11-19, R-25)**; the not-found page keeps its noindex.
- **Final at M7 (M7-6):** the headers above stay as they are. Only the three noindex pieces change, in the launch PR (`docs/launch-checklist.md` section 3).

## 5. Custom domain setup (one-time, Graham)
1. Create the Firebase project (can be linked to the existing Google Cloud account) and enable Hosting.
2. In the Hosting page, Add custom domain: `meridian.blueanvildesigns.io`.
3. The wizard shows the DNS records to add at your DNS provider: a TXT ownership record and the records pointing the subdomain at Firebase Hosting. Copy them exactly as shown; do not rely on values from tutorials.
4. Keep the TXT record in place permanently (Firebase uses it to renew the certificate).
5. Only change records for the `meridian` subdomain. Leave the apex `blueanvildesigns.io` and the existing marketing site alone.
6. If the subdomain has A or CNAME records pointing somewhere else, Firebase can't issue the certificate; remove those first.
7. Wait for verification and the certificate. Docs say up to 24 hours after DNS points to Firebase; usually a few hours. Start this early, in M0, so it is not on the critical path.
8. Redirect `meridian.blueanvildesigns.com` and `.dev` to the `.io` address (the wizard has a redirect option). **Decided 2026-11-18 (R-12): yes, both.** Same rule: only the `meridian` host on each domain. **Live 2026-11-20:** one CNAME each, `meridian` to `meridian-web-a5829.web.app`, and both 301 to the `.io` address (L-3).

## 6. CI/CD (GitHub Actions)
Implemented as the `deploy-preview` and `deploy-live` jobs in `.github/workflows/webapp-ci.yml` (M0-15). Firebase project `meridian-web-a5829`. Original outline:
- Run `firebase init hosting:github` from the repo root. It creates a service account, stores its key as a GitHub secret, and writes two workflows:
  - on pull request: build, test, deploy to a preview channel and comment the URL on the PR
  - on merge to `main`: build, test, deploy to live
- Edit the generated workflows so build, lint, unit tests and the accessibility checks run before deploy. Deploy only if they pass.
- The action is Firebase's own open-source `FirebaseExtended/action-hosting-deploy`; pin it to a version.
- Preview URLs are public but unlisted; they use the same static files, so there is no data exposure, but keep them out of search (noindex).
- Rollback: Firebase keeps previous releases; roll back in the console, or redeploy the previous commit.

## 7. Environments
- Local dev: Vite dev server.
- Preview: per-PR channel.
- Live: `meridian.blueanvildesigns.io`.
- No staging site needed for MVP.

## 8. Launch gating (MVP)
Go live when all of the following are true:
- Milestones M0 to M5 done (clock list, add city, Jump), plus the minimum of M6 that launch requires:
  - About page with the GeoNames CC BY 4.0 credit and MIT notice (attribution is a licence requirement)
  - Storage-unavailable and unrecognized-zone handling (so a failure never breaks the page)
  - Card menu: Remove with Undo, and Move up/down (the keyboard alternative to drag). Rename and Jump from here may follow in 1.1 (R-3); M6 builds them too.
  - Settings with time format and dark mode (built in M6)
- Time-math test suite passes, including the old app's DST regression cases.
- Accessibility checks pass (contrast, axe, keyboard-only walkthrough).
- Built bundle size within the budget in section 3; real figures recorded here.
- Safari, Chrome and Firefox smoke-tested (including the Temporal fallback path).
- Blaze plan on, with the $5 budget alert in place (R-8).
- Remove noindex only at launch. **Done 2026-11-19.**

Where each item stands, and the remaining steps in order: `docs/launch-checklist.md`.

## 9. Order of work for hosting
- M0: Firebase project, domain connected and certificate issued, workflows generated, a placeholder page deployed to the real domain (noindex). This proves the pipeline early. **Done 2026-11-18** (PR 21; decisions M0-15 and M0-20 to M0-27).
- Each milestone: PR preview for review.
- M7: measure bundle and transfer, set the final headers, make the billing decision, run the launch gate, remove noindex, announce. **Measured and headers settled 2026-11-19 (PR 29).** The billing switch, the screen-reader pass, the redirects and the launch PR follow `docs/launch-checklist.md`. **Launched 2026-11-19** (noindex removed, root README rewritten for the web app).

## 10. Risks
| Risk | Mitigation |
|---|---|
| Certificate delay blocks launch | Do domain setup in M0 |
| Free transfer exceeded | Cache headers, small bundle, budget alert; site dark on Spark vs billed on Blaze (decision above) |
| City data too large | Compact format, lazy load, compression; measure at M2 |
| Preview deploys leak unfinished work | noindex, unlisted URLs; repo may be private until launch |
| Misconfigured CSP breaks the app | Test the production build with CSP on before launch |
| Service account key in GitHub | Use the CLI-generated secret; limit the account to Hosting deploy role |

## 11. Open items
- ~~Spark vs Blaze.~~ Blaze with a $5 alert, before launch (R-8).
- ~~Whether to redirect the `.com` and `.dev` domains.~~ Yes, both (R-12); live since 2026-11-20 (L-3).
- ~~Repo public from the start, or private until launch.~~ Private until launch (M0-17), public since 2026-11-19 (L-4). GitHub Pages unpublished (M0-27).
- ~~Confirm sole authorship before the first public MIT release.~~ Confirmed (R-6).
