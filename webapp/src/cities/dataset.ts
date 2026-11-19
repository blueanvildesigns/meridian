// The city dataset (D18): a GeoNames subset plus OurAirports codes (M4-1), built by
// scripts/build-cities.ts. It's a separate, hashed asset fetched only when needed (the add-city
// dialog), so startup never pays for it.

import citiesUrl from './data/cities.v1.json?url';

export const DATASET_FORMAT = 1;

export interface Place {
  /** Position in population order: 0 is the most populous. Ranking ties break on this. */
  rank: number;
  geonameId: number;
  name: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  /** English country name (CLDR). */
  country: string;
  /** State, province or region, if the dataset has one. */
  region?: string;
  zone: string;
  lat: number;
  lon: number;
  /** Other names: English, former, native and abbreviations (Bombay, München, NYC). */
  aliases: readonly string[];
}

/** An airport's IATA code and the place it serves. */
export interface Airport {
  code: string;
  geonameId: number;
}

export interface DatasetSource {
  name: string;
  license: string;
  dumpDate: string;
}

export interface CityDataset {
  places: readonly Place[];
  /** Every zone used by a place, sorted. */
  zones: readonly string[];
  /** Country code → [display name, ...other names people search by]. */
  countries: ReadonlyMap<string, readonly [string, ...string[]]>;
  /** Sorted by code. Empty in a file built before airports were added. */
  airports: readonly Airport[];
  source: DatasetSource;
}

export class DatasetError extends Error {
  override name = 'DatasetError';
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string');

/** Turns the compact JSON into objects. Throws DatasetError if the file isn't what we expect. */
export function decodeDataset(json: unknown): CityDataset {
  if (!isObject(json) || json.format !== DATASET_FORMAT) {
    throw new DatasetError('Unexpected city data format');
  }
  const { source, countries, regions, zones, cities, airports: airportRows = [] } = json;
  if (
    !isObject(source) ||
    !isObject(countries) ||
    !isObject(regions) ||
    !isStringArray(zones) ||
    !Array.isArray(cities) ||
    !Array.isArray(airportRows)
  ) {
    throw new DatasetError('City data is incomplete');
  }

  const countryMap = new Map<string, readonly [string, ...string[]]>();
  for (const [code, names] of Object.entries(countries)) {
    if (!isStringArray(names) || names[0] === undefined) {
      throw new DatasetError(`Bad country ${code}`);
    }
    countryMap.set(code, names as [string, ...string[]]);
  }

  const places: Place[] = cities.map((row: unknown, rank) => {
    if (!Array.isArray(row) || row.length < 7) throw new DatasetError(`Bad city row ${rank}`);
    const [geonameId, name, countryCode, regionCode, zoneIndex, lat, lon, aliases] = row as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
    ];
    const zone = typeof zoneIndex === 'number' ? zones[zoneIndex] : undefined;
    const country = typeof countryCode === 'string' ? countryMap.get(countryCode)?.[0] : undefined;
    if (
      typeof geonameId !== 'number' ||
      typeof name !== 'string' ||
      typeof countryCode !== 'string' ||
      typeof regionCode !== 'string' ||
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      zone === undefined ||
      country === undefined ||
      (aliases !== undefined && !isStringArray(aliases))
    ) {
      throw new DatasetError(`Bad city row ${rank}`);
    }
    const region = regionCode ? regions[`${countryCode}.${regionCode}`] : undefined;
    const place: Place = {
      rank,
      geonameId,
      name,
      countryCode,
      country,
      zone,
      lat,
      lon,
      aliases: aliases ?? [],
    };
    if (typeof region === 'string') place.region = region;
    return place;
  });

  const airports: Airport[] = airportRows.map((row: unknown, i) => {
    const [code, index] = Array.isArray(row) ? (row as unknown[]) : [];
    const place = typeof index === 'number' ? places[index] : undefined;
    if (typeof code !== 'string' || !place) throw new DatasetError(`Bad airport row ${i}`);
    return { code, geonameId: place.geonameId };
  });

  const { name, license, dumpDate } = source;
  if (typeof name !== 'string' || typeof license !== 'string' || typeof dumpDate !== 'string') {
    throw new DatasetError('City data has no source');
  }
  return {
    places,
    zones,
    countries: countryMap,
    airports,
    source: { name, license, dumpDate },
  };
}

let pending: Promise<CityDataset> | undefined;

/**
 * Fetches and decodes the dataset once per page load. A failure (offline, deploy in progress)
 * isn't remembered, so the next call tries again.
 */
export function loadDataset(fetcher: typeof fetch = fetch): Promise<CityDataset> {
  pending ??= (async () => {
    const res = await fetcher(citiesUrl);
    if (!res.ok) throw new DatasetError(`City data request failed: HTTP ${res.status}`);
    return decodeDataset(await res.json());
  })().catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** For tests. */
export function resetDatasetCache(): void {
  pending = undefined;
}
