# Prompt for Claude Code: build Meridian Web

You are building the web rewrite of Meridian, a world-clock app. The design is approved. Do not redesign; implement.

## Read first, in this order
1. `docs/spec.md` (behaviour, master spec)
2. `docs/design-spec.md` (tokens, components, screens, accessibility)
3. `docs/hosting-plan.md` (Firebase Hosting, DNS, CI/CD, costs, performance budget, launch gating)
4. `docs/archive/*.md` (the decisions behind the spec, for context)
5. `docs/REVERSE_ENGINEERING.md` (what the old Flutter app did, including bugs not to port)

If the spec and the old app disagree, the spec wins. Items marked "proposed, to confirm" or listed under Open questions: pick a sensible default, record it in `docs/decisions-log.md`, and tell me; do not block on them.

## Constraints
- React + TypeScript + Vite, static SPA, no backend, local-only storage with a versioned schema.
- Time math with Temporal (native where available, polyfill otherwise). Zone rules from the browser; no bundled tzdata. Instant-based conversion; calendar-day arithmetic in the reference zone; never add 24 hours.
- GeoNames subset as bundled static JSON with aliases. Attribution required. Do not add airport data until I confirm its licence.
- Self-host fonts. No analytics or third-party requests.
- Accessibility per `docs/design-spec.md` section 6. Automated contrast and axe checks in both themes.
- Repo is on GitHub (stays). License MIT. Host on Firebase Hosting at meridian.blueanvildesigns.io via GitHub Actions, as in `docs/hosting-plan.md`. Respect its bundle and city-data size budgets.
- Do not touch or delete the Flutter app yet. New code goes in a new top-level folder (propose the name).

## How to work
1. Start in plan mode. Give me a milestone plan and wait for my approval before writing code. Suggested milestones, adjust if you see better:
   - M0: scaffold, lint, format, test runner, theme tokens, fonts, plus the hosting pipeline (Firebase project, GitHub Actions with PR previews, placeholder page on the real domain, noindex). I will do the Firebase and DNS steps; give me exact instructions.
   - M1: time core (Temporal wrapper, relative-day, DST gap/overlap, Jump resolution) with a thorough unit test suite first. Use the old app's probe cases from `REVERSE_ENGINEERING.md` as regression tests.
   - M2: storage layer (versioned schema, migration hook, storage-unavailable fallback) and city data/search index.
   - M3: clock list, cards, day/night from sunrise/sunset, live ticking, reorder, empty state, "My Local Time" with coordinate fallback.
   - M4: add-city dialog/sheet and search.
   - M5: Jump (picker, URL state, banner, DST handling, copy link).
   - M6: card menu, rename, remove with Undo, Settings, dark mode, About, error states.
   - M7: end-to-end tests (Playwright), accessibility pass, measure bundle against the budget, final headers, README and licence, then the launch gate in `docs/hosting-plan.md` section 8. The MVP goes live after M5 plus the launch-required parts of M6, not necessarily all of M6.
2. One milestone per branch and PR, small commits, tests with each milestone. Keep `docs/` as the source of truth: when you make a decision, add it to `docs/decisions-log.md`.
3. Visual fidelity: values pinned in `docs/design-spec.md` are binding. Anything marked "from mockup" I will supply; ask me for a screenshot or the board source rather than guessing.
4. Be upfront about uncertainty. If something is unverified (for example Safari Temporal support, or a browser behaviour), say so and show how you checked.

## First task
Read the docs, then reply with: (a) anything in the spec that is ambiguous or contradictory, (b) your milestone plan, (c) the folder name and repo layout you propose, (d) the questions you need answered before M0. Do not write code until I approve.
