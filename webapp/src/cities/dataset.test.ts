import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidZone, ZONE_ALIASES } from '../time/zones';
import { decodeDataset, DatasetError, loadDataset, resetDatasetCache } from './dataset';
import { fold, isLatinFolded } from './fold';
import { realDataset } from '../test/cityDataset';

const RAW = readFileSync(resolve('src/cities/data/cities.v1.json'));

describe('the generated dataset', () => {
  const data = realDataset();

  it('stays near the ~400 KB target (M2-10), well inside the 1.5 MB budget', () => {
    // 393 KB gzip at the 2026-11-18 export, 423 KB with the airports and their towns (M4-1, M4-2);
    // the headroom absorbs normal GeoNames growth.
    expect(gzipSync(RAW, { level: 9 }).length).toBeLessThan(470_000);
  });

  it('credits GeoNames under CC BY 4.0', () => {
    expect(data.source).toMatchObject({ name: 'GeoNames', license: 'CC BY 4.0' });
    expect(data.source.dumpDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has places of 50,000+ people, capitals and airport towns (M2-10, M4-2), each once', () => {
    expect(data.places.length).toBeGreaterThan(12_000);
    expect(data.places.length).toBeLessThan(15_000);
    expect(new Set(data.places.map((p) => p.geonameId)).size).toBe(data.places.length);
    expect(data.places.every((p, i) => p.rank === i)).toBe(true);
  });

  it('uses only current zone names this engine knows (no legacy aliases)', () => {
    for (const zone of data.zones) {
      expect(isValidZone(zone), zone).toBe(true);
      expect(ZONE_ALIASES[zone], zone).toBeUndefined();
    }
  });

  it('has a country name and valid coordinates for every place', () => {
    for (const p of data.places) {
      expect(p.country, p.name).not.toBe('');
      expect(p.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
    }
  });

  it('keeps aliases short, Latin-script, distinct from the name and not another country', () => {
    const countryKeys = new Map<string, string>();
    for (const [code, names] of data.countries)
      for (const n of names) countryKeys.set(fold(n), code);
    for (const p of data.places) {
      expect(p.aliases.length, p.name).toBeLessThanOrEqual(6);
      const keys = p.aliases.map(fold);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(isLatinFolded(key), `${p.name}: ${key}`).toBe(true);
        expect(key.length).toBeLessThanOrEqual(40);
        expect(key).not.toBe(fold(p.name));
        const other = countryKeys.get(key);
        if (other) expect(other, `${p.name}: ${key}`).toBe(p.countryCode);
      }
    }
  });

  it('keeps small capitals and at least one place in every zone', () => {
    const names = new Set(data.places.map((p) => p.name));
    for (const capital of ['Vaduz', 'Ngerulmud', 'Funafuti', 'Vatican City', 'Stanley']) {
      expect(names, capital).toContain(capital);
    }
    const zonesWithPlaces = new Set(data.places.map((p) => p.zone));
    expect(data.zones.filter((z) => !zonesWithPlaces.has(z))).toEqual([]);
  });

  it('puts the biggest cities first', () => {
    const first = data.places.slice(0, 20).map((p) => p.name);
    expect(first).toEqual(expect.arrayContaining(['Shanghai', 'Beijing', 'Mumbai', 'Delhi']));
  });

  it('credits OurAirports, which is public domain (M4-1)', () => {
    const json = JSON.parse(RAW.toString('utf8')) as { airportSource: unknown };
    expect(json.airportSource).toMatchObject({ name: 'OurAirports', license: 'Public domain' });
  });

  it('has thousands of airports, each code once and linked to the place it serves', () => {
    const { airports, places } = data;
    expect(airports.length).toBeGreaterThan(2_000);
    expect(new Set(airports.map((a) => a.code)).size).toBe(airports.length);
    expect(airports.every((a) => /^[A-Z]{3}$/.test(a.code))).toBe(true);
    const byId = new Map(places.map((p) => [p.geonameId, p]));
    const served = (code: string) => {
      const a = airports.find((x) => x.code === code);
      const p = a && byId.get(a.geonameId);
      return p && `${p.name}, ${p.countryCode}`;
    };
    expect(served('LHR')).toBe('London, GB');
    expect(served('STN')).toBe('London, GB');
    expect(served('JFK')).toBe('New York City, US');
    expect(served('IST')).toBe('Istanbul, TR');
    expect(served('HND')).toBe('Tokyo, JP');
    expect(served('MXP')).toBe('Milan, IT');
    expect(served('BGY')).toBe('Bergamo, IT');
    expect(served('IAD')).toBe('Washington, US');
    // A town under 50,000 kept because its airport is (M4-2).
    expect(served('TOS')).toBe('Tromsø, NO');
  });

  it('uses CLDR country names where GeoNames differs', () => {
    expect(data.countries.get('TR')).toEqual(['Türkiye', 'Turkey']);
    expect(data.countries.get('US')?.[0]).toBe('United States');
    expect(data.countries.get('HK')?.[0]).toBe('Hong Kong');
  });
});

describe('decodeDataset', () => {
  const minimal = {
    format: 1,
    source: { name: 'GeoNames', license: 'CC BY 4.0', dumpDate: '2026-11-18' },
    countries: { GB: ['United Kingdom', 'UK'] },
    regions: { 'GB.ENG': 'England' },
    zones: ['Europe/London'],
    cities: [
      [2643743, 'London', 'GB', 'ENG', 0, 51.5, -0.1, ['Londres']],
      [2633352, 'York', 'GB', '', 0, 54, -1.1],
    ],
  };

  it('decodes airports, keyed by the place’s GeoNames ID', () => {
    const d = decodeDataset({ ...minimal, airports: [['LHR', 0]] });
    expect(d.airports).toEqual([{ code: 'LHR', geonameId: 2643743 }]);
  });

  it('accepts a file with no airports', () => {
    expect(decodeDataset(minimal).airports).toEqual([]);
  });

  it('decodes rows into places', () => {
    const d = decodeDataset(minimal);
    expect(d.places).toEqual([
      {
        rank: 0,
        geonameId: 2643743,
        name: 'London',
        countryCode: 'GB',
        country: 'United Kingdom',
        region: 'England',
        zone: 'Europe/London',
        lat: 51.5,
        lon: -0.1,
        aliases: ['Londres'],
      },
      {
        rank: 1,
        geonameId: 2633352,
        name: 'York',
        countryCode: 'GB',
        country: 'United Kingdom',
        zone: 'Europe/London',
        lat: 54,
        lon: -1.1,
        aliases: [],
      },
    ]);
  });

  it.each([
    ['another format', { ...minimal, format: 2 }],
    ['no cities', { ...minimal, cities: undefined }],
    ['a row with an unknown zone index', { ...minimal, cities: [[1, 'X', 'GB', '', 5, 0, 0]] }],
    ['a row with an unknown country', { ...minimal, cities: [[1, 'X', 'FR', '', 0, 0, 0]] }],
    ['a short row', { ...minimal, cities: [[1, 'X', 'GB']] }],
    ['no source', { ...minimal, source: {} }],
    ['an airport pointing past the cities', { ...minimal, airports: [['LHR', 2]] }],
    ['an airport with no code', { ...minimal, airports: [[null, 0]] }],
    ['airports that are not a list', { ...minimal, airports: {} }],
    ['not an object', 'cities'],
  ])('rejects %s', (_label, json) => {
    expect(() => decodeDataset(json)).toThrow(DatasetError);
  });
});

describe('loadDataset', () => {
  afterEach(resetDatasetCache);
  const ok = () =>
    Promise.resolve(new Response(RAW, { headers: { 'content-type': 'application/json' } }));

  it('fetches the hashed asset once and reuses it', async () => {
    const fetcher = vi.fn<typeof fetch>(ok);
    const [a, b] = await Promise.all([loadDataset(fetcher), loadDataset(fetcher)]);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toMatch(/cities\.v1.*\.json/);
    expect(a.places.length).toBeGreaterThan(12_000);
  });

  it('tries again after a failure instead of remembering it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementationOnce(ok);
    await expect(loadDataset(fetcher)).rejects.toThrow(DatasetError);
    await expect(loadDataset(fetcher)).resolves.toHaveProperty('zones');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
