import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppState, type NewCity } from '../storage/schema';
import { KOLKATA, LONDON, NOWHERE, TOKYO } from '../test/places';
import {
  addCity,
  addLocalTime,
  moveCity,
  moveCityBy,
  removeCity,
  renameCity,
  replaceCity,
  restoreCity,
} from './actions';

const state = (cities: AppState['cities']): AppState => ({
  cities,
  settings: { ...DEFAULT_SETTINGS },
});
const ids = (s: AppState) => s.cities.map((c) => c.id);

describe('moveCity', () => {
  const s = state([LONDON, KOLKATA, TOKYO]);

  it('moves a card forward to the target position', () => {
    expect(ids(moveCity(s, 'london', 'tokyo'))).toEqual(['kolkata', 'tokyo', 'london']);
  });

  it('moves a card back to the target position', () => {
    expect(ids(moveCity(s, 'tokyo', 'london'))).toEqual(['tokyo', 'london', 'kolkata']);
  });

  it('returns the same state for a drop in place or an unknown ID', () => {
    expect(moveCity(s, 'london', 'london')).toBe(s);
    expect(moveCity(s, 'london', 'gone')).toBe(s);
    expect(moveCity(s, 'gone', 'london')).toBe(s);
  });

  it('leaves settings alone and does not mutate the input', () => {
    const next = moveCity(s, 'london', 'kolkata');
    expect(next.settings).toBe(s.settings);
    expect(ids(s)).toEqual(['london', 'kolkata', 'tokyo']);
  });
});

describe('removeCity', () => {
  it('removes the card with that ID', () => {
    expect(ids(removeCity(state([LONDON, TOKYO]), 'london'))).toEqual(['tokyo']);
  });

  it('returns the same state for an unknown ID', () => {
    const s = state([LONDON]);
    expect(removeCity(s, 'gone')).toBe(s);
  });
});

describe('addLocalTime', () => {
  it('adds My Local Time to an empty list', () => {
    const next = addLocalTime(state([]));
    expect(next.cities).toHaveLength(1);
    expect(next.cities[0]?.kind).toBe('local');
  });

  it('appends after existing cards', () => {
    const next = addLocalTime(state([LONDON]));
    expect(next.cities.map((c) => c.kind)).toEqual(['place', 'local']);
  });

  it('never adds a second My Local Time (D3)', () => {
    const s = state([{ id: 'l', kind: 'local', customName: 'Home' }]);
    expect(addLocalTime(s)).toBe(s);
  });
});

/** A fixture without its entry ID, as add-city hands it over. */
function asNew(city: AppState['cities'][number]): NewCity {
  const copy: Partial<AppState['cities'][number]> = { ...city };
  delete copy.id;
  return copy as NewCity;
}

describe('addCity', () => {
  it('appends a new entry with a fresh ID', () => {
    const next = addCity(state([LONDON]), asNew(TOKYO));
    expect(next.cities).toHaveLength(2);
    expect(next.cities[1]).toMatchObject({ kind: 'place', name: 'Tokyo', geonameId: 1850147 });
    expect(next.cities[1]?.id).not.toBe('tokyo');
  });

  it('does not add a place, zone or My Local Time twice (D3)', () => {
    const s = state([LONDON, { id: 'u', kind: 'zone', zone: 'UTC' }, { id: 'l', kind: 'local' }]);
    expect(addCity(s, asNew(LONDON))).toBe(s);
    expect(addCity(s, { kind: 'zone', zone: 'UTC' })).toBe(s);
    expect(addCity(s, { kind: 'local' })).toBe(s);
  });

  it('allows two places that share a name', () => {
    const londonOntario = asNew({ ...LONDON, geonameId: 6058560, zone: 'America/Toronto' });
    expect(addCity(state([LONDON]), londonOntario).cities).toHaveLength(2);
  });
});

describe('replaceCity (D14)', () => {
  const s = state([LONDON, NOWHERE, TOKYO]);

  it('puts the new city in the same position, keeping the entry ID', () => {
    const next = replaceCity(s, 'nowhere', asNew(KOLKATA));
    expect(ids(next)).toEqual(['london', 'nowhere', 'tokyo']);
    expect(next.cities[1]).toMatchObject({ kind: 'place', name: 'Kolkata', zone: 'Asia/Kolkata' });
  });

  it('keeps a rename, and only a rename', () => {
    const renamed = state([{ ...NOWHERE, customName: 'Base camp' }]);
    expect(replaceCity(renamed, 'nowhere', asNew(KOLKATA)).cities[0]).toMatchObject({
      name: 'Kolkata',
      customName: 'Base camp',
    });
    expect(replaceCity(s, 'nowhere', asNew(KOLKATA)).cities[1]).not.toHaveProperty('customName');
  });

  it('can replace with a bare zone or My Local Time', () => {
    expect(replaceCity(s, 'nowhere', { kind: 'zone', zone: 'UTC' }).cities[1]).toEqual({
      id: 'nowhere',
      kind: 'zone',
      zone: 'UTC',
    });
    expect(replaceCity(s, 'nowhere', { kind: 'local' }).cities[1]).toEqual({
      id: 'nowhere',
      kind: 'local',
    });
  });

  it('does nothing if the city is already elsewhere on the list, or the entry is gone', () => {
    expect(replaceCity(s, 'nowhere', asNew(TOKYO))).toBe(s);
    expect(replaceCity(s, 'gone', asNew(KOLKATA))).toBe(s);
  });
});

describe('moveCityBy (card menu)', () => {
  const s = state([LONDON, KOLKATA, TOKYO]);

  it('moves a card one place up or down', () => {
    expect(ids(moveCityBy(s, 'kolkata', -1))).toEqual(['kolkata', 'london', 'tokyo']);
    expect(ids(moveCityBy(s, 'kolkata', 1))).toEqual(['london', 'tokyo', 'kolkata']);
  });

  it('does nothing at either end or for an unknown ID', () => {
    expect(moveCityBy(s, 'london', -1)).toBe(s);
    expect(moveCityBy(s, 'tokyo', 1)).toBe(s);
    expect(moveCityBy(s, 'gone', 1)).toBe(s);
  });
});

describe('restoreCity (Undo)', () => {
  it('puts the city back where it was', () => {
    const s = state([LONDON, TOKYO]);
    expect(ids(restoreCity(s, KOLKATA, 1))).toEqual(['london', 'kolkata', 'tokyo']);
    expect(ids(restoreCity(s, KOLKATA, 0))).toEqual(['kolkata', 'london', 'tokyo']);
  });

  it('goes at the end when the list has shrunk meanwhile', () => {
    expect(ids(restoreCity(state([TOKYO]), LONDON, 4))).toEqual(['tokyo', 'london']);
  });

  it('does nothing if the city is back on the list already', () => {
    const s = state([LONDON, TOKYO]);
    expect(restoreCity(s, LONDON, 0)).toBe(s);
    expect(restoreCity(s, { ...LONDON, id: 'london-again' }, 0)).toBe(s);
  });
});

describe('renameCity (D15)', () => {
  it('sets a tidied name', () => {
    const next = renameCity(state([LONDON]), 'london', '  London   office ');
    expect(next.cities[0]).toEqual({ ...LONDON, customName: 'London office' });
  });

  it('cuts a long name to 60 characters', () => {
    const next = renameCity(state([LONDON]), 'london', 'x'.repeat(80));
    expect(next.cities[0]?.customName).toHaveLength(60);
  });

  it('goes back to the city’s own name when emptied or set to it', () => {
    const renamed = state([{ ...LONDON, customName: 'Office' }]);
    expect(renameCity(renamed, 'london', '   ').cities[0]).toEqual(LONDON);
    expect(renameCity(renamed, 'london', 'London').cities[0]).toEqual(LONDON);
    expect(
      renameCity(state([{ id: 'me', kind: 'local', customName: 'Home' }]), 'me', '').cities[0],
    ).toEqual({ id: 'me', kind: 'local' });
  });

  it('returns the same state when nothing changes', () => {
    const s = state([LONDON, TOKYO]);
    expect(renameCity(s, 'london', 'London')).toBe(s);
    expect(renameCity(s, 'gone', 'Anything')).toBe(s);
  });
});
