// Pure changes to the city list. Each returns the same object when nothing changes, so the store
// can skip a pointless save.

import {
  cityKey,
  defaultName,
  newCityId,
  type AppState,
  type NewCity,
  type Settings,
  type StoredCity,
} from '../storage/schema';
import { cleanName } from '../text/name';

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

/** Moves a card one place up (-1) or down (+1): the card menu's keyboard path (spec 4.4). */
export function moveCityBy(state: AppState, id: string, step: -1 | 1): AppState {
  const from = state.cities.findIndex((c) => c.id === id);
  const neighbour = state.cities[from + step];
  return from < 0 || !neighbour ? state : moveCity(state, id, neighbour.id);
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

/**
 * Puts a removed city back at `index` (Undo, spec 4.4), or at the end if the list is shorter now.
 * Nothing changes if it, or the same place, zone or My Local Time, is on the list again.
 */
export function restoreCity(state: AppState, city: StoredCity, index: number): AppState {
  const key = cityKey(city);
  if (state.cities.some((c) => c.id === city.id || cityKey(c) === key)) return state;
  const cities = [...state.cities];
  cities.splice(Math.min(Math.max(index, 0), cities.length), 0, city);
  return { ...state, cities };
}

/**
 * Renames a card (D15): the name is tidied by cleanName, and an empty name or the city's own name
 * goes back to that own name, so the card follows it again.
 */
export function renameCity(state: AppState, id: string, name: string): AppState {
  const i = state.cities.findIndex((c) => c.id === id);
  const old = state.cities[i];
  if (!old) return state;
  const clean = cleanName(name);
  const customName = clean === undefined || clean === defaultName(old) ? undefined : clean;
  if (customName === old.customName) return state;
  const entry: StoredCity = { ...old };
  if (customName === undefined) delete entry.customName;
  else entry.customName = customName;
  const cities = [...state.cities];
  cities[i] = entry;
  return { ...state, cities };
}

/** Time format or appearance from Settings (spec 4.5); they apply at once. */
export function changeSettings(state: AppState, change: Partial<Settings>): AppState {
  const settings = { ...state.settings, ...change };
  const same =
    settings.timeFormat === state.settings.timeFormat &&
    settings.appearance === state.settings.appearance;
  return same ? state : { ...state, settings };
}
