// Builds Meridian's city data from a GeoNames export and OurAirports (decisions D18, M2-3 to M2-6,
// M2-10, M4-1 and M4-2).
//
// Usage: node scripts/build-cities.ts [--from <dir>] [--airport-report <file>]
//   Without --from, downloads the four GeoNames files and OurAirports' airports.csv into a fresh
//   temporary folder.
//   With --from, reads them from <dir> instead. File dates then come from the files' mtimes,
//   unless the current output records the same file (same SHA-256), whose date is kept, so a
//   rebuild from the same files gives the same output.
//   --airport-report writes a TSV of every airport, the place it was linked to and how, to review.
// Needs `unzip` on PATH. Only the generated output is committed:
//   src/cities/data/cities.v1.json  the search dataset, fetched lazily by the add-city dialog
//   src/cities/data/zones.v1.json   one representative place per zone, bundled (sunrise, D5)
//
// GeoNames data is CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credit is shown in
// the add-city dialog and the About page. OurAirports data is public domain ("All data is
// released to the Public Domain", https://ourairports.com/data/; the GitHub data repository is
// under the Unlicense); it's credited in About anyway. Output also depends on this Node's ICU
// (country names, zone validation), which is recorded in the output.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { fold, isLatinFolded } from '../src/cities/fold.ts';
import { canonicalZone } from '../src/time/zones.ts';

const GEONAMES_URL = 'https://download.geonames.org/export/dump/';
const SOURCES = {
  'cities15000.zip': GEONAMES_URL,
  'alternateNamesV2.zip': GEONAMES_URL,
  'countryInfo.txt': GEONAMES_URL,
  'admin1CodesASCII.txt': GEONAMES_URL,
  'airports.csv': 'https://davidmegginson.github.io/ourairports-data/',
} as const;
type SourceFile = keyof typeof SOURCES;
const FILES = Object.keys(SOURCES) as SourceFile[];

const OUT_DIR = fileURLToPath(new URL('../src/cities/data/', import.meta.url));
const CITIES_FILE = join(OUT_DIR, 'cities.v1.json');
const FORMAT = 1;

/** Historical, abandoned or destroyed places: not somewhere anyone's clock is. */
const DROPPED_FEATURES = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

/**
 * Places kept (owner decision, M2-10): 50,000 people or more, every capital, and each zone's
 * representative, so no zone loses its sunrise location or its place in search. M4-2 adds the
 * place each airport is linked to, so a code like TOS finds Tromsø.
 */
const MIN_POPULATION = 50_000;

/**
 * Airports kept (M4-1): large and medium airports with an IATA code and scheduled passenger
 * service, each linked to the place it serves (see linkAirport).
 */
const AIRPORT_TYPES = new Set(['large_airport', 'medium_airport']);
/** A place named like the airport's municipality, within this distance, is the one it serves. */
const AIRPORT_NAME_KM = 150;
/**
 * Otherwise the place this close with the most "pull", population / (km + 10)², so a big city
 * nearby beats a small town next door (MXP → Milan), but not a real town next door (BGY →
 * Bergamo, not Monza). Further away than this, the airport is left out rather than labelled with
 * a place it doesn't serve.
 */
const AIRPORT_NEARBY_KM = 50;
const pull = (population: number, distance: number) => population / (distance + 10) ** 2;

/** alternateNames "languages" that are really codes. Airport codes come from OurAirports. */
const CODE_TAGS = new Set([
  'iata',
  'icao',
  'faac',
  'tcid',
  'post',
  'link',
  'wkdt',
  'unlc',
  'phon',
  'piny',
  'fr_1793',
]);
const AIRPORT_TAGS = new Set(['iata', 'icao', 'faac', 'tcid']);
const MAX_ALIASES = 6;
const MAX_ALIAS_LENGTH = 40;

/** Well-known English names GeoNames doesn't tag as English, by geonameId. They go first. */
const EXTRA_ALIASES: Readonly<Record<number, readonly string[]>> = {
  1816670: ['Peking'], // Beijing
  1809858: ['Canton'], // Guangzhou
  3451190: ['Rio'], // Rio de Janeiro
  2028462: ['Ulaanbaatar'], // Ulan Bator
};

/** CLDR's English names are used, except where they read oddly on a card. */
const COUNTRY_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  HK: 'Hong Kong',
  MO: 'Macao',
  MM: 'Myanmar',
  CD: 'Democratic Republic of the Congo',
  CG: 'Republic of the Congo',
};

/** Other names people search countries by. GeoNames' own name is added automatically. */
const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  US: ['USA', 'United States of America', 'America'],
  GB: ['UK', 'Great Britain', 'Britain'],
  AE: ['UAE', 'Emirates'],
  NL: ['Holland'],
  CZ: ['Czech Republic'],
  KR: ['Korea'],
  RU: ['Russian Federation'],
  MM: ['Burma'],
  SZ: ['Swaziland'],
  MK: ['Macedonia'],
  CD: ['DRC', 'DR Congo', 'Congo-Kinshasa'],
  CG: ['Congo-Brazzaville'],
  VA: ['Holy See'],
  TL: ['East Timor'],
  VN: ['Viet Nam'],
  IR: ['Persia'],
  PS: ['Palestine'],
  CV: ['Cape Verde'],
};

interface FileInfo {
  url: string;
  lastModified: string;
  bytes: number;
  sha256: string;
}

interface CityRow {
  geonameId: number;
  /** Unrounded, for linking airports. */
  exactLat: number;
  exactLon: number;
  name: string;
  asciiName: string;
  countryCode: string;
  admin1: string;
  zone: string;
  lat: number;
  lon: number;
  population: number;
  capital: boolean;
  /** A section of a bigger city (GeoNames PPLX), such as a London district. */
  section: boolean;
}

interface AltName {
  lang: string;
  name: string;
  preferred: boolean;
  short: boolean;
  historic: boolean;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(dir: string, file: SourceFile): Promise<string> {
  const res = await fetch(SOURCES[file] + file);
  if (!res.ok) throw new Error(`Download failed: ${file}: HTTP ${res.status}`);
  const path = join(dir, file);
  // The biggest file is ~200 MB; holding it in memory once is fine for a dev-time script.
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  const lastModified = res.headers.get('last-modified');
  lastModifiedHeaders.set(file, lastModified ? new Date(lastModified).toISOString() : '');
  return path;
}

const lastModifiedHeaders = new Map<string, string>();

/** What the current output says about its source files, keyed by URL. */
function previousFileInfo(): Map<string, FileInfo> {
  const known = new Map<string, FileInfo>();
  if (!existsSync(CITIES_FILE)) return known;
  const json = JSON.parse(readFileSync(CITIES_FILE, 'utf8')) as {
    source?: { files?: Record<string, FileInfo> };
    airportSource?: { file?: FileInfo };
  };
  for (const info of Object.values(json.source?.files ?? {})) known.set(info.url, info);
  if (json.airportSource?.file) known.set(json.airportSource.file.url, json.airportSource.file);
  return known;
}

async function fileInfo(
  path: string,
  file: SourceFile,
  previous: Map<string, FileInfo>,
): Promise<FileInfo> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  const stat = statSync(path);
  const url = SOURCES[file] + file;
  const sha256 = hash.digest('hex');
  const same = previous.get(url)?.sha256 === sha256 ? previous.get(url) : undefined;
  return {
    url,
    lastModified: lastModifiedHeaders.get(file) || same?.lastModified || stat.mtime.toISOString(),
    bytes: stat.size,
    sha256,
  };
}

/** Rows of a CSV file with a header line, as objects. Handles quoted commas, quotes and newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Great-circle distance in kilometres. */
function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Lines of a text file, or of one entry inside a zip (streamed through `unzip -p`). */
async function* lines(path: string, zipEntry?: string): AsyncGenerator<string> {
  if (!zipEntry) {
    yield* createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
    return;
  }
  const child = spawn('unzip', ['-p', path, zipEntry], { stdio: ['ignore', 'pipe', 'inherit'] });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  child.stdout.setEncoding('utf8');
  yield* createInterface({ input: child.stdout, crlfDelay: Infinity });
  const code = await exited;
  if (code !== 0) throw new Error(`unzip ${path} ${zipEntry} exited with ${code}`);
}

/** 0.1° (about 11 km) moves sunrise by well under a minute, and saves ~6% of the file. */
const round1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const from = argValue('--from');
  const dir = from ?? mkdtempSync(join(tmpdir(), 'meridian-geonames-'));
  const paths = {} as Record<SourceFile, string>;
  for (const file of FILES) {
    paths[file] = from ? join(dir, file) : await download(dir, file);
    console.log(`${from ? 'Using' : 'Downloaded'} ${paths[file]}`);
  }
  const previous = previousFileInfo();
  const files = {} as Record<SourceFile, FileInfo>;
  for (const file of FILES) files[file] = await fileInfo(paths[file], file, previous);

  // Countries: official languages (for alias selection) and GeoNames' own English name.
  const countryLanguages = new Map<string, Set<string>>();
  const geonamesCountryName = new Map<string, string>();
  for await (const line of lines(paths['countryInfo.txt'])) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const f = line.split('\t');
    const code = f[0] ?? '';
    geonamesCountryName.set(code, (f[4] ?? '').trim());
    const langs = (f[15] ?? '').split(',').filter(Boolean);
    countryLanguages.set(code, new Set(langs.map((l) => l.split('-')[0] ?? l)));
  }

  const regionNames = new Map<string, string>();
  for await (const line of lines(paths['admin1CodesASCII.txt'])) {
    const [code, name] = line.split('\t');
    if (code && name) regionNames.set(code, name.trim());
  }

  const cities: CityRow[] = [];
  const unknownZones = new Set<string>();
  for await (const line of lines(paths['cities15000.zip'], 'cities15000.txt')) {
    const f = line.split('\t');
    if (f.length < 19 || DROPPED_FEATURES.has(f[7] ?? '')) continue;
    const rawZone = f[17] ?? '';
    const zone = canonicalZone(rawZone);
    if (!zone) {
      unknownZones.add(rawZone);
      continue;
    }
    cities.push({
      geonameId: Number(f[0]),
      exactLat: Number(f[4]),
      exactLon: Number(f[5]),
      name: (f[1] ?? '').trim(),
      asciiName: (f[2] ?? '').trim(),
      countryCode: f[8] ?? '',
      admin1: f[10] ?? '',
      zone,
      lat: round1(Number(f[4])),
      lon: round1(Number(f[5])),
      population: Number(f[14]),
      capital: f[7] === 'PPLC',
      section: f[7] === 'PPLX',
    });
  }
  if (unknownZones.size > 0) {
    throw new Error(`Zones this engine doesn't know: ${[...unknownZones].join(', ')}`);
  }
  cities.sort((a, b) => b.population - a.population || a.geonameId - b.geonameId);
  const byId = new Map(cities.map((c) => [c.geonameId, c]));

  // Alternate names for our places only. The file is ~800 MB unzipped, so it's streamed.
  const altNames = new Map<number, AltName[]>();
  const airportCodes = new Map<number, Set<string>>();
  for await (const line of lines(paths['alternateNamesV2.zip'], 'alternateNamesV2.txt')) {
    const tab = line.indexOf('\t');
    const tab2 = line.indexOf('\t', tab + 1);
    const id = Number(line.slice(tab + 1, tab2));
    if (!byId.has(id)) continue;
    const f = line.split('\t');
    const lang = f[2] ?? '';
    const name = (f[3] ?? '').trim();
    if (AIRPORT_TAGS.has(lang)) {
      let codes = airportCodes.get(id);
      if (!codes) airportCodes.set(id, (codes = new Set()));
      codes.add(fold(name));
    }
    if (CODE_TAGS.has(lang) || name === '') continue;
    let list = altNames.get(id);
    if (!list) altNames.set(id, (list = []));
    list.push({
      lang,
      name,
      preferred: f[4] === '1',
      short: f[5] === '1',
      historic: f[7] === '1',
    });
  }

  // Folded country names, so an alias can't claim another country's name (Inđija in Serbia is
  // "India" in Hungarian; searching "india" should mean the country).
  const display = new Intl.DisplayNames('en', { type: 'region', fallback: 'none' });
  const countryNamesOf = (code: string): string[] => [
    COUNTRY_NAME_OVERRIDES[code] ?? display.of(code) ?? geonamesCountryName.get(code) ?? code,
    geonamesCountryName.get(code) ?? '',
    ...(COUNTRY_ALIASES[code] ?? []),
  ];
  const countryOfName = new Map<string, Set<string>>();
  for (const code of new Set(cities.map((c) => c.countryCode))) {
    for (const n of countryNamesOf(code)) {
      const key = fold(n);
      if (!key) continue;
      let codes = countryOfName.get(key);
      if (!codes) countryOfName.set(key, (codes = new Set()));
      codes.add(code);
    }
  }

  const aliasesFor = (city: CityRow): string[] => {
    const official = countryLanguages.get(city.countryCode) ?? new Set<string>();
    const airports = airportCodes.get(city.geonameId) ?? new Set<string>();
    // English names, abbreviations (NYC, LA) and former names (Bombay, Saigon) first, then names
    // in the country's own languages (München, Praha), then untagged names. Preferred and short
    // names lead within each group.
    const tagged = (a: AltName) => a.lang === 'en' || a.lang === 'abbr';
    const rank = (a: AltName) =>
      (tagged(a) || a.historic ? 0 : official.has(a.lang) ? 2 : 4) +
      (a.preferred || a.short ? 0 : 1);
    const candidates = (altNames.get(city.geonameId) ?? [])
      .filter((a) => a.lang === '' || tagged(a) || official.has(a.lang))
      .map((a, order) => ({ a, order, rank: rank(a) }))
      .sort((x, y) => x.rank - y.rank || x.order - y.order);
    const seen = new Set([fold(city.name), fold(city.asciiName)]);
    const kept: string[] = [];
    for (const extra of EXTRA_ALIASES[city.geonameId] ?? []) {
      if (!seen.has(fold(extra))) kept.push(extra);
      seen.add(fold(extra));
    }
    for (const { a } of candidates) {
      const key = fold(a.name);
      if (!key || key.length > MAX_ALIAS_LENGTH || !isLatinFolded(key)) continue;
      // A name that is also this place's airport code stays out (codes come from OurAirports, with
      // an "Airport" tag), unless GeoNames records it as an English name or abbreviation, like NYC.
      if (seen.has(key) || (airports.has(key) && !tagged(a))) continue;
      const namesCountry = countryOfName.get(key);
      if (namesCountry && !namesCountry.has(city.countryCode)) continue;
      seen.add(key);
      kept.push(a.name);
      if (kept.length >= MAX_ALIASES) break;
    }
    return kept;
  };

  const zones = [...new Set(cities.map((c) => c.zone))].sort();
  const zoneIndex = new Map(zones.map((z, i) => [z, i]));

  const allRows = cities.map((c) => {
    const aliases = aliasesFor(c);
    const region = regionNames.has(`${c.countryCode}.${c.admin1}`) ? c.admin1 : '';
    const row: unknown[] = [
      c.geonameId,
      c.name,
      c.countryCode,
      region,
      zoneIndex.get(c.zone),
      c.lat,
      c.lon,
    ];
    if (aliases.length > 0) row.push(aliases);
    return { city: c, aliases, row };
  });

  // One representative place per zone (D5, refined in M2-5): the zone's namesake if we have it
  // (Asia/Kolkata → Kolkata, not the bigger Mumbai), otherwise the most populous place.
  const representatives: Record<string, [string, string, number, number]> = {};
  const representativeIds = new Set<number>();
  for (const zone of zones) {
    const namesake = fold((zone.split('/').pop() ?? '').replace(/_/g, ' '));
    const inZone = allRows.filter((r) => r.city.zone === zone);
    const pick =
      inZone.find(
        (r) => fold(r.city.name) === namesake || r.aliases.some((a) => fold(a) === namesake),
      ) ?? inZone[0];
    if (pick) {
      representatives[zone] = [pick.city.name, pick.city.countryCode, pick.city.lat, pick.city.lon];
      representativeIds.add(pick.city.geonameId);
    }
  }

  // Airports (M4-1, M4-2), each linked to a place in its own country and zone. The airport's zone
  // is taken from the nearest place, since OurAirports doesn't record one.
  const byCountry = new Map<string, (typeof allRows)[number][]>();
  for (const r of allRows) {
    let list = byCountry.get(r.city.countryCode);
    if (!list) byCountry.set(r.city.countryCode, (list = []));
    list.push(r); // most populous first, like allRows
  }
  const nameKeys = new Map(
    allRows.map((r) => [
      r.city.geonameId,
      new Set([fold(r.city.name), fold(r.city.asciiName), ...r.aliases.map(fold)]),
    ]),
  );
  type Link = { city: CityRow; km: number; how: 'name' | 'nearby' };
  const linkAirport = (a: Record<string, string>): Link | undefined => {
    const lat = Number(a.latitude_deg);
    const lon = Number(a.longitude_deg);
    const near = (byCountry.get(a.iso_country ?? '') ?? []).map((r) => ({
      city: r.city,
      km: km(lat, lon, r.city.exactLat, r.city.exactLon),
    }));
    const nearest = near.reduce<(typeof near)[number] | undefined>(
      (best, c) => (!best || c.km < best.km ? c : best),
      undefined,
    );
    if (!nearest) return undefined;
    // City sections (London's Archway, Milan's Quarto Oggiaro) aren't what an airport serves.
    const inZone = near.filter((c) => c.city.zone === nearest.city.zone && !c.city.section);
    // "London, Essex", "Paris (Roissy-en-France, Val-d'Oise)", "Bâle / Mulhouse"
    const parts = (a.municipality ?? '')
      .split(/[,/()]|\s[-–]\s/)
      .map(fold)
      .filter(Boolean);
    const named = inZone.find(
      (c) => c.km <= AIRPORT_NAME_KM && parts.some((p) => nameKeys.get(c.city.geonameId)?.has(p)),
    );
    if (named) return { ...named, how: 'name' };
    let best: (typeof near)[number] | undefined;
    for (const c of inZone) {
      if (c.km > AIRPORT_NEARBY_KM) continue;
      if (!best || pull(c.city.population, c.km) > pull(best.city.population, best.km)) best = c;
    }
    return best && { ...best, how: 'nearby' };
  };

  const airportLinks = new Map<string, CityRow>();
  const report: string[] = ['code\ttype\tmunicipality\tcountry\tlinked\tkm\thow'];
  let airportCandidates = 0;
  for (const a of parseCsv(readFileSync(paths['airports.csv'], 'utf8'))) {
    const code = (a.iata_code ?? '').trim();
    if (!AIRPORT_TYPES.has(a.type ?? '') || a.scheduled_service !== 'yes') continue;
    if (!/^[A-Z]{3}$/.test(code)) continue;
    airportCandidates++;
    const link = linkAirport(a);
    if (link) airportLinks.set(code, link.city);
    report.push(
      [
        code,
        a.type,
        a.municipality,
        a.iso_country,
        link?.city.name ?? '',
        link ? Math.round(link.km) : '',
        link?.how ?? 'dropped',
      ].join('\t'),
    );
  }
  const reportPath = argValue('--airport-report');
  if (reportPath) writeFileSync(reportPath, report.join('\n') + '\n');
  const airportPlaceIds = new Set([...airportLinks.values()].map((c) => c.geonameId));

  const rows = allRows.filter(
    (r) =>
      r.city.population >= MIN_POPULATION ||
      r.city.capital ||
      representativeIds.has(r.city.geonameId) ||
      airportPlaceIds.has(r.city.geonameId),
  );
  const rowIndex = new Map(rows.map((r, i) => [r.city.geonameId, i]));
  const airports = [...airportLinks]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([code, city]) => [code, rowIndex.get(city.geonameId)]);

  // Countries and regions actually used, with country names from CLDR (this Node's ICU).
  const countries: Record<string, string[]> = {};
  for (const code of [...new Set(rows.map((r) => r.city.countryCode))].sort()) {
    const names: string[] = [];
    for (const n of countryNamesOf(code)) {
      if (n && !names.some((m) => fold(m) === fold(n))) names.push(n);
    }
    countries[code] = names;
  }
  const regions: Record<string, string> = {};
  for (const { city } of rows) {
    const key = `${city.countryCode}.${city.admin1}`;
    const name = regionNames.get(key);
    if (name) regions[key] = name;
  }

  const dumpDate = files['cities15000.zip'].lastModified.slice(0, 10);
  const source = {
    name: 'GeoNames',
    url: 'https://www.geonames.org/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    dumpDate,
    files: Object.fromEntries(
      FILES.filter((f) => SOURCES[f] === GEONAMES_URL).map((f) => [f, files[f]]),
    ),
    builtWith: {
      node: process.versions.node,
      icu: process.versions.icu,
      cldr: process.versions.cldr,
    },
  };

  const airportSource = {
    name: 'OurAirports',
    url: 'https://ourairports.com/data/',
    license: 'Public domain',
    file: files['airports.csv'],
  };

  // One city or airport per line keeps data refreshes reviewable as diffs; compression absorbs the
  // newlines. Airports are [IATA code, index into cities].
  const header = { format: FORMAT, source, airportSource, countries, regions, zones };
  const headerJson = JSON.stringify(header);
  const citiesJson =
    `${headerJson.slice(0, -1)},"cities":[\n` +
    rows.map((r) => JSON.stringify(r.row)).join(',\n') +
    '\n],"airports":[\n' +
    airports.map((a) => JSON.stringify(a)).join(',\n') +
    '\n]}\n';
  writeFileSync(CITIES_FILE, citiesJson);

  const zonesJson =
    `{"format":${FORMAT},"source":${JSON.stringify({ name: source.name, license: source.license, dumpDate })},"zones":{\n` +
    Object.entries(representatives)
      .map(([zone, rep]) => `${JSON.stringify(zone)}:${JSON.stringify(rep)}`)
      .join(',\n') +
    '\n}}\n';
  writeFileSync(join(OUT_DIR, 'zones.v1.json'), zonesJson);

  const aliasCount = rows.reduce((n, r) => n + r.aliases.length, 0);
  const addedForAirports = rows.filter(
    (r) =>
      r.city.population < MIN_POPULATION &&
      !r.city.capital &&
      !representativeIds.has(r.city.geonameId),
  ).length;
  console.log(
    `Wrote ${rows.length} places, ${aliasCount} aliases, ${zones.length} zones, ` +
      `${Object.keys(countries).length} countries, ${Object.keys(regions).length} regions ` +
      `(GeoNames export of ${dumpDate}); ${airports.length} of ${airportCandidates} airports ` +
      `linked, adding ${addedForAirports} places.`,
  );
}

await main();
