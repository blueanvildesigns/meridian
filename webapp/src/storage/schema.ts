// What Meridian keeps in the browser (decisions D2, D3, D19, refined in M2-1).
// Everything lives under one localStorage key so a single write is atomic.

import type { Appearance } from '../app/themeBoot';
import type { TimeFormatSetting } from '../time/format';

export { STORAGE_KEY } from '../app/themeBoot';

/** Bump this and add a migration in `migrations.ts` whenever the stored shape changes. */
export const SCHEMA_VERSION = 1;

/** Where unreadable or partly unreadable data is copied before anything overwrites it. */
export const BACKUP_KEY = 'meridian.backup';

export const LOCAL_TIME_NAME = 'My Local Time';

export interface Settings {
  timeFormat: TimeFormatSetting;
  appearance: Appearance;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = { timeFormat: 'browser', appearance: 'system' };

interface CityBase {
  /** Stable per-entry ID (random), so React keys and Undo survive renames and moves. */
  id: string;
  /** The user's rename, if any. Absent means the default name; clearing a rename deletes it. */
  customName?: string;
}

/** "My Local Time": follows the device's zone, whatever it is today. */
export interface LocalCity extends CityBase {
  kind: 'local';
}

/** A bare IANA zone such as UTC (D4). */
export interface ZoneCity extends CityBase {
  kind: 'zone';
  zone: string;
}

/** A GeoNames place, copied in when added so startup never needs the city dataset (D2). */
export interface PlaceCity extends CityBase {
  kind: 'place';
  zone: string;
  geonameId: number;
  /** The place's own name from the dataset. */
  name: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  /** English country name, as shown on the card. */
  country: string;
  /** State, province or region, when the dataset has one. */
  region?: string;
  lat: number;
  lon: number;
}

export type StoredCity = LocalCity | ZoneCity | PlaceCity;

export interface AppState {
  cities: StoredCity[];
  settings: Settings;
}

/**
 * A first visit starts with one My Local Time card (owner ruling on D22). The same applies after
 * unreadable data is set aside, and in memory-only mode, so nobody lands on an empty list unless
 * they emptied it themselves.
 */
export function defaultState(): AppState {
  return { cities: [{ id: newCityId(), kind: 'local' }], settings: { ...DEFAULT_SETTINGS } };
}

/** Identity for de-duplication (D3): one per place, one My Local Time, one per bare zone. */
export function cityKey(city: StoredCity): string {
  switch (city.kind) {
    case 'local':
      return 'local';
    case 'zone':
      return `zone:${city.zone}`;
    case 'place':
      return `place:${city.geonameId}`;
  }
}

export function defaultName(city: StoredCity): string {
  switch (city.kind) {
    case 'local':
      return LOCAL_TIME_NAME;
    case 'zone':
      return city.zone;
    case 'place':
      return city.name;
  }
}

export function displayName(city: StoredCity): string {
  return city.customName ?? defaultName(city);
}

/** A new entry ID. randomUUID needs a secure context, which localhost and HTTPS both are. */
export function newCityId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
