// What each add-city result row shows, as plain text (canvas AddCity*, spec 4.2), so the dialog
// only lays it out and the wording can be unit-tested without rendering.

import type { Place } from '../../cities/dataset';
import type { SearchResponse, SearchResult, ZoneGroup } from '../../cities/search';
import { fold } from '../../cities/fold';
import { zoneRepresentative } from '../../cities/zoneData';
import { cityKey, defaultName, type NewCity } from '../../storage/schema';
import { zoneAbbreviation } from '../../time/abbreviation';
import { formatClock, formatOffset, type HourCycle } from '../../time/format';

export interface RowContext {
  instant: Temporal.Instant;
  deviceZone: string;
  hourCycle: HourCycle;
  /** cityKey of everything already on the list (minus an entry being replaced). */
  added: ReadonlySet<string>;
}

export interface ResultRow {
  /** cityKey: identity for "Added" and React keys. */
  key: string;
  /** What gets saved if this row is picked. */
  city: NewCity;
  name: string;
  /** "England, United Kingdom", "Time zone", or "Detected: America/Chicago". */
  place: string;
  /** Why a row matched when it isn't by name: "Airport IST", "Time zone IST". */
  tag?: string;
  time: string;
  /** "AM" / "PM", or "" in 24-hour format. */
  dayPeriod: string;
  /** "UTC+0:00 · GMT", or just the offset when there's no abbreviation. */
  zoneLine: string;
  added: boolean;
  /** One line for screen readers, without the visual separators. */
  label: string;
}

/** The entry saved for a dataset place: its data is copied in (D2). */
export function placeCity(place: Place): NewCity {
  const city: NewCity = {
    kind: 'place',
    zone: place.zone,
    geonameId: place.geonameId,
    name: place.name,
    countryCode: place.countryCode,
    country: place.country,
    lat: place.lat,
    lon: place.lon,
  };
  if (place.region) city.region = place.region;
  return city;
}

function timeFields(zone: string, country: string | undefined, ctx: RowContext) {
  const there = ctx.instant.toZonedDateTimeISO(zone);
  const { time, dayPeriod } = formatClock(there.hour, there.minute, ctx.hourCycle);
  const offset = formatOffset(there.offsetNanoseconds);
  const abbreviation = zoneAbbreviation(
    ctx.instant.epochMilliseconds,
    zone,
    Math.round(there.offsetNanoseconds / 1e9),
    country,
  );
  return { time, dayPeriod, offset, abbreviation };
}

function row(
  city: NewCity,
  place: string,
  zone: string,
  country: string | undefined,
  tag: string | undefined,
  ctx: RowContext,
): ResultRow {
  const key = cityKey(city);
  const name = defaultName(city);
  const { time, dayPeriod, offset, abbreviation } = timeFields(zone, country, ctx);
  const added = ctx.added.has(key);
  const clock = dayPeriod ? `${time} ${dayPeriod}` : time;
  const label = [name, place, tag, clock, abbreviation ? `${offset} ${abbreviation}` : offset]
    .filter(Boolean)
    .join(', ');
  const result: ResultRow = {
    key,
    city,
    name,
    place,
    time,
    dayPeriod,
    zoneLine: abbreviation ? `${offset} · ${abbreviation}` : offset,
    added,
    label: added ? `${label}, added` : label,
  };
  if (tag) result.tag = tag;
  return result;
}

/** "Time zone IST" for an abbreviation; a full name ("Pacific Standard Time") speaks for itself. */
function zoneTag(matched: string): string {
  return /^[A-Z]{2,6}$/.test(matched) ? `Time zone ${matched}` : matched;
}

/** The label a group's own rows carry, which the header band already says for them. */
function groupLabel(group: ZoneGroup): string {
  return group.abbreviation ?? group.name;
}

function tagFor(result: SearchResult, band: ZoneGroup | undefined): string | undefined {
  const { matched } = result;
  if (matched === undefined) return undefined;
  if (result.type === 'zone')
    return band && matched === groupLabel(band) ? undefined : zoneTag(matched);
  switch (result.match) {
    case 'airport':
      return `Airport ${matched}`;
    case 'zone':
      return band && matched === groupLabel(band) ? undefined : zoneTag(matched);
    case 'alias':
      return `Also called ${matched}`;
    default:
      // A country or region match is already visible in the place line.
      return undefined;
  }
}

/** The one zone group a query named exactly, if it named exactly one (header band). */
export function bandGroup(response: SearchResponse): ZoneGroup | undefined {
  return response.zoneGroups.length === 1 ? response.zoneGroups[0] : undefined;
}

export function resultRows(response: SearchResponse, ctx: RowContext): ResultRow[] {
  const band = bandGroup(response);
  return response.results.map((r) => {
    const tag = tagFor(r, band);
    if (r.type === 'zone') {
      return row(
        { kind: 'zone', zone: r.zone },
        'Time zone',
        r.zone,
        zoneRepresentative(r.zone)?.countryCode,
        tag,
        ctx,
      );
    }
    const { place } = r;
    const where = place.region ? `${place.region}, ${place.country}` : place.country;
    return row(placeCity(place), where, place.zone, place.countryCode, tag, ctx);
  });
}

/** The My Local Time row (D13). */
export function localTimeRow(ctx: RowContext): ResultRow {
  return row(
    { kind: 'local' },
    `Detected: ${ctx.deviceZone}`,
    ctx.deviceZone,
    zoneRepresentative(ctx.deviceZone)?.countryCode,
    undefined,
    ctx,
  );
}

const LOCAL_WORDS = ['my local time', 'local time'];

/**
 * My Local Time is offered when it isn't on the list (it can be re-added after removal, spec
 * 4.2): on an empty search, or when the search starts to spell it.
 */
export function offersLocalTime(query: string, added: ReadonlySet<string>): boolean {
  if (added.has('local')) return false;
  const q = fold(query);
  return q === '' || (q.length >= 3 && LOCAL_WORDS.some((w) => w.startsWith(q)));
}

/**
 * The header band for a single named zone: "Pacific Standard Time (PST) · UTC−8:00". The offset is
 * left out when the zone isn't on that time today (PST typed in July, when Los Angeles is on PDT).
 */
export function zoneBand(group: ZoneGroup, instant: Temporal.Instant): string {
  const abbreviation =
    group.abbreviation && group.abbreviation !== group.name ? group.abbreviation : '';
  const title = abbreviation ? `${group.name} (${abbreviation})` : group.name;
  const zone = group.zones[0];
  if (!zone) return title;
  const there = instant.toZonedDateTimeISO(zone);
  const now = zoneAbbreviation(
    instant.epochMilliseconds,
    zone,
    Math.round(there.offsetNanoseconds / 1e9),
    zoneRepresentative(zone)?.countryCode,
  );
  if (group.abbreviation && now !== group.abbreviation) return title;
  return `${title} · ${formatOffset(there.offsetNanoseconds)}`;
}

/** "3 results", "4 cities in this time zone", "Showing 50 of 312 results". */
export function statusText(response: SearchResponse): string {
  const shown = response.results.length;
  const { total } = response;
  const band = bandGroup(response);
  const allInZone =
    band !== undefined &&
    shown > 0 &&
    response.results.every(
      (r) => r.type === 'place' && r.match === 'zone' && r.matched === groupLabel(band),
    );
  const noun = allInZone
    ? `${total === 1 ? 'city' : 'cities'} in this time zone`
    : total === 1
      ? 'result'
      : 'results';
  return total > shown ? `Showing ${shown} of ${total} ${noun}` : `${total} ${noun}`;
}
