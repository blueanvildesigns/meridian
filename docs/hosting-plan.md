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

### Expected usage (my estimate, not measured)
- A first visit downloads the app JS, fonts and city data. Assuming about 2 to 3 MB compressed on a first visit and near zero after caching, 10 GB/month covers roughly 3,000 to 5,000 first visits. Measure the real size at M7 and update this.
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

## 4. Firebase configuration
Implemented in `/firebase.json` (repo root) at M0. Its headers and rewrites are mirrored locally by `webapp/scripts/serve-dist.ts`, and e2e runs against that. It was checked on a real preview channel too (M0-20, M0-21): the rewrite now covers only extensionless paths, and Firebase overrides `Strict-Transport-Security`. Decisions M0-12 to M0-16 and M0-20 to M0-21 in `docs/decisions-log.md`. Original outline:
- `public`: the Vite build output directory.
- Rewrite extensionless paths to `/index.html` (single-page app; Jump links use the URL hash). Missing files 404 (`public/404.html`).
- Headers:
  - `/assets/**`: `Cache-Control: public, max-age=31536000, immutable`
  - `/index.html` and `/`: `Cache-Control: no-cache`
  - Security headers: Content-Security-Policy (self only, plus whatever the build needs), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricting unused features. Test CSP against the production build.
- Add `robots.txt` and a `<meta name="robots" content="noindex">` until public launch.

## 5. Custom domain setup (one-time, Graham)
1. Create the Firebase project (can be linked to the existing Google Cloud account) and enable Hosting.
2. In the Hosting page, Add custom domain: `meridian.blueanvildesigns.io`.
3. The wizard shows the DNS records to add at your DNS provider: a TXT ownership record and the records pointing the subdomain at Firebase Hosting. Copy them exactly as shown; do not rely on values from tutorials.
4. Keep the TXT record in place permanently (Firebase uses it to renew the certificate).
5. Only change records for the `meridian` subdomain. Leave the apex `blueanvildesigns.io` and the existing marketing site alone.
6. If the subdomain has A or CNAME records pointing somewhere else, Firebase can't issue the certificate; remove those first.
7. Wait for verification and the certificate. Docs say up to 24 hours after DNS points to Firebase; usually a few hours. Start this early, in M0, so it is not on the critical path.
8. Redirect `meridian.blueanvildesigns.com` and `.dev` to the `.io` address (the wizard has a redirect option). **Decided 2026-11-18 (R-12): yes, both.** Same rule: only the `meridian` host on each domain.

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
  - Card menu: Remove with Undo, and Move up/down (the keyboard alternative to drag). Rename and Jump from here may follow in 1.1 (R-3).
  - Settings with time format and dark mode (may slip to a 1.1 release if time is short; decide at M5)
- Time-math test suite passes, including the old app's DST regression cases.
- Accessibility checks pass (contrast, axe, keyboard-only walkthrough).
- Built bundle size within the budget in section 3; real figures recorded here.
- Safari, Chrome and Firefox smoke-tested (including the Temporal fallback path).
- Blaze plan on, with the $5 budget alert in place (R-8).
- Remove noindex only at launch.

## 9. Order of work for hosting
- M0: Firebase project, domain connected and certificate issued, workflows generated, a placeholder page deployed to the real domain (noindex). This proves the pipeline early. **Done 2026-11-18** (PR 21; decisions M0-15 and M0-20 to M0-27).
- Each milestone: PR preview for review.
- M7: measure bundle and transfer, set the final headers, make the billing decision, run the launch gate, remove noindex, announce.

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
- ~~Whether to redirect the `.com` and `.dev` domains.~~ Yes, both (R-12); owner to set up.
- ~~Repo public from the start, or private until launch.~~ Private until launch (M0-17). GitHub Pages unpublished (M0-27).
- ~~Confirm sole authorship before the first public MIT release.~~ Confirmed (R-6).
