// Pure changes to the city list. Each returns the same object when nothing changes, so the store
// can skip a pointless save.

import {
  cityKey,
  newCityId,
  type AppState,
  type NewCity,
  type StoredCity,
} from '../storage/schema';

/** Moves `activeId` to where `overId` is now (drag and drop). */
export function moveCity(state: AppState, activeId: string, overId: string): AppState {
  const from = state.cities.findIndex((c) => c.id === activeId);
  const to = state.cities.findIndex((c) => c.id === overId);
  if (from < 0 || to < 0 || from === to) return state;
  const cities = [...state.cities];
  const [moved] = cities.splice(from, 1);
  if (!moved) return state;
  cities.splice(to, 0, moved);
  return { ...state, cities };
}

export function removeCity(state: AppState, id: string): AppState {
  const cities = state.cities.filter((c) => c.id !== id);
  return cities.length === state.cities.length ? state : { ...state, cities };
}

/** Adds My Local Time at the end, unless it's already on the list (D3). */
export function addLocalTime(state: AppState): AppState {
  if (state.cities.some((c) => c.kind === 'local')) return state;
  return { ...state, cities: [...state.cities, { id: newCityId(), kind: 'local' }] };
}

/** Adds a city at the end, unless the same place, zone or My Local Time is already there (D3). */
export function addCity(state: AppState, city: NewCity): AppState {
  const key = cityKey(city);
  if (state.cities.some((c) => cityKey(c) === key)) return state;
  const entry: StoredCity = { ...city, id: newCityId() };
  return { ...state, cities: [...state.cities, entry] };
}

/**
 * Puts `city` in place of entry `id`, keeping its position, ID and any rename (D14: "Choose a
 * zone" on an unrecognised card). Nothing changes if `city` is already elsewhere on the list.
 */
export function replaceCity(state: AppState, id: string, city: NewCity): AppState {
  const i = state.cities.findIndex((c) => c.id === id);
  const old = state.cities[i];
  if (!old) return state;
  const key = cityKey(city);
  if (state.cities.some((c) => c.id !== id && cityKey(c) === key)) return state;
  const entry: StoredCity =
    old.customName === undefined ? { ...city, id } : { ...city, id, customName: old.customName };
  const cities = [...state.cities];
  cities[i] = entry;
  return { ...state, cities };
}
