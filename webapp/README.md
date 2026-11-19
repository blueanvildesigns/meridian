# Meridian Web

A world clock for planning across time zones. Keep a list of cities and see each one's time, day and offset at a glance. Jump to any moment to see it everywhere at once, and share that moment as a link.

Live at <https://meridian.blueanvildesigns.io>.

This is the web rewrite of the Meridian Flutter app. Spec: [`../docs/spec.md`](../docs/spec.md). Design: [`../docs/design-spec.md`](../docs/design-spec.md). Hosting and budgets: [`../docs/hosting-plan.md`](../docs/hosting-plan.md). Every decision made along the way: [`../docs/decisions-log.md`](../docs/decisions-log.md).

## Privacy

There are no accounts, no analytics, no cookies and no requests to anyone else's servers. Your cities and settings stay in this browser's local storage. A shared Jump link carries the moment in the part of the address after `#`, which browsers never send to a server.

## Browsers

Current Chrome, Edge, Firefox and Safari, on desktop and phone. Time math uses the browser's built-in Temporal. Safari doesn't have it yet, so Safari alone loads [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) (18 KB). Time zone rules come from the browser itself, so they're as current as the browser.

## Develop

Requires Node 26 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173
npm run check      # lint, format, typecheck, unit tests, build, e2e
```

| Command                          | What it does                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`                    | Vite dev server                                                                          |
| `npm run build`                  | Typecheck, then a production build in `dist/`                                            |
| `npm run serve`                  | Serves `dist/` on port 4173 with the headers, CSP and rewrites from `../firebase.json`   |
| `npm test`                       | Unit tests (Vitest). The time code runs twice: on native Temporal, then on the polyfill. |
| `npm run e2e`                    | Playwright against the production build, on Chromium, Firefox, WebKit and a phone        |
| `npm run lint`, `npm run format` | ESLint (strict type-checked, jsx-a11y), Prettier                                         |

E2E reuses a server already running on port 4173, so rebuild after changes (`npm run build`) or stop the server. First run: `npx playwright install chromium firefox webkit`. Playwright's WebKit needs Ubuntu's libraries; on other Linux distributions run the rest locally (`npx playwright test --project=chromium --project=firefox --project=mobile-chromium`) and rely on CI for WebKit. WebKit runs with Temporal removed, so it takes Safari's path through the polyfill.

## What the tests cover

- **Time:** conversions, skipped and repeated times, calendar days in each zone, and the old app's daylight-saving bugs (`src/time/`), on both Temporal implementations.
- **Accessibility:** WCAG contrast for every colour pair in both themes (`src/styles/contrast.test.ts`), and axe on every screen in both themes. A whole session with the keyboard alone, the Tab order and focus rings, reflow at 320 px, reduced motion, and the card text screen readers get (`e2e/a11y.spec.ts`).
- **Shipping:** the production CSP with no violations, no third-party requests, cache and security headers, the bundled licences (`e2e/hosting.spec.ts`, `e2e/shell.spec.ts`), the city data loaded only when Add city opens (`e2e/addCity.spec.ts`), and a size limit on that data (`src/cities/dataset.test.ts`).

## Layout

```
src/
  app/       the App, its state store and actions, the Jump address, theme
  time/      Temporal loading, conversion, formatting, wall-clock times, sunrise and sunset
  storage/   the saved-data schema, parsing, migrations
  cities/    the city dataset, search, zone data (data/ holds the generated files)
  ui/        components: clock cards, add-city, Jump, card menu, Settings, About, dialogs
  styles/    tokens (both themes), fonts, base styles
  text/      cleaning display names (rename, saved cities, Jump links)
  test/      fixtures shared by the unit tests
scripts/
  build-cities.ts        rebuilds the city data from GeoNames and OurAirports (see its header)
  serve-dist.ts          the local server that mirrors Firebase Hosting
  thirdPartyLicenses.ts  writes dist/third-party-licenses.txt at build time
e2e/                     Playwright specs
```

## Deploy

GitHub Actions (`../.github/workflows/webapp-ci.yml`) lints, tests and builds every pull request, then deploys it to a temporary Firebase preview link posted on the PR. Merging to `main` deploys the live site. Hosting settings, headers and the CSP are in `../firebase.json`.

## Credits and licence

Meridian is © 2026 Blue Anvil Designs, released under the [MIT licence](LICENSE).

- City data: [GeoNames](https://www.geonames.org/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Airport codes: [OurAirports](https://ourairports.com/), public domain.
- Fonts: IBM Plex Sans and Serif, under the SIL Open Font License 1.1, self-hosted.
- Code: React, dnd-kit and temporal-polyfill, all MIT. The build writes every bundled package's licence to `third-party-licenses.txt`, served next to the app.
