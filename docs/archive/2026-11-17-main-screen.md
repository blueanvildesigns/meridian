# Decision: main screen (clock list)

Date: 2026-11-17
Source: design interview, round 4. Mockups: "Meridian Web: Design Canvas" artboards `Main.dc.html` (desktop) and `Mobile.dc.html` (phone).

## Decisions

1. **Layout: responsive grid of cards.** One column on phones, several on wide screens. An "Add a city" tile ends the grid.
2. **Card contents:** city name (user-editable), country or detected zone, time, relative-day chip (Today / Tomorrow / Yesterday), full date, zone abbreviation, UTC offset, and the difference from the user's own time (e.g. "+11h 30m", "Same time"). Each card also has a drag handle and a more-options button.
3. **Day/night cue: light or dark card plus a sun or moon icon with a "Daytime" / "Night" label.** The icon and label mean the cue never depends on colour alone.
4. **Night rule: real sunrise and sunset**, computed from each city's coordinates, replacing the old fixed 6 AM to 6 PM rule.
5. **Header controls:** 12h/24h segmented toggle, About button. Toolbar: LIVE status, "Jump to a time" (primary), "Add city". Footer: Blue Anvil Designs credit, About, Ko-fi.
6. **Time format:** the 12h/24h toggle defaults to the browser locale (per earlier decision).

## Consequences and open points

- **Sunrise/sunset needs coordinates.** GeoNames cities have them. The "My Local Time" card has only a zone from the browser, so it needs a fallback: use the zone's representative city, or optionally ask for browser geolocation. Decide before implementation.
- **Polar regions** have days with no sunrise or no sunset. Define the behaviour (for example, all-day or all-night) for those cases.
- The mockup uses sample data (a fixed moment, and a handful of cities); sunrise and sunset times are not shown on the cards.
- Not yet designed: Add city search, Jump (date, time, DST warnings), card more-options menu (rename, remove), settings, About page, empty state, error states, app-wide dark mode.
