# Decision: add-city search

Date: 2026-11-17
Source: design interview, round 5. Mockups: canvas "Meridian Web: Design Canvas", row "Add city: search" (`AddCity`, `AddCityAirport`, `AddCityZone`, `AddCityEmpty`, `AddCityPhone`).

## Decisions

1. **Presentation:** a centered dialog on desktop, a full-screen sheet on phones. Opened by the "Add city" button or the "Add a city" tile.
2. **Result row:** city name, state or region plus country (so London, England / Ontario / Ohio are distinguishable), the current local time there, and UTC offset with abbreviation (e.g. `UTC+5:30 · IST`).
3. **After adding:** the dialog stays open and the added row switches to an "Added" state, so several cities can be added in a row. Done or Esc closes. Added cities appear in the grid behind it.
4. **What the search matches:** city names, country names, time zone names and abbreviations (PST, IST, "Central time"), airport codes (IATA, e.g. LHR), and raw IANA IDs (e.g. America/New_York).
5. **Match tags:** when the match is not the city's name, the row shows a small tag saying why, e.g. `Airport IST`, `Time zone IST`. Ambiguous queries therefore show mixed result types without confusion.
6. **Time zone queries:** a zone query such as `pst` shows a header band naming the zone (`Pacific Standard Time (PST) · UTC−8:00`) above the cities in it.
7. **Empty state:** "No cities match <query>", with a hint to try a city, country, airport code or time zone.
8. **Keyboard:** Up/Down to move, Enter to add, Esc to close. The first or highlighted row has a visible focus outline.
9. **Attribution:** "City data from GeoNames (CC BY 4.0)" appears in the dialog footer, in addition to the About page.

## Proposed by Claude, not yet confirmed

- A city already in the list is shown as "Added" and cannot be added again (the old app allowed duplicates and crashed on them).

## Open points

- Source and license of the airport-code dataset. IATA codes are not in GeoNames; pick an open dataset and check its license and attribution terms before bundling.
- Ranking: how to order results (exact match, population, matched field) and how many to show.
- Raw IANA ID search is specified but not shown in the mockups.
- Whether an optional "use my location" or "popular cities" list appears when the query is empty.
- Screens still to design: Jump, card more-options menu (rename, remove), settings, About page, empty list state, error states, app-wide dark mode.
