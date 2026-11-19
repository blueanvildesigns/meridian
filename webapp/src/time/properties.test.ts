// Property tests: the time core's invariants, over every zone the app can meet and instants across
// 2026–2030. Zones: the city dataset's (current names such as Asia/Kolkata) plus everything the
// engine lists. Node's Intl.supportedValuesOf still uses legacy names for 16 zones (Asia/Calcutta),
// so neither list alone covers the other.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DATASET_ZONES } from '../cities/zoneData';
import { zoneAbbreviation } from './abbreviation';
import { decodeJump, encodeJump } from './jumpUrl';
import { calendarDayDiff } from './relativeDay';
import { zoneSnapshot } from './snapshot';
import { T } from './temporal';
import { nextOccurrence, resolveWallTime } from './wallTime';

const ZONES = [...new Set([...DATASET_ZONES, ...Intl.supportedValuesOf('timeZone'), 'UTC'])];
const FROM = Date.UTC(2026, 0, 1);
const TO = Date.UTC(2031, 0, 1);
const RUNS = { numRuns: 1000 };

const zone = fc.constantFrom(...ZONES);
const epochMs = fc.integer({ min: FROM, max: TO - 1 });
const at = epochMs.map((ms) => T().Instant.fromEpochMilliseconds(ms));
const wallDate = fc
  .integer({ min: 0, max: (TO - FROM) / 86_400_000 - 1 })
  .map((d) => T().PlainDate.from('2026-01-01').add({ days: d }));
const wallTime = fc
  .integer({ min: 0, max: 24 * 60 - 1 })
  .map((m) => T().PlainTime.from({ hour: Math.floor(m / 60), minute: m % 60 }));

describe('properties', () => {
  it('resolveWallTime never shifts silently', () => {
    fc.assert(
      fc.property(zone, wallDate, wallTime, (z, d, t) => {
        const wall = d.toPlainDateTime(t);
        const r = resolveWallTime(d, t, z);
        const wallOf = (i: Temporal.Instant) => i.toZonedDateTimeISO(z).toPlainDateTime();
        switch (r.kind) {
          case 'exact':
            expect(wallOf(r.instant).equals(wall)).toBe(true);
            break;
          case 'overlap':
            expect(wallOf(r.earlier).equals(wall)).toBe(true);
            expect(wallOf(r.later).equals(wall)).toBe(true);
            expect(T().Instant.compare(r.earlier, r.later)).toBe(-1);
            break;
          case 'gap':
            expect(T().PlainDateTime.compare(r.skippedFrom, wall)).toBeLessThanOrEqual(0);
            expect(T().PlainDateTime.compare(wall, r.skippedTo)).toBe(-1);
            expect(wallOf(r.suggestion).equals(r.skippedTo)).toBe(true);
            break;
        }
      }),
      RUNS,
    );
  });

  it('nextOccurrence picks today or tomorrow by calendar, never a moment in the past', () => {
    fc.assert(
      fc.property(zone, at, wallTime, (z, now, t) => {
        const today = now.toZonedDateTimeISO(z).toPlainDate();
        const { date, result } = nextOccurrence(now, t, z);
        const days = today.until(date, { largestUnit: 'days' }).days;
        expect([0, 1]).toContain(days);
        if (result.kind === 'exact') {
          const nowMinute = now.round({ smallestUnit: 'minute', roundingMode: 'floor' });
          expect(T().Instant.compare(result.instant, nowMinute)).toBeGreaterThanOrEqual(0);
          expect(now.until(result.instant).total('hours')).toBeLessThan(48);
          expect(result.instant.toZonedDateTimeISO(z).toPlainTime().equals(t)).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('calendarDayDiff is within ±2, antisymmetric, and matches the two dates', () => {
    fc.assert(
      fc.property(zone, zone, at, (a, b, i) => {
        const diff = calendarDayDiff(i, a, b);
        expect(Math.abs(diff)).toBeLessThanOrEqual(2);
        expect(calendarDayDiff(i, b, a) + diff).toBe(0);
        const expected = i
          .toZonedDateTimeISO(b)
          .toPlainDate()
          .add({ days: diff })
          .equals(i.toZonedDateTimeISO(a).toPlainDate());
        expect(expected).toBe(true);
      }),
      RUNS,
    );
  });

  it('zoneSnapshot difference equals the offset difference', () => {
    fc.assert(
      fc.property(zone, zone, at, (a, b, i) => {
        const s = zoneSnapshot(i, a, b);
        const offset = (z: string) => i.toZonedDateTimeISO(z).offsetNanoseconds;
        expect(s.minutesAhead).toBe(Math.round((offset(a) - offset(b)) / 60e9));
        expect(zoneSnapshot(i, b, a).minutesAhead + s.minutesAhead).toBe(0);
      }),
      RUNS,
    );
  });

  it('abbreviations are alphabetic or absent, never "GMT+9"', () => {
    fc.assert(
      fc.property(zone, at, (z, i) => {
        const offset = i.toZonedDateTimeISO(z).offsetNanoseconds / 1e9;
        const a = zoneAbbreviation(i.epochMilliseconds, z, offset);
        if (a !== undefined) expect(a).toMatch(/^[A-Za-z]{2,6}$/);
      }),
      { numRuns: 200 },
    );
  });

  it('Jump links round-trip any instant, zone and name', () => {
    fc.assert(
      fc.property(at, zone, fc.string({ maxLength: 80, unit: 'grapheme' }), (i, z, name) => {
        const back = decodeJump(
          encodeJump({ instant: i.round('second'), refZone: z, refName: name }),
        );
        expect(back).not.toBeNull();
        expect(back?.instant.equals(i.round('second'))).toBe(true);
        // The zone comes back canonical; for non-legacy zones that's the same string.
        expect(back?.refZone).toBeTruthy();
        const cleaned = name.replace(/\s+/g, ' ').trim();
        if (cleaned !== '' && !/\p{Cc}/u.test(cleaned) && cleaned.length < 40) {
          expect(back?.refName).toBe(cleaned);
        }
      }),
      RUNS,
    );
  });
});
