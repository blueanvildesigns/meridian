// Add-city search (spec 4.2; decisions D8, D9, D17, refined in M2-7 and M2-8).
//
// Matches place names and their aliases, airport codes (built, but no data until the licence is
// confirmed), time zone abbreviations and names (PST, IST, "Central time"), raw IANA IDs, and
// country and region names. Results are ranked by how the query matched, then by population.

import { zoneAbbreviation } from '../time/abbreviation';
import { T } from '../time/temporal';
import { ZONE_ALIASES } from '../time/zones';
import type { CityDataset, Place } from './dataset';
import { fold } from './fold';
import { zoneRepresentative } from './zoneData';

export const RESULT_LIMIT = 50;

/**
 * Why a result matched, in rank order:
 * 0 exact name, alias or country ("calcutta" → Kolkata, "india" → Mumbai) · 1 exact airport
 * code, time zone, IANA ID or region ("california") · 2 name prefix, or name plus region or
 * country ("london ontario") · 3 a later word of the name, or an alias prefix · 4 country prefix ·
 * 5 region prefix · 6 time zone name prefix ("pacif").
 * Within a tier, more populous places come first, so a small town called Calcutta doesn't outrank
 * Kolkata, and Mexico City outranks Mexico in the Philippines.
 */
type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MatchKind = 'name' | 'alias' | 'airport' | 'zone' | 'country' | 'region';

export interface PlaceResult {
  type: 'place';
  place: Place;
  match: MatchKind;
  /** What matched when it isn't the name: the alias, code, zone abbreviation, country or region. */
  matched?: string;
}

/** A bare zone (D4), for IANA queries and zones with no dataset place, such as UTC. */
export interface ZoneResult {
  type: 'zone';
  zone: string;
  matched?: string;
}

export type SearchResult = PlaceResult | ZoneResult;

/** A time zone the query named exactly, e.g. "Pacific Standard Time (PST)". */
export interface ZoneGroup {
  name: string;
  abbreviation?: string;
  /** Most populous first. */
  zones: readonly string[];
}

export interface SearchResponse {
  results: SearchResult[];
  /** Matches before the cap. */
  total: number;
  /**
   * Zones named exactly by the query. One group means every zone result belongs to it (the UI's
   * header band); several mean the query is ambiguous (IST), and each zone shows one place.
   */
  zoneGroups: ZoneGroup[];
}

export interface Airport {
  code: string;
  geonameId: number;
}

interface ZoneName {
  zone: string;
  abbreviation?: string;
  abbreviationKey?: string;
  long?: string;
  longKey?: string;
  generic?: string;
  genericKey?: string;
}

interface CountryKeys {
  code: string;
  name: string;
  keys: string[];
}

export interface SearchIndex {
  places: readonly Place[];
  nameKeys: string[];
  aliasKeys: string[][];
  placesByZone: Map<string, Place[]>;
  countries: CountryKeys[];
  /** "CC|Region" → folded region name. */
  regions: Map<string, string>;
  /** Searchable zone IDs: the dataset's zones plus UTC (D9), with folded forms. */
  zoneIds: { zone: string; key: string }[];
  zoneNames: ZoneName[];
  airports: Map<string, Place>;
  context: (string[] | undefined)[];
  countryNames: Map<string, string[]>;
}

const HALF_YEAR_MS = 182 * 86_400_000;
const OFFSET_STYLE_NAME = /^(GMT|UTC)[+\-−]/;
const longNameFormatters = new Map<string, Intl.DateTimeFormat | null>();

function intlZoneName(
  zone: string,
  style: 'long' | 'longGeneric',
  epochMs: number,
): string | undefined {
  const key = `${style}|${zone}`;
  let f = longNameFormatters.get(key);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style });
    } catch {
      f = null;
    }
    longNameFormatters.set(key, f);
  }
  const name = f?.formatToParts(epochMs).find((p) => p.type === 'timeZoneName')?.value;
  return name && !OFFSET_STYLE_NAME.test(name) ? name : undefined;
}

/**
 * Builds the in-memory index. Zone names and abbreviations come from this browser's Intl at `now`
 * and half a year later, so both PST and PDT find Los Angeles whatever the season, and what you
 * can search for matches what the rows show.
 */
export function buildSearchIndex(
  dataset: CityDataset,
  options: { now: number; airports?: readonly Airport[] },
): SearchIndex {
  const { places } = dataset;
  const placesByZone = new Map<string, Place[]>();
  const regions = new Map<string, string>();
  for (const p of places) {
    let list = placesByZone.get(p.zone);
    if (!list) placesByZone.set(p.zone, (list = []));
    list.push(p);
    if (p.region) regions.set(`${p.countryCode}|${p.region}`, fold(p.region));
  }

  const countries: CountryKeys[] = [];
  const countryNames = new Map<string, string[]>();
  for (const [code, names] of dataset.countries) {
    countries.push({ code, name: names[0], keys: names.map(fold) });
    countryNames.set(code, names.map(fold));
  }

  const zones = dataset.zones.includes('UTC') ? dataset.zones : [...dataset.zones, 'UTC'];
  const zoneNames: ZoneName[] = [];
  for (const zone of zones) {
    const country =
      zoneRepresentative(zone)?.countryCode ?? placesByZone.get(zone)?.[0]?.countryCode;
    const seen = new Set<string>();
    for (const at of [options.now, options.now + HALF_YEAR_MS]) {
      let offsetSeconds: number;
      try {
        offsetSeconds =
          T().Instant.fromEpochMilliseconds(at).toZonedDateTimeISO(zone).offsetNanoseconds / 1e9;
      } catch {
        continue; // a zone this engine doesn't know
      }
      const abbreviation = zoneAbbreviation(at, zone, offsetSeconds, country);
      const long = intlZoneName(zone, 'long', at);
      const generic = intlZoneName(zone, 'longGeneric', at);
      const dedupe = `${abbreviation ?? ''}|${long ?? ''}|${generic ?? ''}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const entry: ZoneName = { zone };
      if (abbreviation) {
        entry.abbreviation = abbreviation;
        entry.abbreviationKey = fold(abbreviation);
      }
      if (long) {
        entry.long = long;
        entry.longKey = fold(long);
      }
      if (generic) {
        entry.generic = generic;
        entry.genericKey = fold(generic);
      }
      zoneNames.push(entry);
    }
  }

  const byId = new Map(places.map((p) => [p.geonameId, p]));
  const airports = new Map<string, Place>();
  for (const a of options.airports ?? []) {
    const place = byId.get(a.geonameId);
    if (place) airports.set(fold(a.code), place);
  }

  return {
    places,
    nameKeys: places.map((p) => fold(p.name)),
    aliasKeys: places.map((p) => p.aliases.map(fold)),
    placesByZone,
    countries,
    regions,
    zoneIds: zones.map((zone) => ({ zone, key: fold(zone) })),
    zoneNames,
    airports,
    context: [],
    countryNames,
  };
}

/** The place that stands for a zone in mixed results: its namesake if present (D5, M2-5). */
function representativePlace(index: SearchIndex, zone: string): Place | undefined {
  const inZone = index.placesByZone.get(zone);
  const name = zoneRepresentative(zone)?.name;
  return inZone?.find((p) => p.name === name) ?? inZone?.[0];
}

/** Folded words describing where a place is, for "london ontario" or "paris tx". */
function contextWords(index: SearchIndex, place: Place): string[] {
  let words = index.context[place.rank];
  if (!words) {
    const parts = [
      place.region ? fold(place.region) : '',
      ...(index.countryNames.get(place.countryCode) ?? []),
      place.countryCode.toLowerCase(),
    ];
    words = parts.join(' ').split(' ').filter(Boolean);
    index.context[place.rank] = words;
  }
  return words;
}

interface Hit {
  tier: Tier;
  match: MatchKind;
  matched?: string;
}

export function searchCities(
  index: SearchIndex,
  query: string,
  limit: number = RESULT_LIMIT,
): SearchResponse {
  const q = fold(query);
  if (!q) return { results: [], total: 0, zoneGroups: [] };

  const hits = new Map<Place, Hit>();
  const zoneHits = new Map<string, { tier: Tier; matched?: string }>();
  const hit = (place: Place, tier: Tier, match: MatchKind, matched?: string) => {
    const prev = hits.get(place);
    if (prev && prev.tier <= tier) return;
    hits.set(place, matched === undefined ? { tier, match } : { tier, match, matched });
  };
  const zoneHit = (zone: string, tier: Tier, matched?: string) => {
    const prev = zoneHits.get(zone);
    if (prev && prev.tier <= tier) return;
    zoneHits.set(zone, matched === undefined ? { tier } : { tier, matched });
  };

  // Time zone abbreviations and names (D8).
  const groups = new Map<string, { name: string; abbreviation?: string; zones: Set<string> }>();
  for (const z of index.zoneNames) {
    let key: string | undefined;
    let name: string | undefined;
    let abbreviation: string | undefined;
    if (z.abbreviationKey === q || z.longKey === q) {
      name = z.long ?? z.generic ?? z.abbreviation ?? z.zone;
      abbreviation = z.abbreviation;
      key = name;
    } else if (z.genericKey === q && z.generic) {
      name = z.generic;
      key = name;
    }
    // Grouped by name: Kolkata and Colombo are both "India Standard Time", whatever each locale
    // abbreviates it to. The group keeps an abbreviation only if every member agrees.
    if (key && name) {
      let g = groups.get(key);
      if (!g) {
        g = abbreviation ? { name, abbreviation, zones: new Set() } : { name, zones: new Set() };
        groups.set(key, g);
      } else if (g.abbreviation !== abbreviation) {
        delete g.abbreviation;
      }
      g.zones.add(z.zone);
    } else if (
      q.length >= 3 &&
      (z.longKey?.startsWith(q) === true || z.genericKey?.startsWith(q) === true)
    ) {
      const label = z.longKey?.startsWith(q) ? z.long : z.generic;
      const rep = representativePlace(index, z.zone);
      if (rep) hit(rep, 6, 'zone', label);
      else zoneHit(z.zone, 6, label);
    }
  }
  const firstRank = (zone: string) => index.placesByZone.get(zone)?.[0]?.rank ?? Infinity;
  const zoneGroups: ZoneGroup[] = [...groups.values()].map((g) => {
    const zones = [...g.zones].sort((a, b) => firstRank(a) - firstRank(b));
    return g.abbreviation
      ? { name: g.name, abbreviation: g.abbreviation, zones }
      : { name: g.name, zones };
  });
  for (const g of zoneGroups) {
    const label = g.abbreviation ?? g.name;
    for (const zone of g.zones) {
      const inZone = index.placesByZone.get(zone);
      if (!inZone) {
        zoneHit(zone, 1, label);
      } else if (zoneGroups.length === 1) {
        for (const p of inZone) hit(p, 1, 'zone', label);
      } else {
        const rep = representativePlace(index, zone);
        if (rep) hit(rep, 1, 'zone', label);
      }
    }
  }

  // Raw IANA IDs (D9): only the dataset's zones plus UTC, so legacy aliases stay hidden; a typed
  // legacy name finds its current zone.
  const raw = query.trim();
  const legacy = Object.entries(ZONE_ALIASES).find(([k]) => k.toLowerCase() === raw.toLowerCase());
  for (const { zone, key } of index.zoneIds) {
    if (key === q || zone === legacy?.[1]) zoneHit(zone, 1);
    else if (raw.includes('/') && key.startsWith(q)) zoneHit(zone, 2);
  }

  // Airport codes (built; no data until the licence is confirmed).
  const airport = index.airports.get(q);
  if (airport) hit(airport, 1, 'airport', query.trim().toUpperCase());

  // Countries and regions matched by the query.
  const countryHits = new Map<string, { name: string; tier: Tier }>();
  for (const c of index.countries) {
    if (c.keys.includes(q)) countryHits.set(c.code, { name: c.name, tier: 0 });
    else if (
      c.keys.some(
        (k) => (q.length >= 2 && k.startsWith(q)) || (q.length >= 3 && k.includes(` ${q}`)),
      )
    ) {
      countryHits.set(c.code, { name: c.name, tier: 4 });
    }
  }
  const regionHits = new Map<string, Tier>();
  if (q.length >= 3) {
    for (const [key, folded] of index.regions) {
      if (folded === q) regionHits.set(key, 1);
      else if (folded.startsWith(q)) regionHits.set(key, 5);
    }
  }

  // Names and aliases.
  const words = q.split(' ');
  const multiWord = words.length > 1;
  const first = words[0] ?? q;
  const { places, nameKeys, aliasKeys } = index;
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const name = nameKeys[i];
    const aliases = aliasKeys[i];
    if (!place || name === undefined || !aliases) continue;

    if (name === q) {
      hit(place, 0, 'name');
      continue;
    }
    const exactAlias = aliases.indexOf(q);
    if (exactAlias >= 0) {
      hit(place, 0, 'alias', place.aliases[exactAlias]);
      continue;
    }
    // Exact country and region names: "india" lists Mumbai and Delhi before Indianapolis;
    // "georgia" mixes Tbilisi and Atlanta by population.
    const country = countryHits.get(place.countryCode);
    const regionTier = place.region
      ? regionHits.get(`${place.countryCode}|${place.region}`)
      : undefined;
    if (country?.tier === 0) {
      hit(place, 0, 'country', country.name);
      continue;
    }
    if (regionTier === 1 && place.region) hit(place, 1, 'region', place.region);
    if (name.startsWith(q)) {
      hit(place, 2, 'name');
      continue;
    }
    if (multiWord && (name.startsWith(first) || aliases.some((a) => a.startsWith(first)))) {
      const context = contextWords(index, place);
      let qualified = false;
      for (let k = 1; k < words.length && !qualified; k++) {
        const head = words.slice(0, k).join(' ');
        const tail = words.slice(k);
        qualified =
          (name.startsWith(head) || aliases.includes(head)) &&
          tail.every((t) => context.some((c) => c.startsWith(t)));
      }
      if (qualified) {
        hit(place, 2, 'name');
        continue;
      }
    }
    if (name.includes(` ${q}`)) {
      hit(place, 3, 'name');
      continue;
    }
    const aliasPrefix = aliases.findIndex((a) => a.startsWith(q));
    if (aliasPrefix >= 0) {
      hit(place, 3, 'alias', place.aliases[aliasPrefix]);
      continue;
    }
    if (country) hit(place, country.tier, 'country', country.name);
    else if (regionTier !== undefined && place.region)
      hit(place, regionTier, 'region', place.region);
  }

  const ranked: { tier: Tier; order: number; result: SearchResult }[] = [];
  for (const [zone, h] of zoneHits) {
    const result: ZoneResult =
      h.matched === undefined ? { type: 'zone', zone } : { type: 'zone', zone, matched: h.matched };
    ranked.push({ tier: h.tier, order: -1, result });
  }
  for (const [place, h] of hits) {
    const result: PlaceResult =
      h.matched === undefined
        ? { type: 'place', place, match: h.match }
        : { type: 'place', place, match: h.match, matched: h.matched };
    ranked.push({ tier: h.tier, order: place.rank, result });
  }
  ranked.sort((a, b) => a.tier - b.tier || a.order - b.order);
  return {
    results: ranked.slice(0, limit).map((r) => r.result),
    total: ranked.length,
    zoneGroups,
  };
}
