// What the Jump picker and banner offer and say, as plain data and text, so the rules can be
// unit-tested without rendering (spec 4.3; decisions D1, D11, D12).

import { zoneRepresentative } from '../../cities/zoneData';
import { defaultName, displayName, LOCAL_TIME_NAME, type StoredCity } from '../../storage/schema';
import { zoneAbbreviation } from '../../time/abbreviation';
import {
  formatClockInline,
  formatDate,
  formatOffset,
  formatShortDate,
  type HourCycle,
} from '../../time/format';
import { MAX_YEAR, MIN_YEAR, type JumpState } from '../../time/jumpUrl';
import { T } from '../../time/temporal';
import type { HourMinute } from '../../time/timeText';
import type { WallTimeResult } from '../../time/wallTime';
import { canonicalZone } from '../../time/zones';

/** One entry in the picker's "Time is in" list. */
export interface ReferenceOption {
  /** `LOCAL_KEY`, `LINK_KEY`, or a card's ID. */
  key: string;
  label: string;
  zone: string;
  /** How sentences name it: "New York", or the zone for My Local Time ("in America/Chicago"). */
  place: string;
  /** Written to the link (D11): a city's own name, never a rename; none for My Local Time. */
  linkName?: string;
  /** For the zone abbreviation (D7). */
  countryCode?: string;
  /** The card that becomes the Jump reference. */
  cityId?: string;
}

/** My Local Time: always first, and the default (D12), even when its card has been removed. */
export const LOCAL_KEY = 'local';
/** A shared link's reference that isn't in this list. */
export const LINK_KEY = 'link';

function cityZone(city: StoredCity, deviceZone: string): string | undefined {
  return city.kind === 'local' ? deviceZone : canonicalZone(city.zone);
}

function countryOf(zone: string, city?: StoredCity): { countryCode?: string } {
  const code = city?.kind === 'place' ? city.countryCode : zoneRepresentative(zone)?.countryCode;
  return code ? { countryCode: code } : {};
}

/**
 * The card a Jump is measured from, if it's in this list: one with the link's zone and name, or,
 * for a link with no name (a time in a zone, which is what My Local Time writes), My Local Time
 * when that zone is this device's. `hint` is the card picked last, to choose between two cities
 * with the same name in the same zone.
 */
export function referenceCardId(
  cities: readonly StoredCity[],
  jump: JumpState,
  deviceZone: string,
  hint: string | null,
): string | null {
  const matches = cities.filter(
    (city) =>
      cityZone(city, deviceZone) === jump.refZone &&
      (jump.refName === undefined ? city.kind === 'local' : defaultName(city) === jump.refName),
  );
  return (matches.find((c) => c.id === hint) ?? matches[0])?.id ?? null;
}

/** The reference as the banner names it: the card's name, the link's, or the zone. */
export function referencePlace(
  cities: readonly StoredCity[],
  jump: JumpState,
  deviceZone: string,
  refId: string | null,
): string {
  const card = refId === null ? undefined : cities.find((c) => c.id === refId);
  if (card) return displayName(card);
  if (jump.refName !== undefined) return jump.refName;
  return jump.refZone === deviceZone ? LOCAL_TIME_NAME : jump.refZone;
}

/** "Fri, Dec 4, 2026 · 8:00 AM in Tokyo" (canvas JumpActive). */
export function bannerWhen(jump: JumpState, place: string, cycle: HourCycle): string {
  const there = jump.instant.toZonedDateTimeISO(jump.refZone);
  return `${formatDate(there, { withYear: true })} · ${formatClockInline(there.hour, there.minute, cycle)} in ${place}`;
}

function placeLine(city: StoredCity, zone: string): string {
  if (city.kind !== 'place') return zone;
  return [city.region, city.country].filter(Boolean).join(', ');
}

/**
 * The "Time is in" list (D12): My Local Time, then a shared link's reference if it isn't in this
 * list (so Change can keep it), then the cities in list order. Cards whose zone this browser
 * doesn't know are left out. Two cities with the same name get their region and country.
 */
export function referenceOptions(
  cities: readonly StoredCity[],
  deviceZone: string,
  jump: JumpState | null,
  refId: string | null,
): ReferenceOption[] {
  const local = cities.find((c) => c.kind === 'local');
  const options: ReferenceOption[] = [
    {
      key: LOCAL_KEY,
      label: `${local ? displayName(local) : LOCAL_TIME_NAME} (${deviceZone})`,
      zone: deviceZone,
      place: deviceZone,
      ...countryOf(deviceZone),
      ...(local ? { cityId: local.id } : {}),
    },
  ];

  if (jump && refId === null && (jump.refName !== undefined || jump.refZone !== deviceZone)) {
    options.push({
      key: LINK_KEY,
      label: jump.refName === undefined ? jump.refZone : `${jump.refName} (${jump.refZone})`,
      zone: jump.refZone,
      place: jump.refName ?? jump.refZone,
      ...(jump.refName === undefined ? {} : { linkName: jump.refName }),
      ...countryOf(jump.refZone),
    });
  }

  const others = cities.flatMap((city) => {
    const zone = city.kind === 'local' ? undefined : canonicalZone(city.zone);
    return zone ? [{ city, zone, name: displayName(city) }] : [];
  });
  for (const { city, zone, name } of others) {
    const shared = others.filter((o) => o.name === name).length > 1;
    options.push({
      key: city.id,
      label: shared ? `${name} (${placeLine(city, zone)})` : name,
      zone,
      place: name,
      linkName: defaultName(city),
      ...countryOf(zone, city),
      cityId: city.id,
    });
  }
  return options;
}

/**
 * Which option the picker starts on: the card it was opened from ("Jump from here"), the current
 * Jump's reference (Change), or My Local Time.
 */
export function initialReferenceKey(
  cities: readonly StoredCity[],
  deviceZone: string,
  jump: JumpState | null,
  refId: string | null,
  fromCardId?: string,
): string {
  const keyFor = (id: string) =>
    cities.find((c) => c.id === id)?.kind === 'local' ? LOCAL_KEY : id;
  if (fromCardId !== undefined) return keyFor(fromCardId);
  if (!jump) return LOCAL_KEY;
  if (refId !== null) return keyFor(refId);
  return jump.refName === undefined && jump.refZone === deviceZone ? LOCAL_KEY : LINK_KEY;
}

/** The date and time fields' text for an instant in a zone. */
export function wallFields(
  instant: Temporal.Instant,
  zone: string,
  cycle: HourCycle,
): { date: string; time: string } {
  const there = instant.toZonedDateTimeISO(zone);
  return {
    date: there.toPlainDate().toString(),
    time: formatClockInline(there.hour, there.minute, cycle),
  };
}

export type DateInput =
  { ok: true; date: Temporal.PlainDate } | { ok: false; error: 'missing' | 'range' };

/** A date field's value ("2026-12-04"; "" while it's incomplete). */
export function parseDateInput(value: string): DateInput {
  if (!/^\d{4,}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: 'missing' };
  let date: Temporal.PlainDate;
  try {
    date = T().PlainDate.from(value, { overflow: 'reject' });
  } catch {
    return { ok: false, error: 'missing' };
  }
  return date.year >= MIN_YEAR && date.year <= MAX_YEAR
    ? { ok: true, date }
    : { ok: false, error: 'range' };
}

/** "That moment is Thu, Dec 3, 2026 · 11:00 PM UTC." */
export function utcLine(instant: Temporal.Instant, cycle: HourCycle): string {
  const utc = instant.toZonedDateTimeISO('UTC');
  return `That moment is ${formatDate(utc, { withYear: true })} · ${formatClockInline(utc.hour, utc.minute, cycle)} UTC.`;
}

type Gap = Extract<WallTimeResult, { kind: 'gap' }>;
type Overlap = Extract<WallTimeResult, { kind: 'overlap' }>;

/** Canvas JumpPickerGap: "2:30 AM doesn’t exist in New York on Mar 14, 2027. …" */
export function gapText(
  gap: Gap,
  typed: HourMinute,
  date: Temporal.PlainDate,
  place: string,
  cycle: HourCycle,
): { time: string; rest: string; fix: string } {
  const clock = (t: { hour: number; minute: number }) => formatClockInline(t.hour, t.minute, cycle);
  return {
    time: clock(typed),
    rest:
      ` in ${place} on ${formatShortDate(date)}. ` +
      `Clocks skip from ${clock(gap.skippedFrom)} to ${clock(gap.skippedTo)} that night.`,
    fix: `Use ${clock(gap.skippedTo)} instead`,
  };
}

export interface OccurrenceChoice {
  value: 'earlier' | 'later';
  /** "1:30 AM EDT" */
  time: string;
  /** "UTC−4:00, the first time" */
  detail: string;
}

/** Canvas JumpPickerOverlap: "Which 1:30 AM?" and its two answers, the first one first. */
export function overlapText(
  overlap: Overlap,
  typed: HourMinute,
  date: Temporal.PlainDate,
  option: ReferenceOption,
  cycle: HourCycle,
): { legend: string; text: string; choices: OccurrenceChoice[] } {
  const clock = formatClockInline(typed.hour, typed.minute, cycle);
  const choices = (['earlier', 'later'] as const).map((value): OccurrenceChoice => {
    const instant = overlap[value];
    const there = instant.toZonedDateTimeISO(option.zone);
    const offsetSeconds = Math.round(there.offsetNanoseconds / 1e9);
    const abbreviation = zoneAbbreviation(
      instant.epochMilliseconds,
      option.zone,
      offsetSeconds,
      option.countryCode,
    );
    return {
      value,
      time: abbreviation ? `${clock} ${abbreviation}` : clock,
      detail: `${formatOffset(there.offsetNanoseconds)}, the ${value === 'earlier' ? 'first' : 'second'} time`,
    };
  });
  return {
    legend: `Which ${clock}?`,
    text: `${clock} happens twice in ${option.place} on ${formatShortDate(date)}, when clocks go back.`,
    choices,
  };
}
