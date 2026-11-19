import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppState } from '../storage/schema';
import { KOLKATA, LONDON, TOKYO } from '../test/places';
import { addLocalTime, moveCity, removeCity } from './actions';

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
