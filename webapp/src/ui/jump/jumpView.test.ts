import { describe, expect, it } from 'vitest';
import type { PlaceCity, StoredCity } from '../../storage/schema';
import { KOLKATA, LONDON, NOWHERE, TOKYO } from '../../test/places';
import type { JumpState } from '../../time/jumpUrl';
import { date, instant, time } from '../../time/testUtils';
import { resolveWallTime } from '../../time/wallTime';
import {
  bannerWhen,
  gapText,
  initialReferenceKey,
  LINK_KEY,
  LOCAL_KEY,
  overlapText,
  parseDateInput,
  referenceCardId,
  referenceOptions,
  referencePlace,
  utcLine,
  wallFields,
} from './jumpView';

const CHICAGO = 'America/Chicago';
const LOCAL: StoredCity = { id: 'me', kind: 'local' };
const NEW_YORK: PlaceCity = {
  id: 'ny',
  kind: 'place',
  zone: 'America/New_York',
  geonameId: 5128581,
  name: 'New York City',
  countryCode: 'US',
  country: 'United States',
  region: 'New York',
  lat: 40.7,
  lon: -74,
};
// The canvas JumpActive moment: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_JUMP: JumpState = {
  instant: instant('2026-12-03T23:00:00Z'),
  refZone: 'Asia/Tokyo',
  refName: 'Tokyo',
};
const BOARD: StoredCity[] = [LOCAL, NEW_YORK, LONDON, KOLKATA, TOKYO];

describe('the "Time is in" list (D12)', () => {
  it('starts with My Local Time and its zone, then the cities in order (canvas JumpPicker)', () => {
    const options = referenceOptions(BOARD, CHICAGO, null, null);
    expect(options.map((o) => o.label)).toEqual([
      'My Local Time (America/Chicago)',
      'New York City',
      'London',
      'Kolkata',
      'Tokyo',
    ]);
    expect(options[0]).toMatchObject({ key: LOCAL_KEY, zone: CHICAGO, cityId: 'me' });
    expect(options[4]).toMatchObject({ key: 'tokyo', zone: 'Asia/Tokyo', linkName: 'Tokyo' });
  });

  it('offers My Local Time even when its card has been removed', () => {
    const [first] = referenceOptions([TOKYO], CHICAGO, null, null);
    expect(first).toMatchObject({ key: LOCAL_KEY, label: 'My Local Time (America/Chicago)' });
    expect(first).not.toHaveProperty('cityId');
  });

  it('labels renamed cards by their new name but links by their own', () => {
    const office: StoredCity = { ...TOKYO, customName: 'Office' };
    const home: StoredCity = { ...LOCAL, customName: 'Home' };
    const options = referenceOptions([home, office], CHICAGO, null, null);
    expect(options.map((o) => o.label)).toEqual(['Home (America/Chicago)', 'Office']);
    expect(options[1]?.linkName).toBe('Tokyo');
  });

  it('leaves out cards whose zone this browser doesn’t know', () => {
    expect(referenceOptions([NOWHERE, TOKYO], CHICAGO, null, null).map((o) => o.key)).toEqual([
      LOCAL_KEY,
      'tokyo',
    ]);
  });

  it('tells apart two cities with the same name', () => {
    const ontario: PlaceCity = {
      ...LONDON,
      id: 'london-on',
      geonameId: 6058560,
      zone: 'America/Toronto',
      countryCode: 'CA',
      country: 'Canada',
      region: 'Ontario',
    };
    expect(referenceOptions([LONDON, ontario], CHICAGO, null, null).map((o) => o.label)).toEqual([
      'My Local Time (America/Chicago)',
      'London (England, United Kingdom)',
      'London (Ontario, Canada)',
    ]);
  });

  it('keeps a shared link’s city that isn’t in this list, so Change can keep it', () => {
    const options = referenceOptions([LOCAL, LONDON], CHICAGO, TOKYO_JUMP, null);
    expect(options[1]).toMatchObject({
      key: LINK_KEY,
      label: 'Tokyo (Asia/Tokyo)',
      zone: 'Asia/Tokyo',
      linkName: 'Tokyo',
      countryCode: 'JP',
    });
    expect(initialReferenceKey([LOCAL, LONDON], CHICAGO, TOKYO_JUMP, null)).toBe(LINK_KEY);
  });
});

describe('which card is the reference (D11)', () => {
  it('is the city with the link’s zone and name', () => {
    expect(referenceCardId(BOARD, TOKYO_JUMP, CHICAGO, null)).toBe('tokyo');
    expect(referencePlace(BOARD, TOKYO_JUMP, CHICAGO, 'tokyo')).toBe('Tokyo');
  });

  it('keeps the card’s own name in the banner when it has been renamed', () => {
    const cities = [{ ...TOKYO, customName: 'Office' }];
    const id = referenceCardId(cities, TOKYO_JUMP, CHICAGO, null);
    expect(id).toBe('tokyo');
    expect(referencePlace(cities, TOKYO_JUMP, CHICAGO, id)).toBe('Office');
  });

  it('is nothing when the list doesn’t have it; the banner names the link’s city', () => {
    expect(referenceCardId([LOCAL, LONDON], TOKYO_JUMP, CHICAGO, null)).toBeNull();
    expect(referencePlace([LOCAL, LONDON], TOKYO_JUMP, CHICAGO, null)).toBe('Tokyo');
  });

  it('for a link with no name, is My Local Time when the zone is this device’s', () => {
    const local: JumpState = { instant: TOKYO_JUMP.instant, refZone: CHICAGO };
    expect(referenceCardId(BOARD, local, CHICAGO, null)).toBe('me');
    expect(referencePlace(BOARD, local, CHICAGO, 'me')).toBe('My Local Time');
    expect(initialReferenceKey(BOARD, CHICAGO, local, 'me')).toBe(LOCAL_KEY);
    // Someone else's local time: no card, and the banner names the zone.
    expect(referenceCardId(BOARD, local, 'Europe/London', null)).toBeNull();
    expect(referencePlace(BOARD, local, 'Europe/London', null)).toBe('America/Chicago');
  });

  it('prefers the card picked last between two of the same name and zone', () => {
    const twin: StoredCity = { ...TOKYO, id: 'tokyo-2', geonameId: 2 };
    expect(referenceCardId([TOKYO, twin], TOKYO_JUMP, CHICAGO, 'tokyo-2')).toBe('tokyo-2');
    expect(referenceCardId([TOKYO, twin], TOKYO_JUMP, CHICAGO, 'gone')).toBe('tokyo');
  });

  it('starts the picker on the card it was opened from, the reference, or My Local Time', () => {
    expect(initialReferenceKey(BOARD, CHICAGO, null, null)).toBe(LOCAL_KEY);
    expect(initialReferenceKey(BOARD, CHICAGO, TOKYO_JUMP, 'tokyo')).toBe('tokyo');
    expect(initialReferenceKey(BOARD, CHICAGO, null, null, 'london')).toBe('london');
    expect(initialReferenceKey(BOARD, CHICAGO, null, null, 'me')).toBe(LOCAL_KEY);
  });
});

describe('text', () => {
  it('banner: date, time and place (canvas JumpActive)', () => {
    expect(bannerWhen(TOKYO_JUMP, 'Tokyo', '12')).toBe('Fri, Dec 4, 2026 · 8:00 AM in Tokyo');
    expect(bannerWhen(TOKYO_JUMP, 'Tokyo', '24')).toBe('Fri, Dec 4, 2026 · 08:00 in Tokyo');
  });

  it('UTC equivalent (canvas JumpPicker)', () => {
    expect(utcLine(TOKYO_JUMP.instant, '12')).toBe(
      'That moment is Thu, Dec 3, 2026 · 11:00 PM UTC.',
    );
    expect(utcLine(TOKYO_JUMP.instant, '24')).toBe('That moment is Thu, Dec 3, 2026 · 23:00 UTC.');
  });

  it('fields for an instant, in the reference zone', () => {
    expect(wallFields(TOKYO_JUMP.instant, 'Asia/Tokyo', '12')).toEqual({
      date: '2026-12-04',
      time: '8:00 AM',
    });
    expect(wallFields(TOKYO_JUMP.instant, CHICAGO, '24')).toEqual({
      date: '2026-12-03',
      time: '17:00',
    });
  });

  it('skipped time, with the fix (canvas JumpPickerGap)', () => {
    const result = resolveWallTime(date('2027-03-14'), time('02:30'), 'America/New_York');
    if (result.kind !== 'gap') throw new Error(result.kind);
    expect(gapText(result, { hour: 2, minute: 30 }, date('2027-03-14'), 'New York', '12')).toEqual({
      time: '2:30 AM',
      rest: ' in New York on Mar 14, 2027. Clocks skip from 2:00 AM to 3:00 AM that night.',
      fix: 'Use 3:00 AM instead',
    });
  });

  it('a half-hour skip (Lord Howe Island)', () => {
    const result = resolveWallTime(date('2026-10-04'), time('02:15'), 'Australia/Lord_Howe');
    if (result.kind !== 'gap') throw new Error(result.kind);
    expect(gapText(result, { hour: 2, minute: 15 }, date('2026-10-04'), 'Lord Howe', '24')).toEqual(
      {
        time: '02:15',
        rest: ' in Lord Howe on Oct 4, 2026. Clocks skip from 02:00 to 02:30 that night.',
        fix: 'Use 02:30 instead',
      },
    );
  });

  it('repeated time, first one first (canvas JumpPickerOverlap)', () => {
    const result = resolveWallTime(date('2027-11-07'), time('01:30'), 'America/New_York');
    if (result.kind !== 'overlap') throw new Error(result.kind);
    const [option] = referenceOptions(
      [{ ...NEW_YORK, customName: 'New York' }],
      'Asia/Tokyo',
      null,
      null,
    ).slice(1);
    if (!option) throw new Error('no option');
    expect(overlapText(result, { hour: 1, minute: 30 }, date('2027-11-07'), option, '12')).toEqual({
      legend: 'Which 1:30 AM?',
      text: '1:30 AM happens twice in New York on Nov 7, 2027, when clocks go back.',
      choices: [
        { value: 'earlier', time: '1:30 AM EDT', detail: 'UTC−4:00, the first time' },
        { value: 'later', time: '1:30 AM EST', detail: 'UTC−5:00, the second time' },
      ],
    });
  });
});

describe('parseDateInput', () => {
  it('reads the date field’s value', () => {
    const parsed = parseDateInput('2026-12-04');
    expect(parsed.ok && parsed.date.toString()).toBe('2026-12-04');
  });

  it('treats an incomplete field as missing and far years as out of range (M1-7)', () => {
    expect(parseDateInput('')).toEqual({ ok: false, error: 'missing' });
    expect(parseDateInput('2026-02-30')).toEqual({ ok: false, error: 'missing' });
    expect(parseDateInput('1899-12-31')).toEqual({ ok: false, error: 'range' });
    expect(parseDateInput('2201-01-01')).toEqual({ ok: false, error: 'range' });
    expect(parseDateInput('2200-12-31').ok).toBe(true);
  });
});
