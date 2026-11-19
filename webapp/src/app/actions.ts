// Pure changes to the city list. Each returns the same object when nothing changes, so the store
// can skip a pointless save.

import { newCityId, type AppState } from '../storage/schema';

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
