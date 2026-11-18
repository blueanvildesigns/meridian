# Decisions log

Implementation decisions for Meridian Web, newest milestone last. Each entry says where it came from:
- **Owner**: Graham decided.
- **Default**: Claude picked it for a "proposed, to confirm" or open item. Graham can overrule it.
- **Found**: forced by something discovered during implementation.

Status is **Confirmed** or **Pending** (awaiting the owner).

The spec (`docs/spec.md`) and design spec (`docs/design-spec.md`) win over this log unless an entry explicitly supersedes them.

## Plan-stage decisions (2026-11-18)

### Canvas vs design-spec rulings
| ID | Decision | Source | Status |
|---|---|---|---|
| C1 | Clock digits 40px (design-spec), not 44px (canvas Main/DarkMain). The newer canvas boards (ErrorStorage) already use 40. | Default | Pending |
| C2 | Day icon #8A4200 and night icon #F2C078 (design-spec), not #B45309 / #C9D8FF (canvas Main). The newer boards already match design-spec. | Default | Pending |
| C3 | Jump banner uses canvas JumpActive colours: bg #FFF4E5, border #B45309, text #7A3A00. The storage banner uses the warn tokens. | Default | Pending |
| C4 | Light-mode chip colours and night-card line taken from canvas: day chip #E6ECFF/#1D3AB0, night chip #27386A/#D2E1FF, night line #2C3C63. | Default | Pending |
| C5 | Footer per canvas: "Meridian is a Blue Anvil Designs project." plus About and Support on Ko-fi. | Default | Pending |
| C6 | Jump reference tag: #2F4BD0 pill with white text, plus a 2px #2F4BD0 card border (canvas). | Default | Pending |
| C7 | Page container max-width 1240px, padding 28px top and 32px sides (16px on phones). | Default | Pending |

### Behaviour defaults
| ID | Decision | Source | Status |
|---|---|---|---|
| D1 | "Your own time and date" is always the **device zone**, whether or not My Local Time is on the list or renamed. Live chips say Today / Tomorrow / Yesterday / +N / −N. Jump chips say Same day / Next day / Previous day, compared with the device-zone date at the jumped instant. | Default | Pending |
| D2 | Stored city schema v1: `{id, kind: 'place'\|'local'\|'zone', name, originalName, zone, geonameId?, country?, admin1?, lat?, lon?}`. Place data is copied in at add time. | Default | Pending |
| D3 | De-duplicate by GeoNames place, one My Local Time, and one entry per bare zone. Two cities in the same zone are allowed. | Default | Pending |
| D4 | Bare IANA zones (e.g. `UTC`) can be added. The card subtitle shows the zone. | Default | Pending |
| D5 | Day/night = solar elevation above −0.833° at the displayed instant (in-house NOAA algorithm). This covers polar day and night with no special cases. My Local Time and bare zones use the most populous dataset city in that zone, with no geolocation prompt. A zone with no city uses 06:00–18:00. | Default | Pending |
| D6 | Legacy zone IDs reported by the browser are normalised through a small alias map. Which engines report them is unverified; it will be tested on all engines. | Default | Pending |
| D7 | Zone abbreviation comes from `Intl` using the city's country locale (`en-IN` → IST), falling back to en-US. If only a GMT±… form is available, it's omitted (the offset is shown anyway). | Default | Pending |
| D8 | Abbreviation search uses a curated abbreviation → zones table, with long names from `Intl`. Ambiguous abbreviations show one header band per zone. | Default | Pending |
| D9 | Raw IANA search covers the zones in the GeoNames set plus `UTC`, not `Intl.supportedValuesOf`. That keeps legacy aliases hidden. | Default | Pending |
| D10 | Clocks tick on minute boundaries, with no seconds, and resync on `visibilitychange`. | Default | Pending |
| D11 | Jump state lives in the URL hash: `#at=<UTC instant>&ref=<IANA>&name=<label>`. Apply uses pushState, Change uses replaceState, and a malformed hash means live mode. If the reference isn't in the recipient's list, the banner names it and no card is tagged. | Default | Pending |
| D12 | The Jump "Time is in" list has My Local Time first and as the default (even if its card was removed), followed by your cities. Jump is disabled when the list is empty. | Default | Pending |
| D13 | Add-city shows a My Local Time row when it's missing from the list (on an empty query, or when the query matches "local"). | Default | Pending |
| D14 | "Choose a zone" replaces the unrecognised entry in place. A custom name is kept only if the user had renamed it. | Default | Pending |
| D15 | Undo toast: 8 s, replaced by a newer removal, restores the original position, no global shortcut. Rename: trimmed, max 60 characters, an empty name reverts to the original. Move up/down are disabled at the ends. My Local Time gets the same menu. | Default | Pending |
| D16 | Jump date uses a native `<input type="date">`. Time uses a custom hour/minute(/AM-PM) field, because native time inputs ignore the app's 12/24 setting. | Default | Pending |
| D17 | Search ranking: exact name, then prefix, then alias, then country, then zone. Ties break by population, and results are capped at 50. Airport matching is built but has no data until the licence is confirmed. | Default | Pending |
| D18 | GeoNames subset `cities15000` plus capitals, lazy-loaded when the add-city dialog opens. Target ≤400 KB gzipped. | Default | Pending |
| D19 | Storage: a single localStorage key `meridian` holding `{schemaVersion, cities, settings}`, with migrations. Corrupt data is set aside under a backup key. If storage is unavailable, the app runs in memory and shows the banner, whose help link opens About > Your data. | Default | Pending |
| D20 | Card subtitle shows the country only. My Local Time shows "Detected: <zone>". Search rows show region and country. | Default | Pending |
| D21 | About version = `package.json` version plus short git SHA. The site URL is a placeholder until hosting is decided. The Ko-fi URL `https://ko-fi.com/grahamtholomew` is taken from the old `index.html`. | Default | **Pending: confirm the Ko-fi URL** |
| D22 | First run with nothing saved shows the empty state. | Default | Pending (plan question 4) |
| D23 | New code lives in `webapp/` (Flutter claims `web/`). | Default | Pending (plan question 1) |

## M0: scaffold (2026-11-18)

| ID | Decision | Source | Status |
|---|---|---|---|
| M0-1 | Toolchain pinned to exact versions: Vite 8.3.8, React 19.3.1, TypeScript **6.0.3** (`typescript-eslint` 8.73 supports TypeScript <6.1, so not 7.0), Vitest 5.1.1, Playwright 1.65.1, Node 26 (`.nvmrc`). npm, since it's the only package manager installed. `save-exact` is set in `.npmrc`. | Found | Confirmed |
| M0-2 | ESLint **10** with `eslint-plugin-jsx-a11y` 6.10.2 forced past its `eslint ^9` peer range via an npm `overrides` entry. ESLint 9 now installs with "no longer supported". Verified that jsx-a11y rules still fire under ESLint 10 (`alt-text`, `click-events-have-key-events`, `no-static-element-interactions`). Remove the override once jsx-a11y declares ESLint 10 support. | Found | Confirmed |
| M0-3 | Theme pre-paint: a single source, `src/app/themeBoot.ts`. Its `THEME_BOOT_SCRIPT` string is inlined first in `<head>` by a Vite plugin, and unit tests execute the same string. The M7 CSP will need this script's hash. | Default | Confirmed |
| M0-4 | Tokens live in `src/styles/tokens.css` (light on `:root`, dark on `[data-theme='dark']`). `src/styles/contrast.test.ts` parses that file and checks 36 foreground/background pairs per theme against WCAG AA (4.5:1 text, 3:1 UI). | Default | Confirmed |
| M0-5 | **Contrast exception:** the design-spec's pinned `warn-accent` #C58A1B (dashed border of the unrecognised-zone card) measures **2.66:1** on the page colour, below 3:1. It's kept because the state is also conveyed by text and an icon, so WCAG 1.4.11 treats the border as decorative. The test pins the ratio. If you want ≥3:1, a darker amber such as #A86F0C would be needed. | Found | **Pending: owner to confirm or pick a darker amber** |
| M0-6 | Derived dark colours (not in any mockup), all passing AA. Warn: bg #3B2C0B, border #C58A1B, text #FFE7B0, icon #F2C078, link #9DB8FF, accent #E3B341. Jump: bg #3A2508, border #E59A4A, text #FFDDB3. Reference tag #8FB0FF with #0B1426 text. Disabled: #2C3C63 / #B9C6E0. | Default | Pending |
| M0-7 | Focus ring: 2px outline in `--focus` (#1D3AB0 light, #8FB0FF dark), offset 2px. Cards supply their own ring colour (`--day-focus` / `--night-focus`) so it stays ≥3:1 on dark cards in the light theme. | Default | Confirmed |
| M0-8 | Fonts are self-hosted from `@fontsource` (OFL 1.1), Latin and Latin Extended subsets: Serif 500/600, Sans 400/500/600. The e2e test checks that the font loads and that no cross-origin request is made. | Default | Confirmed |
| M0-9 | E2E runs against the production build (`vite build` + `vite preview`), on Chromium, Firefox, WebKit and mobile Chromium. **WebKit can't run locally on CachyOS:** Playwright's Ubuntu WebKit build needs `libicu74`, and the Docker fallback failed because the Docker daemon couldn't resolve `mcr.microsoft.com`. WebKit is covered by CI on Ubuntu. | Found | Confirmed |
| M0-10 | CI is `.github/workflows/webapp-ci.yml`, path-filtered to `webapp/**`, `docs/**` and itself, with jobs check (lint, format, typecheck, unit, build, bundle-size summary) and e2e. The existing `build_mac.yaml` is left untouched (plan question 3). | Default | Pending |
| M0-11 | No `webapp/LICENSE` yet. It waits on confirmation that both git identities are the owner (plan question 5). | Default | Pending |
