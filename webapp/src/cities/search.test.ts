import { beforeAll, describe, expect, it } from 'vitest';
import type { Place } from './dataset';
import {
  buildSearchIndex,
  RESULT_LIMIT,
  searchCities,
  type SearchIndex,
  type SearchResult,
} from './search';
import { realDataset } from '../test/cityDataset';

// A fixed "now" keeps zone names stable: 2026-11-18 is winter in the north (PST, not PDT).
const NOW = Date.UTC(2026, 10, 18, 12);
let index: SearchIndex;

beforeAll(() => {
  index = buildSearchIndex(realDataset(), { now: NOW });
});

const search = (q: string) => searchCities(index, q);
const label = (r: SearchResult | undefined) =>
  r === undefined
    ? 'none'
    : r.type === 'zone'
      ? `zone ${r.zone}`
      : `${r.place.name}, ${r.place.countryCode}`;
const top = (q: string, n = 1) => search(q).results.slice(0, n).map(label);
const place = (r: SearchResult | undefined): Place => {
  if (r?.type !== 'place') throw new Error(`Expected a place, got ${label(r)}`);
  return r.place;
};

describe('the old app’s search failures (REVERSE_ENGINEERING §2.3, bug 13)', () => {
  it.each([
    ['new york', 'New York City, US'],
    ['New York', 'New York City, US'],
    ['mumbai', 'Mumbai, IN'],
    ['san francisco', 'San Francisco, US'],
    ['beijing', 'Beijing, CN'],
  ])('%s → %s first', (q, expected) => {
    expect(top(q)).toEqual([expected]);
  });

  it('pst → Pacific time, one zone band, Los Angeles first', () => {
    const r = search('pst');
    expect(r.zoneGroups).toEqual([
      expect.objectContaining({ name: 'Pacific Standard Time', abbreviation: 'PST' }),
    ]);
    expect(r.zoneGroups[0]?.zones).toEqual(
      expect.arrayContaining(['America/Los_Angeles', 'America/Tijuana']),
    );
    expect(label(r.results[0])).toBe('Los Angeles, US');
    const names = r.results.map(label);
    expect(names).toEqual(expect.arrayContaining(['Seattle, US', 'Tijuana, MX']));
    expect(r.results[0]).toMatchObject({ match: 'zone', matched: 'PST' });
    // Vancouver isn't asserted here: tz 2026e keeps British Columbia on UTC−7 all year (PDT), so
    // whether "pst" finds it depends on the engine's tz version. The search follows the engine.
  });

  it('pdt finds Vancouver under any tz version (summer time before 2026e, all year after)', () => {
    expect(search('pdt').results.map(label)).toContain('Vancouver, CA');
  });

  it('india → Indian cities, not Indiana', () => {
    const r = search('india');
    expect(top('india', 3)).toEqual(['Mumbai, IN', 'Delhi, IN', 'Bengaluru, IN']);
    expect(r.results[0]).toMatchObject({ match: 'country', matched: 'India' });
    expect(r.results.slice(0, 20).every((x) => place(x).countryCode === 'IN')).toBe(true);
  });

  it('hides legacy aliases: US/Central is never offered as a zone', () => {
    for (const q of ['us/central', 'US/Central', 'central']) {
      expect(search(q).results.some((x) => x.type === 'zone' && x.zone === 'US/Central')).toBe(
        false,
      );
    }
  });
});

describe('names and aliases', () => {
  it.each([
    ['bombay', 'Mumbai, IN', 'Bombay'],
    ['calcutta', 'Kolkata, IN', 'Calcutta'],
    ['saigon', 'Ho Chi Minh City, VN', 'Saigon'],
    ['peking', 'Beijing, CN', 'Peking'],
    ['kiev', 'Kyiv, UA', 'Kiev'],
    ['nyc', 'New York City, US', 'NYC'],
    ['münchen', 'Munich, DE', 'München'],
  ])('%s finds %s through the alias %s', (q, expected, alias) => {
    const r = search(q).results[0];
    expect(label(r)).toBe(expected);
    expect(r).toMatchObject({ match: 'alias', matched: alias });
  });

  it.each([
    ['sao paulo', 'São Paulo, BR'],
    ['SÃO PAULO', 'São Paulo, BR'],
    ['zurich', 'Zürich, CH'],
    ['st johns', "St. John's, CA"],
    ['ho chi minh', 'Ho Chi Minh City, VN'],
    ['krakow', 'Kraków, PL'],
  ])('ignores accents, case and punctuation: %s → %s', (q, expected) => {
    expect(top(q)).toEqual([expected]);
  });

  it('ranks exact names and aliases above prefixes, then by population', () => {
    expect(top('london', 2)).toEqual(['London, GB', 'London, CA']);
    // A smaller place really named Mexico doesn't outrank the big city's alias.
    expect(top('calcutta')).toEqual(['Kolkata, IN']);
    expect(top('mexico')).toEqual(['Mexico City, MX']);
    expect(search('paris').results[0]).toMatchObject({ match: 'name' });
    expect(top('paris')).toEqual(['Paris, FR']);
  });

  it('understands a region or country after the name', () => {
    expect(top('london ontario')).toEqual(['London, CA']);
    expect(top('london, canada')).toEqual(['London, CA']);
    expect(place(search('portland maine').results[0]).region).toBe('Maine');
    expect(place(search('portland oregon').results[0]).region).toBe('Oregon');
    expect(place(search('birmingham alabama').results[0]).countryCode).toBe('US');
    expect(place(search('birmingham england').results[0]).countryCode).toBe('GB');
  });

  it('matches later words of a name', () => {
    expect(search('york').results.map(label)).toContain('New York City, US');
  });

  it('carries what the row needs: region and country', () => {
    const london = place(search('london').results[0]);
    expect(london).toMatchObject({
      region: 'England',
      country: 'United Kingdom',
      zone: 'Europe/London',
    });
    const istanbul = place(search('istanbul').results[0]);
    expect(istanbul.country).toBe('Türkiye');
  });
});

describe('countries and regions', () => {
  it.each([
    ['usa', 'US'],
    ['united states', 'US'],
    ['uk', 'GB'],
    ['great britain', 'GB'],
    ['holland', 'NL'],
    ['turkey', 'TR'],
    ['türkiye', 'TR'],
  ])('%s lists cities in %s', (q, code) => {
    const first = search(q).results.find((r) => r.type === 'place' && r.match === 'country');
    expect(first && place(first).countryCode).toBe(code);
  });

  it('a region name lists its cities: england, california', () => {
    expect(
      search('england')
        .results.slice(0, 5)
        .every((r) => place(r).region === 'England'),
    ).toBe(true);
    expect(top('california')).toEqual(['Los Angeles, US']);
  });
});

describe('time zones', () => {
  it('ist is ambiguous: one place per zone, tagged with the abbreviation', () => {
    const r = search('ist');
    const names = r.zoneGroups.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining(['India Standard Time', 'Israel Standard Time']));
    expect(r.zoneGroups.length).toBeGreaterThanOrEqual(2);
    const tagged = r.results.filter((x) => x.type === 'place' && x.match === 'zone');
    expect(tagged.map(label)).toEqual(expect.arrayContaining(['Kolkata, IN', 'Jerusalem, IL']));
    expect(tagged.every((x) => x.type === 'place' && x.matched === 'IST')).toBe(true);
    // One representative per zone, not every Indian city.
    expect(tagged.filter((x) => place(x).zone === 'Asia/Kolkata')).toHaveLength(1);
  });

  it('a summer abbreviation still works in winter: pdt', () => {
    expect(search('pdt').zoneGroups[0]).toMatchObject({ abbreviation: 'PDT' });
    expect(top('pdt')).toEqual(['Los Angeles, US']);
  });

  it.each([
    ['est', 'New York City, US'],
    ['jst', 'Tokyo, JP'],
    ['aedt', 'Sydney, AU'],
    ['cet', 'Berlin, DE'],
  ])('%s → %s first', (q, expected) => {
    expect(top(q)).toEqual([expected]);
  });

  it('finds long and generic names: "Central time", "India Standard Time"', () => {
    const central = search('Central time');
    expect(central.zoneGroups).toEqual([expect.objectContaining({ name: 'Central Time' })]);
    expect(central.results.map(label)).toContain('Chicago, US');
    const india = search('india standard time').zoneGroups;
    expect(india).toHaveLength(1);
    expect(india[0]?.zones[0]).toBe('Asia/Kolkata');
  });

  it('finds zone names by prefix, one place per zone, ranked last', () => {
    const r = search('pacific');
    expect(r.results.map(label)).toContain('Los Angeles, US');
  });
});

describe('IANA IDs (D9)', () => {
  it('finds a zone by its ID and by a prefix', () => {
    expect(top('America/New_York')).toEqual(['zone America/New_York']);
    expect(top('america/new york')).toEqual(['zone America/New_York']);
    expect(search('Europe/Lon').results.map(label)).toContain('zone Europe/London');
  });

  it('offers UTC as a bare zone', () => {
    expect(top('utc')).toEqual(['zone UTC']);
    expect(top('UTC')).toEqual(['zone UTC']);
  });

  it('maps a typed legacy ID to the current zone', () => {
    expect(top('Asia/Calcutta')).toEqual(['zone Asia/Kolkata']);
  });
});

describe('airport codes (M4-1)', () => {
  it('find the place an airport serves, tagged with the code', () => {
    expect(search('lhr').results[0]).toMatchObject({
      type: 'place',
      place: { name: 'London', countryCode: 'GB' },
      match: 'airport',
      matched: 'LHR',
    });
    expect(top('jfk')).toEqual(['New York City, US']);
  });

  it('IST lists Istanbul’s airport and the zones abbreviated IST (canvas AddCityAirport)', () => {
    const results = search('ist').results;
    expect(results[0]).toMatchObject({
      place: { name: 'Istanbul' },
      match: 'airport',
      matched: 'IST',
    });
    const zones = results.filter((r) => r.type === 'place' && r.match === 'zone');
    expect(zones.map(label)).toEqual(expect.arrayContaining(['Kolkata, IN', 'Jerusalem, IL']));
  });

  it('can be overridden', () => {
    const london = place(search('london').results[0]);
    const withAirports = buildSearchIndex(realDataset(), {
      now: NOW,
      airports: [{ code: 'XYZ', geonameId: london.geonameId }],
    });
    expect(searchCities(withAirports, 'lhr').results).toEqual([]);
    expect(searchCities(withAirports, 'xyz').results[0]).toMatchObject({
      type: 'place',
      place: { geonameId: london.geonameId },
      match: 'airport',
      matched: 'XYZ',
    });
  });
});

describe('limits', () => {
  it('returns nothing for an empty or punctuation-only query', () => {
    expect(search('').results).toEqual([]);
    expect(search('  ,. ').total).toBe(0);
  });

  it('says so when nothing matches', () => {
    expect(search('xyzzy')).toEqual({ results: [], total: 0, zoneGroups: [] });
  });

  it(`caps results at ${RESULT_LIMIT} and reports the total`, () => {
    const r = search('a');
    expect(r.results).toHaveLength(RESULT_LIMIT);
    expect(r.total).toBeGreaterThan(RESULT_LIMIT);
  });

  it('never lists a place twice', () => {
    for (const q of ['new york', 'ist', 'india', 'london ontario', 'georgia', 'a']) {
      const ids = search(q).results.map((r) => (r.type === 'zone' ? r.zone : r.place.geonameId));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('is fast enough to run on every keystroke', () => {
    const queries = [
      'n',
      'ne',
      'new',
      'new y',
      'new york',
      'l',
      'lo',
      'lon',
      'london on',
      'ist',
      'pst',
    ];
    const start = performance.now();
    for (const q of queries) search(q);
    const perQuery = (performance.now() - start) / queries.length;
    expect(perQuery).toBeLessThan(50);
  });
});
