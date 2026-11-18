// Day or night from the sun's position (decision D5): daytime while the sun's centre is above
// −0.833°, the standard sunrise/sunset definition (34′ refraction plus 16′ solar radius).
// Polar day and night need no special cases. Algorithm: NOAA's solar calculator equations
// (Meeus, Astronomical Algorithms), accurate to about a minute for sunrise times at
// non-polar latitudes.

import { T } from './temporal';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
export const SUNRISE_ELEVATION = -0.833;

export interface Coordinates {
  lat: number;
  lon: number;
}

/** The sun's geometric elevation in degrees (no refraction) at an instant and place. */
export function solarElevation(epochMilliseconds: number, { lat, lon }: Coordinates): number {
  const jd = epochMilliseconds / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525; // Julian centuries since J2000.0

  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));

  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTimeMinutes =
    4 *
    DEG *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD));

  const utcMinutes = (((epochMilliseconds % 86_400_000) + 86_400_000) % 86_400_000) / 60_000;
  const trueSolarMinutes = (((utcMinutes + eqTimeMinutes + 4 * lon) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarMinutes / 4 - 180;

  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(decl) +
    Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) * DEG;
}

/**
 * Whether it's daytime at `instant` in a place. Without coordinates (a zone with no city in the
 * dataset, such as UTC) daytime is 06:00 to 18:00 on the zone's wall clock.
 */
export function isDaytime(
  instant: Temporal.Instant,
  zone: string,
  coordinates: Coordinates | undefined,
): boolean {
  if (coordinates) {
    return solarElevation(instant.epochMilliseconds, coordinates) > SUNRISE_ELEVATION;
  }
  const hour = instant.toZonedDateTimeISO(zone).hour;
  return hour >= 6 && hour < 18;
}

/** Instant at the start of `date` in `zone` (handy for scanning a day in tests and tools). */
export function startOfDay(date: Temporal.PlainDate, zone: string): Temporal.Instant {
  return T()
    .ZonedDateTime.from({ year: date.year, month: date.month, day: date.day, timeZone: zone })
    .startOfDay()
    .toInstant();
}
