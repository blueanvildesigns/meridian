// Everything one clock card shows, as plain text, so the component only lays it out and the
// rules can be unit-tested without rendering.

import { zoneRepresentative } from '../../cities/zoneData';
import { displayName, type StoredCity } from '../../storage/schema';
import { zoneAbbreviation } from '../../time/abbreviation';
import {
  formatClock,
  formatDate,
  formatDifference,
  formatOffset,
  type HourCycle,
} from '../../time/format';
import { relativeDayLabel, type DayLabelMode } from '../../time/relativeDay';
import { zoneSnapshot } from '../../time/snapshot';
import { isDaytime, type Coordinates } from '../../time/solar';
import { canonicalZone } from '../../time/zones';

export interface ClockContext {
  instant: Temporal.Instant;
  /** The user's own zone (D1): the reference for day labels and differences. */
  deviceZone: string;
  hourCycle: HourCycle;
  mode: DayLabelMode;
}

interface ViewBase {
  id: string;
  name: string;
}

export interface ClockView extends ViewBase {
  status: 'ok';
  zone: string;
  /** Country, "Detected: <zone>" for My Local Time, or the zone for a bare zone (D4, D20). */
  subtitle: string;
  time: string;
  /** "AM" / "PM", or "" in 24-hour format. */
  dayPeriod: string;
  dayLabel: string;
  date: string;
  abbreviation: string | undefined;
  offset: string;
  difference: string;
  daytime: boolean;
}

/** The saved zone isn't one this browser knows (spec 4.6). */
export interface UnknownZoneView extends ViewBase {
  status: 'unknown-zone';
  zone: string;
}

export type CardView = ClockView | UnknownZoneView;

export function cardView(city: StoredCity, ctx: ClockContext): CardView {
  const name = displayName(city);
  let zone: string;
  if (city.kind === 'local') {
    zone = ctx.deviceZone;
  } else {
    const known = canonicalZone(city.zone);
    if (!known) return { status: 'unknown-zone', id: city.id, name, zone: city.zone };
    zone = known;
  }

  // Places carry their own coordinates and country. My Local Time and bare zones borrow the
  // zone's representative place (D5, M2-5); UTC has none and falls back to 06:00–18:00.
  let coordinates: Coordinates | undefined;
  let country: string | undefined;
  let subtitle: string;
  if (city.kind === 'place') {
    coordinates = { lat: city.lat, lon: city.lon };
    country = city.countryCode;
    subtitle = city.country;
  } else {
    const rep = zoneRepresentative(zone);
    coordinates = rep && { lat: rep.lat, lon: rep.lon };
    country = rep?.countryCode;
    if (city.kind === 'local') subtitle = `Detected: ${zone}`;
    else subtitle = name === zone ? 'Time zone' : zone;
  }

  const snapshot = zoneSnapshot(ctx.instant, zone, ctx.deviceZone);
  const { hour, minute } = snapshot.dateTime;
  const clock = formatClock(hour, minute, ctx.hourCycle);
  const offsetSeconds = Math.round(snapshot.offsetNanoseconds / 1e9);

  return {
    status: 'ok',
    id: city.id,
    name,
    zone,
    subtitle,
    time: clock.time,
    dayPeriod: clock.dayPeriod,
    dayLabel: relativeDayLabel(snapshot.dayDiff, ctx.mode),
    date: formatDate(snapshot.dateTime),
    abbreviation: zoneAbbreviation(ctx.instant.epochMilliseconds, zone, offsetSeconds, country),
    offset: formatOffset(snapshot.offsetNanoseconds),
    difference: formatDifference(snapshot.minutesAhead),
    daytime: isDaytime(ctx.instant, zone, coordinates),
  };
}
