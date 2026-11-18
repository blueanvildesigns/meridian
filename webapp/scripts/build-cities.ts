// Builds Meridian's city data from a GeoNames export (decisions D18 and M2-3 to M2-6).
//
// Usage: node scripts/build-cities.ts [--from <dir>]
//   Without --from, downloads the four GeoNames files into a fresh temporary folder.
//   With --from, reads them from <dir> instead (file dates then come from the files' mtimes).
// Needs `unzip` on PATH. Only the generated output is committed:
//   src/cities/data/cities.v1.json  the search dataset, fetched lazily by the add-city dialog
//   src/cities/data/zones.v1.json   one representative place per zone, bundled (sunrise, D5)
//
// GeoNames data is CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Credit is shown in
// the add-city dialog and the About page. Output also depends on this Node's ICU (country names,
// zone validation), which is recorded in the output.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { fold, isLatinFolded } from '../src/cities/fold.ts';
import { canonicalZone } from '../src/time/zones.ts';

const BASE_URL = 'https://download.geonames.org/export/dump/';
const FILES = [
  'cities15000.zip',
  'alternateNamesV2.zip',
  'countryInfo.txt',
  'admin1CodesASCII.txt',
] as const;
type SourceFile = (typeof FILES)[number];

const OUT_DIR = fileURLToPath(new URL('../src/cities/data/', import.meta.url));
const FORMAT = 1;

/** Historical, abandoned or destroyed places: not somewhere anyone's clock is. */
const DROPPED_FEATURES = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

/** alternateNames "languages" that are really codes. Airport codes stay out until licensed. */
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
  name: string;
  asciiName: string;
  countryCode: string;
  admin1: string;
  zone: string;
  lat: number;
  lon: number;
  population: number;
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
  const res = await fetch(BASE_URL + file);
  if (!res.ok) throw new Error(`Download failed: ${file}: HTTP ${res.status}`);
  const path = join(dir, file);
  // The biggest file is ~200 MB; holding it in memory once is fine for a dev-time script.
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  const lastModified = res.headers.get('last-modified');
  lastModifiedHeaders.set(file, lastModified ? new Date(lastModified).toISOString() : '');
  return path;
}

const lastModifiedHeaders = new Map<string, string>();

async function fileInfo(path: string, file: SourceFile): Promise<FileInfo> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  const stat = statSync(path);
  return {
    url: BASE_URL + file,
    lastModified: lastModifiedHeaders.get(file) || stat.mtime.toISOString(),
    bytes: stat.size,
    sha256: hash.digest('hex'),
  };
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
  const files = {} as Record<SourceFile, FileInfo>;
  for (const file of FILES) files[file] = await fileInfo(paths[file], file);

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
      name: (f[1] ?? '').trim(),
      asciiName: (f[2] ?? '').trim(),
      countryCode: f[8] ?? '',
      admin1: f[10] ?? '',
      zone,
      lat: round1(Number(f[4])),
      lon: round1(Number(f[5])),
      population: Number(f[14]),
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
      // A name that is also this place's airport code stays out (no airport data until its licence
      // is confirmed), unless GeoNames records it as an English name or abbreviation, like NYC.
      if (seen.has(key) || (airports.has(key) && !tagged(a))) continue;
      const namesCountry = countryOfName.get(key);
      if (namesCountry && !namesCountry.has(city.countryCode)) continue;
      seen.add(key);
      kept.push(a.name);
      if (kept.length >= MAX_ALIASES) break;
    }
    return kept;
  };

  // Countries actually used, with display names from CLDR (this Node's ICU).
  const countries: Record<string, string[]> = {};
  for (const code of [...new Set(cities.map((c) => c.countryCode))].sort()) {
    const names: string[] = [];
    for (const n of countryNamesOf(code)) {
      if (n && !names.some((m) => fold(m) === fold(n))) names.push(n);
    }
    countries[code] = names;
  }

  const regions: Record<string, string> = {};
  for (const c of cities) {
    const key = `${c.countryCode}.${c.admin1}`;
    const name = regionNames.get(key);
    if (name) regions[key] = name;
  }

  const zones = [...new Set(cities.map((c) => c.zone))].sort();
  const zoneIndex = new Map(zones.map((z, i) => [z, i]));

  const rows = cities.map((c) => {
    const aliases = aliasesFor(c);
    const region = regions[`${c.countryCode}.${c.admin1}`] ? c.admin1 : '';
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
  for (const zone of zones) {
    const namesake = fold((zone.split('/').pop() ?? '').replace(/_/g, ' '));
    const inZone = rows.filter((r) => r.city.zone === zone);
    const pick =
      inZone.find(
        (r) => fold(r.city.name) === namesake || r.aliases.some((a) => fold(a) === namesake),
      ) ?? inZone[0];
    if (pick)
      representatives[zone] = [pick.city.name, pick.city.countryCode, pick.city.lat, pick.city.lon];
  }

  const dumpDate = files['cities15000.zip'].lastModified.slice(0, 10);
  const source = {
    name: 'GeoNames',
    url: 'https://www.geonames.org/',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    dumpDate,
    files,
    builtWith: {
      node: process.versions.node,
      icu: process.versions.icu,
      cldr: process.versions.cldr,
    },
  };

  // One city per line keeps data refreshes reviewable as diffs; compression absorbs the newlines.
  const header = { format: FORMAT, source, countries, regions, zones };
  const headerJson = JSON.stringify(header);
  const citiesJson =
    `${headerJson.slice(0, -1)},"cities":[\n` +
    rows.map((r) => JSON.stringify(r.row)).join(',\n') +
    '\n]}\n';
  writeFileSync(join(OUT_DIR, 'cities.v1.json'), citiesJson);

  const zonesJson =
    `{"format":${FORMAT},"source":${JSON.stringify({ name: source.name, license: source.license, dumpDate })},"zones":{\n` +
    Object.entries(representatives)
      .map(([zone, rep]) => `${JSON.stringify(zone)}:${JSON.stringify(rep)}`)
      .join(',\n') +
    '\n}}\n';
  writeFileSync(join(OUT_DIR, 'zones.v1.json'), zonesJson);

  const aliasCount = rows.reduce((n, r) => n + r.aliases.length, 0);
  console.log(
    `Wrote ${rows.length} places, ${aliasCount} aliases, ${zones.length} zones, ` +
      `${Object.keys(countries).length} countries, ${Object.keys(regions).length} regions ` +
      `(GeoNames export of ${dumpDate}).`,
  );
}

await main();
