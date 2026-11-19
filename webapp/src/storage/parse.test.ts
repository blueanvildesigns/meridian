import { describe, expect, it } from 'vitest';
import { parseState } from './parse';
import { cityKey, displayName, LOCAL_TIME_NAME, newCityId, type PlaceCity } from './schema';

const TOKYO: PlaceCity = {
  id: 't',
  kind: 'place',
  zone: 'Asia/Tokyo',
  geonameId: 1850147,
  name: 'Tokyo',
  countryCode: 'JP',
  country: 'Japan',
  region: 'Tokyo',
  lat: 35.69,
  lon: 139.69,
};

describe('parseState', () => {
  it('reads valid data with no repairs', () => {
    const r = parseState({ cities: [TOKYO, { id: 'z', kind: 'zone', zone: 'UTC' }] });
    expect(r.repairs).toBe(0);
    expect(r.state.cities).toHaveLength(2);
  });

  it('keeps entries whose zone the engine may not know (they get the "Choose a zone" card)', () => {
    const r = parseState({ cities: [{ ...TOKYO, zone: 'Mars/Olympus_Mons' }] });
    expect(r.repairs).toBe(0);
    expect(r.state.cities[0]).toMatchObject({ zone: 'Mars/Olympus_Mons' });
  });

  it.each([
    ['no id', { ...TOKYO, id: undefined }],
    ['blank id', { ...TOKYO, id: '  ' }],
    ['unknown kind', { ...TOKYO, kind: 'planet' }],
    ['missing zone', { id: 'z', kind: 'zone' }],
    ['bad geonameId', { ...TOKYO, geonameId: -1 }],
    ['fractional geonameId', { ...TOKYO, geonameId: 1.5 }],
    ['lowercase country code', { ...TOKYO, countryCode: 'jp' }],
    ['latitude out of range', { ...TOKYO, lat: 91 }],
    ['longitude not a number', { ...TOKYO, lon: '139' }],
    ['missing name', { ...TOKYO, name: '' }],
  ])('drops an entry with %s', (_label, entry) => {
    const r = parseState({ cities: [entry, { id: 'l', kind: 'local' }] });
    expect(r.repairs).toBe(1);
    expect(r.state.cities).toEqual([{ id: 'l', kind: 'local' }]);
  });

  it('de-duplicates by place, My Local Time and bare zone, keeping the first (D3)', () => {
    const r = parseState({
      cities: [
        TOKYO,
        { ...TOKYO, id: 't2', customName: 'Office' },
        { id: 'l1', kind: 'local' },
        { id: 'l2', kind: 'local' },
        { id: 'u1', kind: 'zone', zone: 'UTC' },
        { id: 'u2', kind: 'zone', zone: 'UTC' },
        { ...TOKYO, id: 'o', geonameId: 1853909, name: 'Osaka' },
      ],
    });
    expect(r.state.cities.map((c) => c.id)).toEqual(['t', 'l1', 'u1', 'o']);
    expect(r.repairs).toBe(3);
  });

  it('gives a repeated id a fresh one instead of dropping the entry', () => {
    const r = parseState({ cities: [TOKYO, { id: 't', kind: 'local' }] });
    expect(r.state.cities).toHaveLength(2);
    expect(r.state.cities[1]?.id).not.toBe('t');
    expect(r.repairs).toBe(1);
  });

  it('cleans custom names and drops empty ones', () => {
    const r = parseState({
      cities: [
        { id: 'a', kind: 'local', customName: '  Home\nbase  ' },
        { id: 'b', kind: 'zone', zone: 'UTC', customName: '   ' },
        { id: 'c', kind: 'zone', zone: 'Etc/GMT+5', customName: 42 },
        { ...TOKYO, customName: 'Head office' },
      ],
    });
    expect(r.state.cities.map(displayName)).toEqual([
      'Home base',
      'UTC',
      'Etc/GMT+5',
      'Head office',
    ]);
    expect(r.repairs).toBe(3);
  });

  it('drops a malformed region but keeps the place', () => {
    const r = parseState({ cities: [{ ...TOKYO, region: 7 }] });
    expect(r.state.cities[0]).not.toHaveProperty('region');
    expect(r.repairs).toBe(1);
  });

  it('treats a non-array city list and non-object settings as repairs', () => {
    const r = parseState({ cities: 'nope', settings: 3 });
    expect(r.state.cities).toEqual([]);
    expect(r.state.settings).toEqual({ timeFormat: 'browser', appearance: 'system' });
    expect(r.repairs).toBe(2);
  });

  it('accepts missing sections silently', () => {
    expect(parseState({}).repairs).toBe(0);
  });
});

describe('schema helpers', () => {
  it('names entries by kind', () => {
    expect(displayName({ id: 'l', kind: 'local' })).toBe(LOCAL_TIME_NAME);
    expect(displayName({ id: 'z', kind: 'zone', zone: 'UTC' })).toBe('UTC');
    expect(displayName(TOKYO)).toBe('Tokyo');
    expect(displayName({ ...TOKYO, customName: 'Office' })).toBe('Office');
  });

  it('keys entries for de-duplication', () => {
    expect(cityKey({ id: 'l', kind: 'local' })).toBe('local');
    expect(cityKey({ id: 'z', kind: 'zone', zone: 'UTC' })).toBe('zone:UTC');
    expect(cityKey(TOKYO)).toBe('place:1850147');
  });

  it('makes unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, newCityId));
    expect(ids.size).toBe(100);
  });
});
