// Reads stored data defensively: one bad entry never costs the rest of the list (spec 4.6).
// Structure is checked here; whether a zone is still recognised is not, because an unrecognised
// zone gets its own card state ("Choose a zone") rather than being dropped.

import { cleanName } from '../text/name';
import {
  cityKey,
  DEFAULT_SETTINGS,
  newCityId,
  type AppState,
  type PlaceCity,
  type Settings,
  type StoredCity,
} from './schema';

export interface ParseResult {
  state: AppState;
  /** How many things had to be dropped or fixed. Zero means the data was read exactly. */
  repairs: number;
}

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.length <= max;
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const MAX_ID = 64;
const MAX_ZONE = 64;
const MAX_TEXT = 200;

function parseSettings(raw: unknown): { settings: Settings; repairs: number } {
  const settings = { ...DEFAULT_SETTINGS };
  if (raw === undefined) return { settings, repairs: 0 };
  if (!isObject(raw)) return { settings, repairs: 1 };
  let repairs = 0;
  const { timeFormat, appearance } = raw;
  if (timeFormat === 'browser' || timeFormat === '12' || timeFormat === '24') {
    settings.timeFormat = timeFormat;
  } else if (timeFormat !== undefined) repairs++;
  if (appearance === 'system' || appearance === 'light' || appearance === 'dark') {
    settings.appearance = appearance;
  } else if (appearance !== undefined) repairs++;
  return { settings, repairs };
}

/** One entry, or null if it can't be used. `customName` is cleaned, not rejected. */
function parseCity(raw: unknown): { city: StoredCity; fixed: boolean } | null {
  if (!isObject(raw) || !isText(raw.id, MAX_ID)) return null;
  const id = raw.id;
  let fixed = false;
  let customName: string | undefined;
  if (raw.customName !== undefined) {
    customName = typeof raw.customName === 'string' ? cleanName(raw.customName) : undefined;
    if (customName !== raw.customName) fixed = true;
  }
  const named = customName === undefined ? {} : { customName };

  switch (raw.kind) {
    case 'local':
      return { city: { id, kind: 'local', ...named }, fixed };
    case 'zone':
      if (!isText(raw.zone, MAX_ZONE)) return null;
      return { city: { id, kind: 'zone', zone: raw.zone, ...named }, fixed };
    case 'place': {
      const { zone, geonameId, name, countryCode, country, region, lat, lon } = raw;
      if (
        !isText(zone, MAX_ZONE) ||
        !Number.isSafeInteger(geonameId) ||
        (geonameId as number) <= 0 ||
        !isText(name, MAX_TEXT) ||
        typeof countryCode !== 'string' ||
        !/^[A-Z]{2}$/.test(countryCode) ||
        !isText(country, MAX_TEXT) ||
        !inRange(lat, -90, 90) ||
        !inRange(lon, -180, 180)
      ) {
        return null;
      }
      const city: PlaceCity = {
        id,
        kind: 'place',
        zone,
        geonameId: geonameId as number,
        name,
        countryCode,
        country,
        lat,
        lon,
        ...named,
      };
      if (isText(region, MAX_TEXT)) city.region = region;
      else if (region !== undefined) fixed = true;
      return { city, fixed };
    }
    default:
      return null;
  }
}

function parseCities(raw: unknown): { cities: StoredCity[]; repairs: number } {
  if (raw === undefined) return { cities: [], repairs: 0 };
  if (!Array.isArray(raw)) return { cities: [], repairs: 1 };
  const cities: StoredCity[] = [];
  const keys = new Set<string>();
  const ids = new Set<string>();
  let repairs = 0;
  for (const item of raw) {
    const parsed = parseCity(item);
    if (!parsed) {
      repairs++;
      continue;
    }
    const { city } = parsed;
    if (parsed.fixed) repairs++;
    // D3: the first occurrence wins; the old app crashed on duplicates.
    const key = cityKey(city);
    if (keys.has(key)) {
      repairs++;
      continue;
    }
    keys.add(key);
    if (ids.has(city.id)) {
      city.id = newCityId();
      repairs++;
    }
    ids.add(city.id);
    cities.push(city);
  }
  return { cities, repairs };
}

/** Parses schema-v1 data (already migrated). Unknown extra fields are ignored. */
export function parseState(data: Obj): ParseResult {
  const c = parseCities(data.cities);
  const s = parseSettings(data.settings);
  return { state: { cities: c.cities, settings: s.settings }, repairs: c.repairs + s.repairs };
}
