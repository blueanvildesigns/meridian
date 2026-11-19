import { beforeAll, describe, expect, it } from 'vitest';
import { buildSearchIndex, searchCities, type SearchIndex } from '../../cities/search';
import { realDataset } from '../../test/cityDataset';
import { instant } from '../../time/testUtils';
import {
  bandGroup,
  localTimeRow,
  offersLocalTime,
  resultRows,
  statusText,
  zoneBand,
  type RowContext,
} from './resultView';

// The canvas moment: 9:43 PM on Tue, Nov 17 in Chicago (03:43 UTC, Nov 18).
const AT = instant('2026-11-18T03:43:00Z');
const NOW = AT.epochMilliseconds;
let index: SearchIndex;

beforeAll(() => {
  index = buildSearchIndex(realDataset(), { now: NOW });
});

const ctx = (over: Partial<RowContext> = {}): RowContext => ({
  instant: AT,
  deviceZone: 'America/Chicago',
  hourCycle: '12',
  added: new Set(),
  ...over,
});
const rows = (q: string, over: Partial<RowContext> = {}) =>
  resultRows(searchCities(index, q), ctx(over));

describe('result rows (canvas AddCity)', () => {
  it('London: name, region and country, local time, offset and abbreviation', () => {
    expect(rows('london')[0]).toMatchObject({
      key: 'place:2643743',
      name: 'London',
      place: 'England, United Kingdom',
      time: '3:43',
      dayPeriod: 'AM',
      zoneLine: 'UTC+0:00 · GMT',
      added: false,
      label: 'London, England, United Kingdom, 3:43 AM, UTC+0:00 GMT',
    });
  });

  it('London, Ontario: the same name elsewhere, on Eastern time', () => {
    const ontario = rows('london').find((r) => r.place === 'Ontario, Canada');
    expect(ontario).toMatchObject({ time: '10:43', dayPeriod: 'PM', zoneLine: 'UTC−5:00 · EST' });
  });

  it('says "Added" for cities already on the list', () => {
    const [london] = rows('london', { added: new Set(['place:2643743']) });
    expect(london).toMatchObject({ added: true });
    expect(london?.label).toMatch(/, added$/);
  });

  it('saves the place’s own data, so startup never needs the dataset (D2)', () => {
    expect(rows('london')[0]?.city).toEqual({
      kind: 'place',
      zone: 'Europe/London',
      geonameId: 2643743,
      name: 'London',
      countryCode: 'GB',
      country: 'United Kingdom',
      region: 'England',
      lat: 51.5,
      lon: -0.1,
    });
  });

  it('uses 24-hour time when asked', () => {
    expect(rows('london', { hourCycle: '24' })[0]).toMatchObject({ time: '03:43', dayPeriod: '' });
  });
});

describe('match tags (canvas AddCityAirport)', () => {
  it('tags an airport match and each zone an ambiguous abbreviation names', () => {
    const ist = rows('ist');
    expect(ist[0]).toMatchObject({ name: 'Istanbul', tag: 'Airport IST' });
    expect(ist.find((r) => r.name === 'Kolkata')).toMatchObject({ tag: 'Time zone IST' });
    expect(ist.find((r) => r.name === 'Jerusalem')).toMatchObject({ tag: 'Time zone IST' });
    expect(ist[0]?.label).toContain('Airport IST');
  });

  it('tags an alias match with the name that matched', () => {
    expect(rows('bombay')[0]).toMatchObject({ name: 'Mumbai', tag: 'Also called Bombay' });
  });

  it('leaves name, country and region matches untagged', () => {
    expect(rows('tokyo')[0]?.tag).toBeUndefined();
    expect(rows('india')[0]?.tag).toBeUndefined();
  });

  it('shows a zone name prefix as the name itself', () => {
    const pacific = rows('pacific st').find((r) => r.tag);
    expect(pacific?.tag).toBe('Pacific Standard Time');
  });
});

describe('a single named zone (canvas AddCityZone)', () => {
  it('PST: a header band, no per-row tags, and a city count', () => {
    const response = searchCities(index, 'pst');
    const group = bandGroup(response);
    expect(group && zoneBand(group, AT)).toBe('Pacific Standard Time (PST) · UTC−8:00');
    const list = resultRows(response, ctx());
    expect(list[0]).toMatchObject({ name: 'Los Angeles', zoneLine: 'UTC−8:00 · PST' });
    expect(list.every((r) => r.tag === undefined)).toBe(true);
    expect(statusText(response)).toMatch(/^Showing 50 of \d+ cities in this time zone$/);
  });

  it('leaves the offset out when the zone is not on that time today', () => {
    const july = instant('2026-07-15T12:00:00Z');
    const response = searchCities(
      buildSearchIndex(realDataset(), { now: july.epochMilliseconds }),
      'pst',
    );
    const group = bandGroup(response);
    expect(group && zoneBand(group, july)).toBe('Pacific Standard Time (PST)');
  });

  it('several named zones give no band', () => {
    expect(bandGroup(searchCities(index, 'ist'))).toBeUndefined();
  });
});

describe('bare zones (D4, D9)', () => {
  it('UTC is a zone row with no place', () => {
    const [utc] = rows('UTC');
    expect(utc).toMatchObject({
      key: 'zone:UTC',
      city: { kind: 'zone', zone: 'UTC' },
      name: 'UTC',
      place: 'Time zone',
      time: '3:43',
      dayPeriod: 'AM',
    });
    expect(utc?.zoneLine).toMatch(/^UTC\+0:00/);
  });

  it('an IANA ID finds its zone', () => {
    expect(rows('Europe/Paris')[0]).toMatchObject({ name: 'Europe/Paris', place: 'Time zone' });
  });
});

describe('status line', () => {
  it('counts results', () => {
    expect(statusText(searchCities(index, 'london'))).toMatch(/^\d+ results$/);
    expect(statusText(searchCities(index, 'tokyo'))).toMatch(/^Showing 50 of \d+ results$/);
    expect(statusText(searchCities(index, 'reykjavik'))).toBe('1 result');
  });
});

describe('My Local Time (D13)', () => {
  it('is offered when missing, on an empty search or one that spells it', () => {
    const none = new Set<string>();
    expect(offersLocalTime('', none)).toBe(true);
    expect(offersLocalTime('loc', none)).toBe(true);
    expect(offersLocalTime('My local', none)).toBe(true);
    expect(offersLocalTime('lo', none)).toBe(false);
    expect(offersLocalTime('london', none)).toBe(false);
  });

  it('is not offered while it is on the list', () => {
    expect(offersLocalTime('', new Set(['local']))).toBe(false);
  });

  it('shows the detected zone and its time', () => {
    expect(localTimeRow(ctx())).toMatchObject({
      key: 'local',
      city: { kind: 'local' },
      name: 'My Local Time',
      place: 'Detected: America/Chicago',
      time: '9:43',
      dayPeriod: 'PM',
      zoneLine: 'UTC−6:00 · CST',
    });
  });
});
