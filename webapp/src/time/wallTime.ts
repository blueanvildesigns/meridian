// Turning a wall-clock date and time in a zone into an instant, with DST made explicit.
// Calendar-day arithmetic happens in the zone; nothing ever adds 24 hours
// (REVERSE_ENGINEERING.md §3.6, probes E, F, G, H).

import { T } from './temporal';

export type WallTimeResult =
  /** The wall time happens exactly once. */
  | { kind: 'exact'; instant: Temporal.Instant }
  /**
   * The wall time doesn't exist (spring forward). Clocks jump from `skippedFrom` straight to
   * `skippedTo`; `suggestion` is the first real moment after the gap, the canvas's
   * "Use 3:00 AM instead".
   */
  | {
      kind: 'gap';
      skippedFrom: Temporal.PlainDateTime;
      skippedTo: Temporal.PlainDateTime;
      suggestion: Temporal.Instant;
    }
  /** The wall time happens twice (fall back). `earlier` is the first occurrence. */
  | { kind: 'overlap'; earlier: Temporal.Instant; later: Temporal.Instant };

export function resolveWallTime(
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
  zone: string,
): WallTimeResult {
  const wall = date.toPlainDateTime(time);
  const earlier = wall.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = wall.toZonedDateTime(zone, { disambiguation: 'later' });

  if (earlier.epochNanoseconds === later.epochNanoseconds) {
    return { kind: 'exact', instant: earlier.toInstant() };
  }
  if (earlier.toPlainDateTime().equals(wall) && later.toPlainDateTime().equals(wall)) {
    return { kind: 'overlap', earlier: earlier.toInstant(), later: later.toInstant() };
  }
  // In a gap, `earlier` is the wall time read in the old offset, which is strictly before the
  // transition, so the next transition from it is the one that skipped this wall time.
  const transition = earlier.getTimeZoneTransition('next');
  if (!transition) throw new Error(`No transition found for a skipped time in ${zone}`);
  const jump = transition.offsetNanoseconds - earlier.offsetNanoseconds;
  const skippedTo = transition.toPlainDateTime();
  return {
    kind: 'gap',
    skippedFrom: skippedTo.subtract({ nanoseconds: jump }),
    skippedTo,
    suggestion: transition.toInstant(),
  };
}

/**
 * The next time the wall clock in `zone` reads `time`, counting from `now`:
 * today if that time hasn't passed yet (the current minute counts as not passed), otherwise
 * tomorrow, by calendar date in `zone`.
 */
export function nextOccurrence(
  now: Temporal.Instant,
  time: Temporal.PlainTime,
  zone: string,
): { date: Temporal.PlainDate; result: WallTimeResult } {
  const local = now.toZonedDateTimeISO(zone);
  const currentMinute = local
    .toPlainTime()
    .round({ smallestUnit: 'minute', roundingMode: 'floor' });
  const today = local.toPlainDate();
  const date = T().PlainTime.compare(time, currentMinute) >= 0 ? today : today.add({ days: 1 });
  return { date, result: resolveWallTime(date, time, zone) };
}
