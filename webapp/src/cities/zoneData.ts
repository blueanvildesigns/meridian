// One representative place per zone (D5, refined in M2-5), bundled because it's small (~6 KB
// compressed) and needed at startup: sunrise for My Local Time and bare zones, and the country
// whose locale names the zone's abbreviation. Built by scripts/build-cities.ts.

import data from './data/zones.v1.json';
import { canonicalZone } from '../time/zones';

export interface ZoneRepresentative {
  name: string;
  countryCode: string;
  lat: number;
  lon: number;
}

// JSON imports type arrays loosely; the generator writes [name, countryCode, lat, lon].
const table = data.zones as unknown as Readonly<
  Record<string, readonly [string, string, number, number]>
>;

/** Zones with at least one dataset place, sorted. */
export const DATASET_ZONES: readonly string[] = Object.keys(table);

/** The dataset's GeoNames export date, for About. */
export const CITY_DATA_DATE: string = data.source.dumpDate;

/** The place standing in for `zone`, or undefined (UTC, or a zone with no place in the dataset). */
export function zoneRepresentative(zone: string): ZoneRepresentative | undefined {
  const row = table[zone] ?? table[canonicalZone(zone) ?? ''];
  if (!row) return undefined;
  const [name, countryCode, lat, lon] = row;
  return { name, countryCode, lat, lon };
}
