// Runs in both test projects, native Temporal and the polyfill (vite.config.ts): the DST chips
// (M10) are each engine's zone rules.
import { describe, expect, it } from 'vitest';
import type { StoredCity } from '../../storage/schema';
import { KOLKATA, LONDON, NEW_YORK, NOWHERE, TOKYO } from '../../test/places';
import { instant } from '../../time/testUtils';
import { cardView, type CardView, type ClockContext, type ClockView } from './cardView';

// The canvas Main board's moment: 9:43 PM on Tue, Nov 17 in Chicago.
const AT = instant('2026-11-18T03:43:00Z');
const CTX: ClockContext = {
  instant: AT,
  deviceZone: 'America/Chicago',
  hourCycle: '12',
  mode: 'live',
};

function ok(view: CardView): ClockView {
  if (view.status !== 'ok') throw new Error(`expected a clock, got ${view.status}`);
  return view;
}
const show = (city: StoredCity, ctx: Partial<ClockContext> = {}) =>
  ok(cardView(city, { ...CTX, ...ctx }));

describe('cardView: the canvas Main board', () => {
  it('My Local Time', () => {
    expect(show({ id: 'l', kind: 'local' })).toMatchObject({
      name: 'My Local Time',
      subtitle: 'Detected: America/Chicago',
      time: '9:43',
      dayPeriod: 'PM',
      dayLabel: 'Today',
      date: 'Tue, Nov 17',
      abbreviation: 'CST',
      offset: 'UTC−6:00',
      difference: 'Same time',
      daytime: false,
    });
  });

  it('London', () => {
    expect(show(LONDON)).toMatchObject({
      name: 'London',
      subtitle: 'United Kingdom',
      time: '3:43',
      dayPeriod: 'AM',
      dayLabel: 'Tomorrow',
      date: 'Wed, Nov 18',
      abbreviation: 'GMT',
      offset: 'UTC+0:00',
      difference: '+6h',
      daytime: false,
    });
  });

  it('Kolkata', () => {
    expect(show(KOLKATA)).toMatchObject({
      time: '9:13',
      dayPeriod: 'AM',
      dayLabel: 'Tomorrow',
      abbreviation: 'IST',
      offset: 'UTC+5:30',
      difference: '+11h 30m',
      daytime: true,
    });
  });

  it('Tokyo', () => {
    expect(show(TOKYO)).toMatchObject({
      time: '12:43',
      dayPeriod: 'PM',
      abbreviation: 'JST',
      offset: 'UTC+9:00',
      difference: '+15h',
      daytime: true,
    });
  });
});

describe('cardView', () => {
  it('uses 24-hour time when asked', () => {
    expect(show(LONDON, { hourCycle: '24' })).toMatchObject({ time: '03:43', dayPeriod: '' });
  });

  it('shows a rename instead of the default name', () => {
    expect(show({ ...LONDON, customName: 'Head office' }).name).toBe('Head office');
    expect(show({ id: 'l', kind: 'local', customName: 'Home' }).name).toBe('Home');
  });

  it('measures days and differences from the device zone (D1)', () => {
    const view = show(LONDON, { deviceZone: 'Asia/Tokyo' });
    expect(view).toMatchObject({ dayLabel: 'Today', difference: '−9h' });
  });

  it('uses Jump wording in jump mode', () => {
    expect(show(LONDON, { mode: 'jump' }).dayLabel).toBe('Next day');
  });

  it('My Local Time borrows the zone representative for day/night', () => {
    // 12:00 in Chicago is daytime whatever the season.
    const noon = instant('2026-11-18T18:00:00Z');
    expect(show({ id: 'l', kind: 'local' }, { instant: noon }).daytime).toBe(true);
  });

  it('a bare zone says "Time zone" until renamed, then shows the zone (D4)', () => {
    const utc: StoredCity = { id: 'u', kind: 'zone', zone: 'UTC' };
    expect(show(utc)).toMatchObject({
      name: 'UTC',
      subtitle: 'Time zone',
      offset: 'UTC+0:00',
      time: '3:43',
    });
    expect(show({ ...utc, customName: 'Servers' }).subtitle).toBe('UTC');
  });

  it('UTC has no place, so day is 06:00 to 18:00', () => {
    const utc: StoredCity = { id: 'u', kind: 'zone', zone: 'UTC' };
    expect(show(utc).daytime).toBe(false);
    expect(show(utc, { instant: instant('2026-11-18T12:00:00Z') }).daytime).toBe(true);
  });

  it('a saved legacy zone name still works', () => {
    const view = show({ ...KOLKATA, zone: 'Asia/Calcutta' });
    expect(view).toMatchObject({ zone: 'Asia/Kolkata', offset: 'UTC+5:30' });
  });

  it('a zone the browser does not know gives the unrecognised-zone card', () => {
    expect(cardView(NOWHERE, CTX)).toEqual({
      status: 'unknown-zone',
      id: 'nowhere',
      name: 'Olympus Mons',
      zone: 'Mars/Olympus_Mons',
    });
  });
});

describe('cardView: DST heads-up (M10)', () => {
  const LOCAL: StoredCity = { id: 'l', kind: 'local' };
  const zone = (z: string): StoredCity => ({ id: z, kind: 'zone', zone: z });
  // Canvas DstLive: Fri, Mar 5, 2027, 4:00 PM in Chicago.
  const MAR_5 = instant('2027-03-05T22:00:00Z');
  const dst = (city: StoredCity, ctx: Partial<ClockContext>) => show(city, ctx).dst;

  it('live: a chip on every card whose clocks change within 14 days, My Local Time too', () => {
    const live = { instant: MAR_5 };
    expect(dst(LOCAL, live)).toBe('Clocks change Sun, Mar 14');
    expect(dst(NEW_YORK, live)).toBe('Clocks change Sun, Mar 14');
    expect(dst(LONDON, live)).toBeNull();
    expect(dst(KOLKATA, live)).toBeNull();
    expect(dst(TOKYO, live)).toBeNull();
    expect(dst(zone('Australia/Sydney'), live)).toBeNull();
    // The canvas Main board's moment (Nov 17, 2026): nothing changes within 14 days.
    expect(dst(LOCAL, {})).toBeNull();
  });

  it('live: the day is the change’s own (Sydney goes back on Sunday, Apr 4)', () => {
    expect(dst(zone('Australia/Sydney'), { instant: instant('2027-03-25T00:00:00Z') })).toBe(
      'Clocks change Sun, Apr 4',
    );
  });

  // Canvas DstJump: a Jump to Tue, Mar 30, 2027, 9:00 AM in New York, seen on Mar 5.
  const JUMP = { instant: instant('2027-03-30T13:00:00Z'), now: MAR_5, mode: 'jump' as const };

  it('jump: "then · today" on every card whose offset differs from now’s', () => {
    expect(dst(LOCAL, JUMP)).toBe('CDT then · CST today');
    expect(dst(NEW_YORK, JUMP)).toBe('EDT then · EST today');
    expect(dst(LONDON, JUMP)).toBe('BST then · GMT today');
  });

  it('jump: no chip where the offset is the same, even if the difference line changed', () => {
    const kolkata = show(KOLKATA, JUMP);
    expect(kolkata.difference).toBe('+10h 30m');
    expect(kolkata.dst).toBeNull();
    expect(dst(TOKYO, JUMP)).toBeNull();
    expect(dst(zone('Australia/Sydney'), JUMP)).toBeNull();
  });

  it('jump: the offsets when a zone has no abbreviation (Lord Howe’s half hour)', () => {
    const lordHowe = zone('Australia/Lord_Howe');
    const winter = { ...JUMP, instant: instant('2027-06-01T00:00:00Z') };
    expect(dst(lordHowe, winter)).toBe('UTC+10:30 then · UTC+11:00 today');
  });

  it('jump: a zone that dropped DST is flagged for a date before it did', () => {
    const saoPaulo = zone('America/Sao_Paulo');
    const summer2018 = { ...JUMP, instant: instant('2018-12-01T15:00:00Z') };
    expect(dst(saoPaulo, summer2018)).toBe('UTC−2:00 then · UTC−3:00 today');
    expect(dst(saoPaulo, JUMP)).toBeNull();
  });

  it('jump: no "now" given means nothing to compare with', () => {
    expect(dst(NEW_YORK, { instant: JUMP.instant, mode: 'jump' })).toBeNull();
  });
});
