import { describe, expect, it } from 'vitest';
import type { StoredCity } from '../../storage/schema';
import { KOLKATA, LONDON, NOWHERE, TOKYO } from '../../test/places';
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
