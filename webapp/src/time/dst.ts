// DST heads-up (M10, spec 4.1): when a zone's clocks next change, and whether a zone's offset at a
// Jump's moment differs from its offset now. Every zone's rules come from the engine (native
// Temporal or the polyfill), through getTimeZoneTransition (checked on both, M8-13).

import { T } from './temporal';

/** Live mode flags a card whose offset changes within this many days (decision 16). */
export const HEADS_UP_DAYS = 14;

const DAY_NS = 86_400_000_000_000n;

/** The next transition per zone, and from when that answer holds (it's asked every minute). */
const transitions = new Map<string, { from: bigint; next: Temporal.Instant | null }>();

/**
 * The first instant after `now` at which `zone`'s UTC offset changes, or null if it never does
 * again (Kolkata, UTC, São Paulo since 2019). Memoised per zone: the answer holds until it passes.
 */
export function nextTransition(zone: string, now: Temporal.Instant): Temporal.Instant | null {
  const ns = now.epochNanoseconds;
  const known = transitions.get(zone);
  if (known && known.from <= ns && (known.next === null || ns < known.next.epochNanoseconds)) {
    return known.next;
  }
  const next = now.toZonedDateTimeISO(zone).getTimeZoneTransition('next')?.toInstant() ?? null;
  transitions.set(zone, { from: ns, next });
  return next;
}

export interface ClockChange {
  at: Temporal.Instant;
  /**
   * The day the clocks change, as the zone's own announcements name it: the date at the moment of
   * the change, read in the offset before it ("Sun, Mar 14" for New York's 2:00 AM; Chile's
   * midnight changes fall on the Sunday both ways).
   */
  date: Temporal.PlainDate;
}

/** The zone's next offset change if it's within `days` of `now` (decisions 16, M10 defaults). */
export function upcomingChange(
  zone: string,
  now: Temporal.Instant,
  days = HEADS_UP_DAYS,
): ClockChange | null {
  const at = nextTransition(zone, now);
  if (!at || at.epochNanoseconds - now.epochNanoseconds > BigInt(days) * DAY_NS) return null;
  const before = at.subtract({ nanoseconds: 1 }).toZonedDateTimeISO(zone).offsetNanoseconds;
  const date = T()
    .Instant.fromEpochNanoseconds(at.epochNanoseconds + BigInt(before))
    .toZonedDateTimeISO('UTC')
    .toPlainDate();
  return { at, date };
}

/** The zone's UTC offset at `then` differs from its offset at `now` (decision 19). */
export function offsetDiffers(
  zone: string,
  then: Temporal.Instant,
  now: Temporal.Instant,
): boolean {
  return (
    then.toZonedDateTimeISO(zone).offsetNanoseconds !==
    now.toZonedDateTimeISO(zone).offsetNanoseconds
  );
}

/** Forgets the memoised transitions (tests that move the clock backwards). */
export function clearTransitionCache(): void {
  transitions.clear();
}
