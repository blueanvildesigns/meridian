# Meridian Web: Master Spec

Status: design approved 2026-11-17. Visual details: `docs/design-spec.md`. Hosting and launch: `docs/hosting-plan.md`. Merged from `docs/archive/`. Baseline analysis: `docs/REVERSE_ENGINEERING.md`.

## 1. Product

A web world clock. A personal, reorderable list of places, each showing its current local time, plus Jump: pick a date and time in one place and see that moment in every place. Rewrite of the Flutter desktop app (Windows/macOS), which is retired once this ships.

## 2. Scope

- Feature parity with the desktop app; new visual design and UX. (2026-11-17-scope-and-data)
- No meeting-coordination features in this version.
- Jump gains a date picker (the one addition beyond parity). (2026-11-17-core-features)

## 3. Data and persistence

- Local-only, browser storage. No accounts, backend or sync. The one exception is an in-app bug report, sent only when the reporter presses Send (4.7).
- Storage schema is versioned so sharing or sync can be added later.
- Stored city = display name (user-editable) + IANA zone ID. A special "My Local Time" entry follows the device's zone.

## 4. Features

### 4.1 Clock list
- Cards for each city, live-updating, reorderable by drag, removable.
- Relative-day label (Today / Tomorrow / Yesterday / +N / -N) computed from calendar dates.
- Responsive grid of cards (one column on phones); an "Add a city" tile ends the grid. (2026-11-17-main-screen)
- Each card shows: city name (editable), country or detected zone, time, relative-day chip, date, zone abbreviation, UTC offset, and difference from the user's own time, plus drag handle and more-options button.
- Day/night cue: light card by day, dark card at night, plus a sun or moon icon and label (not colour alone). Night is determined by real sunrise and sunset from the city's coordinates. "My Local Time" needs a coordinate fallback (open).
- 12h/24h follows browser locale by default; the override lives in Settings (4.5), not the header. The header holds a gear button.
- Mockups: canvas "Meridian Web: Design Canvas" (desktop and phone artboards).

### 4.2 Add city (2026-11-17-add-city-search)
- Dialog on desktop, full-screen sheet on phone. Stays open after adding; added rows show "Added"; Done or Esc closes.
- Result row: city, state or region and country, current local time, UTC offset and abbreviation. Match tags (e.g. "Airport IST", "Time zone IST") explain non-name matches; zone queries show a header band.
- Matches city names, country names, time zone names and abbreviations, airport codes, and raw IANA IDs. Legacy IANA aliases hidden.
- Keyboard: Up/Down, Enter, Esc. Empty state with hints. GeoNames attribution in the dialog footer.
- Cities already in the list show as "Added" and are not added twice (proposed, to confirm).
- "My Local Time" can be re-added after removal.

### 4.3 Jump (2026-11-17-jump)
- Picker: popover on desktop, bottom sheet on phone. Fields: reference city, date, time, UTC equivalent; Cancel and Apply.
- Reference city is chosen in the picker (default My Local Time) or via "Jump from here" on a card.
- Active state: banner with date, time and reference city, clocks paused, Copy link, Change, Reset to live. Reference card is tagged "Jump reference".
- State is kept in the URL (copyable link); a reload without it returns to live. No backend.
- DST: a skipped time shows an inline alert with a one-click fix and Apply disabled until valid; a repeated time asks which occurrence (first preselected).
- Correct across DST changes: calendar-day arithmetic in the reference zone, never +24h; "now" never jumps ahead.
- Relative-day chip in Jump mode compares with My Local Time's date (proposed, to confirm).

### 4.4 Card menu (2026-11-17-card-menu)
- More-options menu per card: Jump from here, Rename, Move up, Move down, Remove. Popover on desktop, bottom sheet on phone (proposed). The drag handle remains for pointer reordering; Move up/down is the keyboard and screen-reader path.
- Rename is edit-in-place (Enter saves, Esc cancels, Save/Cancel buttons for touch). Only the display name changes.
- Remove is immediate with an Undo toast ("<City> removed", Undo). No confirmation dialog.
- Proposed, to confirm: Move up/down disabled at the ends of the list; "My Local Time" has the same menu; Undo restores the previous position; empty rename reverts.

### 4.5 Dark mode and Settings (2026-11-17-dark-mode-settings)
- Appearance follows the system by default, with a Light / Dark / System override.
- Dark palette is deep navy (page #0B1426, night cards #14213D, accent #8FB0FF). Day cards stay light but softened (#DCE6F7); night cards stay dark. The day/night cue is unchanged.
- Settings is a dialog behind a gear icon in the header (full sheet on phone). It holds Time format (Browser default / 12-hour / 24-hour) and Appearance (System / Light / Dark). Changes apply live and are saved in this browser.
- Mockups: canvas row "Dark mode and settings" (DarkMain, DarkMobile, interactive Settings).

### 4.6 About, empty list, error states (2026-11-17-small-screens)
- About: dialog on desktop, full sheet on phone, opened from an info button next to the gear. Shows Blue Anvil Designs credit, a Ko-fi support button, a "your data stays in this browser" note, GeoNames credit (CC BY 4.0), a note that zone rules come from the browser, and the MIT license line.
- Empty list: shown when no cities are saved. Heading "No clocks yet", primary "Add city", secondary "Use my local time". Jump is disabled until there is at least one city.
- Storage unavailable: a dismissible amber banner above the list. The app keeps working in memory; copy explains that cities and settings will be lost when the tab closes and links to a help explanation.
- Saved zone not recognized: that card shows a dashed amber state (no time) with "Choose a zone" (opens the add-city zone search) and "Remove". Other cards are unaffected. Never crash the list.
- Mockups: canvas rows "About", "Empty list", "Error states".

### 4.7 Bug reporting (2026-11-21-bug-reporting)
- "Report a bug" in the footer and in About ("Found a bug?"). Not drawn on any board; it copies the neighbouring link and section styles.
- It opens GitHub's bug report form (`.github/ISSUE_TEMPLATE/bug_report.yml`) in a new tab with a Diagnostics field filled in: app version and commit, user agent, OS name, IANA time zone, time format setting, locale. Never saved cities or anything else from storage. Links are capped at 2,000 characters.
- Nothing is sent until the reporter submits on GitHub, where every field is visible and editable. Issues are public, and the form says so.
- New issues get `needs-triage` and a short thank-you comment from `.github/workflows/issue-triage.yml`.
- **In-app form (phase 2)**, when the build has the Firebase settings (`webapp/.env.example`); otherwise the GitHub link above. "Report a bug" opens a dialog (full sheet on phones): What went wrong (required, 2,000 characters), Steps to reproduce (optional, 2,000), Email (optional, private), and "Include diagnostics" (ticked by default) showing the exact text sent. A standing note says issues are public. Hidden honeypot field. Success shows the issue number and link; failure offers GitHub's form with what was typed filled in.
- Send loads Google reCAPTCHA Enterprise through Firebase App Check (a lazy chunk; nothing loads before Send) and posts to `/api/report-bug`, the `reportBug` function. It checks origin, size, a per-address limit, the App Check token (limited use, consumed, and good for one request by the function's own record in Firestore `usedAppCheckTokens`), the fields, and a global cap, then creates the issue with a fine-grained token from Secret Manager. Every user field is in a code block. The email never goes in the issue; it's kept in Firestore `bugReportContacts/{issue}` (no client access, deleted after 180 days by a TTL policy).

## 5. Platform

- Time zone rules from the browser's `Intl`/Temporal support; no bundled tzdata.
- Dropped from desktop: title bar, tray, always-on-top, window opacity, acrylic, window-position persistence.

## 6. Branding, license, migration (2026-11-17-migration-license-branding)

- Branding: Blue Anvil Designs branding, Ko-fi link and an About page carry over. The web app does not replace the existing marketing site.
- License: relicense to a permissive license (MIT unless changed); first confirm sole authorship.
- Migration: none. Fresh start for existing users.

## 7. Stack and hosting (2026-11-17-stack-and-hosting)

- React + TypeScript + Vite; static SPA. The only backend is the bug report function (4.7): Cloud Functions for Firebase (2nd gen) in `functions/`, behind the Hosting rewrite `/api/report-bug`.
- Time math: Temporal (native where available, polyfill otherwise). Zone rules from browser `Intl`.
- City data: GeoNames subset bundled as static JSON with aliases; attribution on the About page.
- Repo: GitHub (stays). License: MIT.
- Hosting: Firebase Hosting at `https://meridian.blueanvildesigns.io`, deployed by GitHub Actions (PR previews, live on merge to `main`). Costs, config, DNS steps, launch gating: `docs/hosting-plan.md`.

## 8. Open questions

Most of these are now settled; see `docs/decisions-log.md` (owner rulings R-1 to R-13, 2026-11-18).


- Spark vs Blaze billing plan for launch; redirects for the .com/.dev domains; repo public or private until launch (see `docs/hosting-plan.md`).
- Safari Temporal status and polyfill choice.
- GeoNames filter threshold and alias source.
- Airport-code dataset (IATA) source and license; result ranking and result cap.
- Jump URL format and handling of a reference city missing from the recipient's list; real date and time input controls.
- Undo toast duration; rename validation (empty name, max length).
- Whether the old app still builds on Windows/macOS (only matters for a side-by-side reference).
- Test strategy for time math (the old app's probe cases are a ready-made regression set).
