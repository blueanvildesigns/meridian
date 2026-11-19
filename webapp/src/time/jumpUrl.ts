// Jump state in the URL hash (decision D11), so a link reproduces the moment and is never sent
// to a server. The instant is stored, not the wall time, so a chosen occurrence of a repeated
// time survives the round trip.
// Format: #at=2027-03-14T07:30:00Z&ref=America/New_York&name=New%20York

import { T } from './temporal';
import { cleanName } from '../text/name';
import { canonicalZone } from './zones';

export { MAX_NAME_LENGTH } from '../text/name';

export interface JumpState {
  instant: Temporal.Instant;
  /** The reference city's zone. */
  refZone: string;
  /** The reference city's display name, so the banner reads right even if it isn't in the list. */
  refName?: string;
}

/** The years a Jump can reach (M1-7); the picker's date field uses the same range. */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

/** Percent-encodes, but leaves ":" and "/" readable (both are allowed in a fragment). */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

export function encodeJump(state: JumpState): string {
  const parts = [
    `at=${encodeValue(state.instant.toString({ smallestUnit: 'second' }))}`,
    `ref=${encodeValue(state.refZone)}`,
  ];
  const name = cleanName(state.refName ?? null);
  if (name) parts.push(`name=${encodeValue(name)}`);
  return `#${parts.join('&')}`;
}

/** Parses a hash; anything malformed returns null, which means live mode. */
export function decodeJump(hash: string): JumpState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const at = params.get('at');
  const ref = params.get('ref');
  if (!at || !ref) return null;

  let instant: Temporal.Instant;
  try {
    instant = T().Instant.from(at);
  } catch {
    return null;
  }
  const year = instant.toZonedDateTimeISO('UTC').year;
  if (year < MIN_YEAR || year > MAX_YEAR) return null;

  const refZone = canonicalZone(ref);
  if (!refZone) return null;

  const refName = cleanName(params.get('name'));
  return refName ? { instant, refZone, refName } : { instant, refZone };
}
