# Decision: core features (Jump, time format, city search, visual direction)

Date: 2026-11-17
Source: design interview, round 1 (continued).

## Decisions

1. **Jump gains a date.** Users pick a date and a time in any chosen city, and all cards render that instant. This delivers what the README already promised ("3:00 PM next Tuesday"). This is the one deliberate step beyond strict parity. Correctness requirements, from the old app's bugs:
   - Use calendar-day arithmetic in the target zone, never "+24 hours".
   - Handle nonexistent wall times (spring-forward gap) and repeated wall times (fall-back overlap) explicitly: tell the user, and for repeated times let them choose which occurrence.
   - Selecting "now" must not jump a day ahead.
2. **Time format follows the browser locale, with a toggle.** 12-hour or 24-hour defaults from the user's locale; a setting overrides it. Cards may additionally show date, UTC offset and zone abbreviation (exact presentation decided in the card design round).
3. **Real city search.** Adding a city searches real place names, not raw IANA IDs. Requirements: a bundled city list (name, country, IANA zone) with common aliases (Mumbai, San Francisco, PST, etc.), tolerance for spaces vs underscores and case, current UTC offset shown in results, legacy aliases such as `US/Central` hidden. Stored identity stays the IANA zone ID plus a display name the user can edit. The city data source and licensing are still to be chosen.
4. **Visual direction: evolve the day/night card idea.** Keep the existing cue where a city in daytime gets a light card and a city at night gets a dark card, redesigned and refined. Not a clean slate and not a straight port of Glass or Minimalist. Glass and Minimalist are reference material only.

## Implementation notes carried forward

- Time zone rules come from the browser's built-in `Intl` / Temporal support, so rule updates arrive with the browser. No bundled tzdata.
- The day/night threshold (old app: night if hour < 6 or >= 18) is a candidate to revisit in the card design round.
- Relative-day label compares calendar dates, not truncated 24-hour durations.
