import { describe, expect, it } from 'vitest';
import { isDaytime, solarElevation, startOfDay, SUNRISE_ELEVATION } from './solar';
import { date, instant, wallIn } from './testUtils';

/** Sunrise and sunset on a local date, found by scanning minute by minute. */
function sunTimes(day: string, zone: string, coords: { lat: number; lon: number }) {
  const start = startOfDay(date(day), zone).epochMilliseconds;
  const events: string[] = [];
  let prev = solarElevation(start, coords) > SUNRISE_ELEVATION;
  for (let m = 1; m <= 24 * 60; m++) {
    const ms = start + m * 60_000;
    const up = solarElevation(ms, coords) > SUNRISE_ELEVATION;
    if (up !== prev) {
      const zdt = instant(new Date(ms).toISOString()).toZonedDateTimeISO(zone);
      events.push(zdt.toPlainTime().toString({ smallestUnit: 'minute' }));
    }
    prev = up;
  }
  return events;
}

const minutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Reference times from timeanddate.com (fetched 2026-11-18). Allow 2 minutes for differences in
// coordinates and the calculator's own rounding.
describe('solar elevation vs published sunrise and sunset', () => {
  it.each([
    ['London', '2026-06-21', 'Europe/London', { lat: 51.5074, lon: -0.1278 }, '04:43', '21:21'],
    [
      'New York',
      '2026-12-21',
      'America/New_York',
      { lat: 40.7128, lon: -74.006 },
      '07:16',
      '16:31',
    ],
    [
      'Sydney',
      '2026-12-21',
      'Australia/Sydney',
      { lat: -33.8688, lon: 151.2093 },
      '05:40',
      '20:05',
    ],
  ])('%s on %s', (_city, day, zone, coords, rise, set) => {
    const [r, s] = sunTimes(day, zone, coords);
    expect(r && Math.abs(minutes(r) - minutes(rise))).toBeLessThanOrEqual(2);
    expect(s && Math.abs(minutes(s) - minutes(set))).toBeLessThanOrEqual(2);
  });
});

describe('isDaytime', () => {
  const TROMSO = { lat: 69.6492, lon: 18.9553 };

  it('has polar night in Tromsø at midwinter noon and midnight sun at midsummer midnight', () => {
    expect(isDaytime(wallIn('2026-12-21T12:00', 'Europe/Oslo'), 'Europe/Oslo', TROMSO)).toBe(false);
    expect(sunTimes('2026-12-21', 'Europe/Oslo', TROMSO)).toEqual([]);
    expect(isDaytime(wallIn('2026-06-21T00:30', 'Europe/Oslo'), 'Europe/Oslo', TROMSO)).toBe(true);
    expect(sunTimes('2026-06-21', 'Europe/Oslo', TROMSO)).toEqual([]);
  });

  it('uses 06:00–18:00 on the wall clock when there are no coordinates', () => {
    const at = (t: string) => isDaytime(wallIn(`2026-06-21T${t}`, 'UTC'), 'UTC', undefined);
    expect([at('05:59'), at('06:00'), at('17:59'), at('18:00')]).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});
