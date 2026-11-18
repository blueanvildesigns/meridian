// Relative-day labels, from calendar dates (never from elapsed hours). Fixes the old app's
// off-by-one around DST changes (REVERSE_ENGINEERING.md §3.5, probe D).

import { T } from './temporal';

/**
 * Calendar days from the reference zone's date to `zone`'s date at the same instant.
 * Tokyo vs Chicago at 2026-03-08 10:00 Chicago → 1, even though that night was 23 hours long.
 */
export function calendarDayDiff(
  instant: Temporal.Instant,
  zone: string,
  referenceZone: string,
): number {
  const there = instant.toZonedDateTimeISO(zone).toPlainDate();
  const here = instant.toZonedDateTimeISO(referenceZone).toPlainDate();
  return here.until(there, { largestUnit: 'days' }).days + 0; // never -0
}

export type DayLabelMode = 'live' | 'jump';

const MINUS = '−';

/**
 * Live: Today / Tomorrow / Yesterday / +2 days / −2 days.
 * Jump: Same day / Next day / Previous day / +2 days / −2 days (decision D1).
 * ±2 can happen: Kiritimati (UTC+14) vs Pago Pago (UTC−11) is 25 hours.
 */
export function relativeDayLabel(diff: number, mode: DayLabelMode): string {
  if (diff === 0) return mode === 'live' ? 'Today' : 'Same day';
  if (diff === 1) return mode === 'live' ? 'Tomorrow' : 'Next day';
  if (diff === -1) return mode === 'live' ? 'Yesterday' : 'Previous day';
  return `${diff > 0 ? '+' : MINUS}${Math.abs(diff)} days`;
}

/** Convenience for callers that only have the epoch. */
export function instantFromEpochMs(epochMilliseconds: number): Temporal.Instant {
  return T().Instant.fromEpochMilliseconds(epochMilliseconds);
}
