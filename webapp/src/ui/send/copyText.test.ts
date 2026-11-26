// Copy as text (M8). Runs in both test projects, native Temporal and the polyfill (vite.config.ts),
// since every line is time math in a zone.
import { describe, expect, it } from 'vitest';
import type { StoredCity } from '../../storage/schema';
import { KOLKATA, LONDON, NEW_YORK, NOWHERE, TOKYO } from '../../test/places';
import type { HourCycle } from '../../time/format';
import { encodeJump } from '../../time/jumpUrl';
import { instant, wallIn } from '../../time/testUtils';
import { cardView } from '../clock/cardView';
import { copyText, liveMoment } from './copyText';

const CHICAGO = 'America/Chicago';
const LOCAL: StoredCity = { id: 'me', kind: 'local' };
const zone = (id: string, z: string): StoredCity => ({ id, kind: 'zone', zone: z });
const SYDNEY = zone('sydney', 'Australia/Sydney');
const KATHMANDU = zone('kathmandu', 'Asia/Kathmandu');
const SAO_PAULO = zone('sao-paulo', 'America/Sao_Paulo');
const LINK = 'https://meridian.example/#at=x';

/** The text for these cities at this instant, as the app builds it from its cards. */
function textAt(
  at: Temporal.Instant,
  cities: StoredCity[],
  { hourCycle = '12', mode = 'live' }: { hourCycle?: HourCycle; mode?: 'live' | 'jump' } = {},
): string[] {
  const views = cities.map((c) =>
    cardView(c, { instant: at, deviceZone: CHICAGO, hourCycle, mode }),
  );
  return copyText(views, LINK).split('\n');
}

// The canvas Main board's moment: 9:43 PM on Tue, Nov 17, 2026 in Chicago.
const MAIN = instant('2026-11-18T03:43:00Z');

describe('copyText', () => {
  it('writes one line per card with its own date, then a blank line and the link', () => {
    expect(textAt(MAIN, [LOCAL, LONDON, TOKYO])).toEqual([
      'My Local Time (America/Chicago): Tue, Nov 17, 9:43 PM CST',
      // A day rollover: already Wednesday in London and Tokyo.
      'London: Wed, Nov 18, 3:43 AM GMT',
      'Tokyo: Wed, Nov 18, 12:43 PM JST',
      '',
      LINK,
    ]);
  });

  it('uses the 24-hour clock when set', () => {
    expect(textAt(MAIN, [LOCAL, TOKYO], { hourCycle: '24' }).slice(0, 2)).toEqual([
      'My Local Time (America/Chicago): Tue, Nov 17, 21:43 CST',
      'Tokyo: Wed, Nov 18, 12:43 JST',
    ]);
  });

  it('writes 12:00 AM and 00:00 for midnight', () => {
    const midnight = wallIn('2026-11-18T00:00', 'Asia/Tokyo');
    expect(textAt(midnight, [TOKYO])[0]).toBe('Tokyo: Wed, Nov 18, 12:00 AM JST');
    expect(textAt(midnight, [TOKYO], { hourCycle: '24' })[0]).toBe('Tokyo: Wed, Nov 18, 00:00 JST');
  });

  it('uses the names on the cards, renames included', () => {
    const office = { ...LONDON, customName: 'Office' };
    const home = { ...LOCAL, customName: 'Home' };
    expect(textAt(MAIN, [home, office]).slice(0, 2)).toEqual([
      'Home (America/Chicago): Tue, Nov 17, 9:43 PM CST',
      'Office: Wed, Nov 18, 3:43 AM GMT',
    ]);
  });

  it('leaves out a card whose zone this browser doesn’t know', () => {
    expect(textAt(MAIN, [NOWHERE, TOKYO])).toEqual(['Tokyo: Wed, Nov 18, 12:43 PM JST', '', LINK]);
  });

  it('gives just the link when no card has a time', () => {
    expect(textAt(MAIN, [NOWHERE])).toEqual(['', LINK]);
  });

  it('on a DST-skip day, each city has the offset it has at that instant', () => {
    // 3:00 AM in New York on 2027-03-14 is just after its clocks skipped 2:00–3:00 AM. Chicago
    // hasn't changed yet: its skip comes an hour later, at its own 2:00 AM.
    const at = wallIn('2027-03-14T03:00', 'America/New_York');
    expect(textAt(at, [NEW_YORK, LOCAL], { mode: 'jump' }).slice(0, 2)).toEqual([
      'New York City: Sun, Mar 14, 3:00 AM EDT',
      'My Local Time (America/Chicago): Sun, Mar 14, 1:00 AM CST',
    ]);
    const later = at.add({ hours: 1 });
    expect(textAt(later, [NEW_YORK, LOCAL], { mode: 'jump' }).slice(0, 2)).toEqual([
      'New York City: Sun, Mar 14, 4:00 AM EDT',
      'My Local Time (America/Chicago): Sun, Mar 14, 3:00 AM CDT',
    ]);
  });

  it('handles half-hour and 45-minute zones (the offset when there’s no abbreviation)', () => {
    expect(textAt(MAIN, [KOLKATA, KATHMANDU]).slice(0, 2)).toEqual([
      'Kolkata: Wed, Nov 18, 9:13 AM IST',
      'Asia/Kathmandu: Wed, Nov 18, 9:28 AM UTC+5:45',
    ]);
  });

  it('handles a southern-hemisphere zone on both sides of its change', () => {
    // Sydney is on daylight time in November and standard time in July.
    expect(textAt(MAIN, [SYDNEY])[0]).toBe('Australia/Sydney: Wed, Nov 18, 2:43 PM AEDT');
    const july = instant('2027-07-01T03:43:00Z');
    expect(textAt(july, [SYDNEY], { mode: 'jump' })[0]).toBe(
      'Australia/Sydney: Thu, Jul 1, 1:43 PM AEST',
    );
  });

  it('handles a zone that dropped DST (São Paulo, 2019)', () => {
    // January 2019 was São Paulo's last summer on daylight time (UTC−2); since then it's UTC−3.
    const before = instant('2019-01-15T15:00:00Z');
    const after = instant('2027-01-15T15:00:00Z');
    expect(textAt(before, [SAO_PAULO], { mode: 'jump' })[0]).toBe(
      'America/Sao_Paulo: Tue, Jan 15, 1:00 PM UTC−2:00',
    );
    expect(textAt(after, [SAO_PAULO], { mode: 'jump' })[0]).toBe(
      'America/Sao_Paulo: Fri, Jan 15, 12:00 PM UTC−3:00',
    );
  });
});

describe('liveMoment', () => {
  it('links to the minute on screen, from the device’s zone, with no name', () => {
    const now = instant('2026-11-18T03:43:37.250Z').epochMilliseconds;
    expect(encodeJump(liveMoment(now, CHICAGO))).toBe(
      '#at=2026-11-18T03:43:00Z&ref=America/Chicago',
    );
  });
});
