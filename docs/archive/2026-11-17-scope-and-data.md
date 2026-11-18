# Decision: scope, data, and desktop retirement

Date: 2026-11-17
Source: design interview, round 1. Baseline: `docs/REVERSE_ENGINEERING.md`.

## Decisions

1. **Scope: feature parity, new look and UX.** The web app delivers every user-facing feature of the desktop app (live world clock, add/remove/reorder cities, "My Local Time" card, Jump, relative-day label, day/night card cue, theme choice). The visual design and interaction design are redesigned from scratch. No meeting-coordination features (people, working hours, overlap, suggested times) in this version. The code never had them; they stay out of scope.
2. **Data: local-only.** All state lives in the browser. No accounts, no backend, no sync. The data model must not preclude adding sharing later (stable zone identity, versioned storage schema).
3. **Desktop apps: retire** once the web version ships. No backporting of fixes to the Flutter app.

## Consequences

- Desktop-only features are dropped with no web equivalent: custom title bar, tray/menu bar, hide-on-close, always-on-top, window opacity, acrylic/vibrancy, window position persistence.
- Existing-user migration is a separate open question (export/import vs fresh start).
- Known bugs in the old app (REVERSE_ENGINEERING.md section 6) are not ported; the web app implements correct behavior.
