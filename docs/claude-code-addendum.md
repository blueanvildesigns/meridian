# Addendum to the Meridian build prompt (2026-11-18)

New decisions since the first prompt. They override anything in the earlier prompt or older docs that conflicts. They are already in the repo's `docs/` folder (uncommitted), so re-read `docs/spec.md` section 7, `docs/hosting-plan.md` (new) and `docs/design-spec.md` section 8 before you plan.

## Changes
1. Repo stays on GitHub. License is MIT. Use `gh` and GitHub PRs. (I still need to confirm sole authorship before the first public release.)
2. Hosting is Firebase Hosting at `https://meridian.blueanvildesigns.io`, deployed with GitHub Actions: a preview channel per PR, live on merge to `main`. Details, costs, headers and DNS steps are in `docs/hosting-plan.md`. This replaces "my GCP setup".
3. I want to go live as soon as there is a working MVP. MVP = M0 to M5 plus the launch-required parts of M6, as defined in `docs/hosting-plan.md` section 8. Not all of M6 has to ship first.
4. M0 now includes the hosting pipeline: Firebase project, `firebase init hosting:github` workflows with build, lint and tests before deploy, and a noindex placeholder page on the real domain. The domain and certificate can take up to 24 hours, so this goes first. I will do the Firebase console and DNS steps myself; give me exact, numbered instructions and tell me which values to copy from the Firebase wizard. Do not guess DNS values.
5. Size budgets are requirements (free tier is 10 GB/month transfer): initial JS under about 300 KB compressed, city data compact and lazy-loaded (target under about 1.5 MB compressed), self-hosted subset fonts, hashed assets with immutable caching and an uncached `index.html`. Measure at M2 and M7 and record the real numbers in `docs/hosting-plan.md`.
6. Add security headers and a CSP in `firebase.json`; test the CSP against the production build.
7. Do not point or change anything on the apex `blueanvildesigns.io` domain or the existing marketing site. Only the `meridian` subdomain.

## Open items (pick a default, log it in `docs/decisions-log.md`, tell me)
- Spark vs Blaze billing: I decide before launch. Plan for the budget-alert path either way.
- Redirecting meridian.blueanvildesigns.com and .dev to the .io address.
- Repo public or private until launch. Assume private until I say otherwise, and keep preview URLs noindex.

## What I want back
Fold this into your reply to the first prompt: update your milestone plan (especially M0 and the launch gate), list any conflicts between these changes and the docs, and give me the M0 hosting instructions as a short checklist. Still no code until I approve the plan.
