# Meridian Web: Roadmap after launch

Status: draft, 2026-11-23. Nothing here is decided. Each release starts with a design interview, and the answers become dated decision files in `docs/archive/` and edits to `docs/spec.md`, the same process as the first build.

Written from the docs (`spec.md`, `design-spec.md`, `decisions-log.md`, `launch-checklist.md`, and the Jump and scope decision files), not from the code. The first step of every milestone is to check the code for what already exists.

## 1. Where things stand

Launched 2026-11-19 (M0 to M7, then bug reporting). Relevant facts for what comes next:

- **Jump already shares a moment.** State lives in the URL hash (`#at=<UTC>&ref=<IANA>&name=<label>`, D11, M1-7, M5-1), with Copy link, Back/Forward history (M5-7) and DST handling. So "shareable links" is mostly done. What's missing is sharing a *set of cities*.
- **Meeting-coordination features are explicitly out of scope** for v1 (spec 2; the scope decision names "people, working hours, overlap, suggested times"). Releases 3 and 4 below need an owner ruling to lift that.
- **Storage is local-only and versioned** (spec 3, M2-2). The migration registry is empty at v1; a newer-schema tab reads but never writes; unreadable data is backed up to `meridian.backup`. Anything that changes stored data needs a schema v2 and a migration.
- **Constraints every milestone must keep:** initial JS under 300 KB Brotli (101 KB today, hosting plan section 3); same-origin CSP with no `unsafe-inline` (M0-14); a time-math suite that runs on native Temporal and on the polyfill; contrast test over every token pair (R-7); axe on every screen in both themes; every pointer gesture has a keyboard path; meaning is never carried by colour alone.

## 2. How each feature fits the spec

| Feature | Spec sections touched | Design-spec additions | Data change |
|---|---|---|---|
| Copy as text | 4.3 (Jump banner) | One button, one toast | None |
| Add to calendar | 4.3 | Small dialog (title, duration), buttons | None |
| DST heads-up | 4.1 (card), 4.3 (banner) | A chip or line on cards; amber tone, so needs a dark-mode derivation | None |
| Export / import | 3, 4.5 (Settings gets a Data section) | Settings rows, import result dialog | Reads and writes the v-current schema |
| Saved lists | 3, 4.1 (header), 4.4 | List switcher, manage-lists dialog, empty state per list | Schema v2 |
| Shared list links | 4.3 (URL), 4.1 | "Viewing a shared list" banner, Save to my lists | None, but extends the hash format |
| Working hours | 2, 3, 4.5, 4.4 | Settings rows, per-city card-menu item | Schema v2 field (see M11) |
| Find a time | 2, 4 (new 4.8), 4.3 | New panel, desktop and phone, with a text equivalent | None |
| Installable / offline | 7, 5, hosting plan | Icons, install prompt behaviour | None |
| Keyboard shortcuts | 4.1 to 4.4, 6 | Help dialog | None |

Spec 2 and the line "No meeting-coordination features in this version" need an edit when Release 3 is ruled in.

## 3. Releases and milestones

Milestone numbers continue the log's numbering. Sizes are relative (S, M, L), not time estimates; the first build took two days, so calendar time is mostly design decisions and review.

### Release 1.1: Send a moment (no data changes)

Small, independent, all built on Jump. A good first release because nothing here risks stored data.

**M8: Copy as text (S).** *Status: built, in review (PR 47).* A "Copy as text" button in the Jump banner (and "now" in live mode, to decide) that copies one line per city, for example `Tue, Mar 16: 9:00 AM New York, 2:00 PM London, 10:30 PM Mumbai`, using the Settings time format.
- Decide: exact format, whether the link is appended, whether it uses card names (renames) or the city's own names. M5-1 keeps renames out of links; text copied for your own message could go either way.
- Done when: unit tests cover 12h/24h, a day rollover, and DST dates; keyboard path and toast announce via role status; e2e passes in all three engines.

**M9: Add to calendar (S to M).** *Status: built, in review (branch `feat/m9-add-to-calendar`, stacked on M8).* From a Jump, create an event: a small dialog for title and duration, then a downloaded `.ics` file and a Google Calendar link. Everything is built in the browser; nothing is sent anywhere.
- Decide: default duration (30 or 60 min), which zone the event is anchored in, whether the title defaults to something.
- Verify: that a `blob:` download is allowed by the current CSP. I'd expect yes, but check on a preview deploy, since a CSP change is a larger decision than this feature.
- Done when: the `.ics` imports correctly into Google, Apple and Outlook calendars for a normal day and for a day with a DST change (tested by hand, since there's no way to automate that), and the file contents are covered by unit tests.

**M10: DST heads-up (M).** Warn when the picture changes: in live mode, a quiet note on a card when its offset will change within the next 14 days; in Jump mode, a note when the jumped date falls on the other side of a transition, so the "difference from my time" is not what you see today.
- Decide: window length, wording, whether it appears on the card or in a single summary line under the banner.
- Risk: this needs the zone-transition lookup from Temporal. I haven't confirmed the polyfill's support for it; the first step is a spike. If the polyfill lacks it, the fallback is scanning offsets day by day (cheap, but its tests must run on both engines).
- Done when: tests cover a southern-hemisphere zone, a zone that dropped DST, a half-hour-offset zone, and both transition directions, on native and polyfill.

### Release 1.2: Lists (schema v2)

This is the first release that changes stored data, so it starts with the foundation and a safety net.

**M11: Schema v2, migration and export/import (M).** Introduce schema v2 with a real migration (the registry is empty today, M2-2), and ship Settings > Data > Export and Import (a JSON file). Import reuses the loader's rules: a bad entry is dropped, the rest survive.
- Why together: local-only data is stuck in one browser; export is the escape hatch, and it makes the migration testable with real files.
- **Decide the v2 schema once.** It should hold named lists, and (if Release 3 is likely) an optional per-city working-hours field now, so there's one migration, not two. The cost of including it early is a field nothing reads until M14.
- Done when: v1 data migrates losslessly (fixtures, including the damaged-data and newer-schema cases from M2-2); a v2 export round-trips; an old open tab doesn't overwrite v2 data.

**M12: Saved lists (M).** Named lists of cities with a switcher in the header: "Design team", "Client in Sydney". The current list becomes the default list.
- Decide (the big one): are lists *independent full lists* (a city can be in several; the simplest mental model) or *views over one master list*? I lean toward independent lists. Also: does "My Local Time" appear in every list; what does Jump do when you switch (keep or reset to live); how many lists; what happens to Remove's Undo across a switch.
- Needs mockups: switcher on desktop and phone, manage dialog, per-list empty state.
- Done when: switching is keyboard- and screen-reader-friendly (announced, focus managed); storage-unavailable and bad-data states still hold per list.

**M13: Shared list links (M).** Extend the hash so a link can carry a set of cities along with the moment, e.g. `#at=…&ref=…&c=America/New_York~New York,Europe/London~London`.
- Decide: what the recipient sees. My suggestion: a temporary "Viewing a shared list" banner with a "Save to my lists" button, so opening a link never overwrites their own list. Also hash length limits (cap the city count), and the same name rules as M5-1 (original names, never renames).
- Done when: a malformed or oversized hash falls back safely (as D11 already does for Jump); two browsers on different zones agree on the moment; the link opens correctly with Jump's existing history behavior.

### Release 1.3: Find a time (needs the scope ruling)

This is the feature the app was originally for, and it's the one the v1 scope deliberately left out, so it needs an owner ruling first (R-n: lift "no meeting coordination" for working hours and overlap only; people, accounts and calendar reads stay out).

**M14: Working hours (S to M).** A global default (say 9:00 to 17:00, weekdays) in Settings, with an optional per-city override from the card menu.
- Decide: defaults, weekends and per-day schedules (I'd start with one range plus weekdays), how it's shown on cards (an indicator with text, not colour alone).
- Done when: stored with the schema from M11; covered by migration and import tests.

**M15: Find a time (L).** A panel that, for the cities in the current list and a chosen date, shows each city's working hours on one shared 24-hour axis, highlights the windows where everyone overlaps, and lists them as text. Choosing a window hands off to Jump (M5), so Copy link, Copy as text and Add to calendar all work from there.
- Needs mockups and a design interview round: layout for 2 to 8 cities, phone layout (the horizontal strips probably need a different form), what to show when there's no overlap (nearest-miss windows and who's outside their hours).
- Risk: the highest accessibility load in the roadmap. The strip is visual, so the text list of windows is the primary accessible form and must carry the same information. Loaded as a lazy chunk to stay inside the bundle budget.
- Done when: overlap math is tested across DST dates and half-hour zones on native and polyfill; keyboard and screen-reader pass; axe in both themes; bundle budget still met.

### Release 1.4: Install and polish

**M16: Installable, works offline (M to L).** Web manifest, icons, and a service worker so Meridian opens without a network. This one is the riskiest for caching: the dataset is fetched on first use (M2-10), assets are served `immutable`, and M0-20 already found one stale-asset trap. Do a spike first, and don't use a plain "cache everything" worker.
- Decide: whether offline is worth the update-flow complexity, or whether "add to home screen" (manifest only) is enough.
- Verify: that the worker is allowed by the CSP (`worker-src` falls back to `script-src 'self'`, so it should be; check on a preview).
- Done when: an update after deploy is picked up without a stuck old version; the 404 behavior from M0-20 is unchanged.

**M17: Keyboard shortcuts and a "compare to" city (S).** Shortcuts for add city, Jump, and the 12/24h toggle, with a help dialog. Optionally let the "difference from my time" line compare against a chosen city instead of the device's zone (4.1 already shows the difference from My Local Time).
- Risk: single-key shortcuts conflict with screen readers and typing, so require a modifier or a "?" help pattern, and make them discoverable, never the only path.

## 4. Order and why

1. M8 to M10: no data risk, quick wins, all extend Jump.
2. M11 first within 1.2, always: the migration and the export are the safety net for everything after.
3. Lists before Find a time: overlap needs "which cities" to be a first-class thing.
4. M16 last: biggest caching risk, smallest day-to-day value.

Release 1.2 and 1.3 are independent of each other apart from M11's schema decision, so you could swap them if finding a time matters more to you than lists.

## 5. Parked (not on the roadmap)

- **Holidays.** Needs either a network call (breaks local-only) or a bundled dataset that needs updating every year, plus licensing. Revisit after Find a time ships, if people ask.
- **Accounts, sync, live availability, reading calendars.** Against the local-only decision (spec 3, scope decision 2). Shared links cover most of the need without them.
- **Per-person availability** ("Priya works 10 to 6"). A different product shape from per-city hours; only if the above proves too coarse.

## 6. Open items to raise at the first interview

1. Lift the "no meeting coordination" scope line, and for what (Release 1.3).
2. Lists: independent lists or views of one master list (M12).
3. Shared link: what a recipient sees, and the city cap (M13).
4. Schema v2: include working hours now, or add later with a second migration (M11).
5. Whether offline (M16) is wanted, or the manifest alone.
