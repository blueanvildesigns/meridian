// Everything a clock card needs about one zone at one instant, as data (formatting stays in
// format.ts so the UI picks the 12/24-hour cycle).

import { calendarDayDiff } from './relativeDay';

export interface ZoneSnapshot {
  /** Wall-clock date and time in the zone. */
  dateTime: Temporal.PlainDateTime;
  offsetNanoseconds: number;
  /** Calendar days relative to the reference zone's date (D1: the device zone). */
  dayDiff: number;
  /** Minutes this zone is ahead of the reference zone at this instant (negative = behind). */
  minutesAhead: number;
}

export function zoneSnapshot(
  instant: Temporal.Instant,
  zone: string,
  referenceZone: string,
): ZoneSnapshot {
  const there = instant.toZonedDateTimeISO(zone);
  const here = instant.toZonedDateTimeISO(referenceZone);
  return {
    dateTime: there.toPlainDateTime(),
    offsetNanoseconds: there.offsetNanoseconds,
    dayDiff: calendarDayDiff(instant, zone, referenceZone),
    // `+ 0` turns a -0 from Math.round into 0.
    minutesAhead: Math.round((there.offsetNanoseconds - here.offsetNanoseconds) / 60e9) + 0,
  };
}
