// Add to calendar (M9; canvas CalendarDialog): a Jump's moment as a calendar event, built in the
// browser. Three outputs (decision 12): an .ics file, and Google Calendar, Outlook.com and
// Microsoft 365 compose links. Times always go as UTC instants ("Z"), never as "+HH:MM" offsets
// (decision 13), so every calendar shows the event in its own zone; the reference zone's name goes
// in the description (M9-5). Nothing here is sent anywhere: the links only open when asked.

import { formatClockInline, formatDate, type HourCycle } from '../../time/format';

/** The presets drawn on CalendarDialog (decision 10), in minutes. */
export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;
/** The Custom… field's range (M9-3). */
export const MIN_CUSTOM_MINUTES = 5;
export const MAX_CUSTOM_MINUTES = 1440;
/** Long enough for any real title; keeps the links well under browsers' URL limits. */
export const MAX_TITLE_LENGTH = 200;

/** "15 min", "1 hour", "1.5 hours", "2 hours". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = minutes / 60;
  return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** A Custom… entry: whole minutes from 5 to 1,440, or null. */
export function parseCustomMinutes(text: string): number | null {
  if (!/^\s*\d{1,4}\s*$/.test(text)) return null;
  const minutes = Number(text);
  return minutes >= MIN_CUSTOM_MINUTES && minutes <= MAX_CUSTOM_MINUTES ? minutes : null;
}

export interface CalendarEvent {
  /** May be empty: the event is then untitled (M9-6). */
  title: string;
  start: Temporal.Instant;
  minutes: number;
  /** The Jump reference city's zone, the event's anchor (decision 11). */
  refZone: string;
  /** How the banner names the reference: "Tokyo", "My Local Time", "America/Chicago". */
  refPlace: string;
  /** The Meridian link for the Jump. */
  link: string;
}

export const eventEnd = (event: CalendarEvent) => event.start.add({ minutes: event.minutes });

/** "20261203T230000Z": iCalendar's UTC form, which Google's `dates` uses too. */
function basicUtc(instant: Temporal.Instant): string {
  return instant.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '').replace(/\.\d+/, '');
}

/** "2026-12-03T23:00:00Z", for Outlook's `startdt` and `enddt`. */
function extendedUtc(instant: Temporal.Instant): string {
  return instant.toString({ smallestUnit: 'second' });
}

/** "Fri, Dec 4, 2026 · 8:00 AM" in a zone. */
function wallText(instant: Temporal.Instant, zone: string, cycle: HourCycle): string {
  const there = instant.toZonedDateTimeISO(zone);
  return `${formatDate(there, { withYear: true })} · ${formatClockInline(there.hour, there.minute, cycle)}`;
}

/**
 * The event's description, in every output: where the time was set, and the link back.
 * "Set in Meridian for Fri, Dec 4, 2026 · 8:00 AM in Tokyo (Asia/Tokyo)." + link.
 */
export function eventDescription(event: CalendarEvent, cycle: HourCycle): string {
  const zone = event.refPlace === event.refZone ? '' : ` (${event.refZone})`;
  return `Set in Meridian for ${wallText(event.start, event.refZone, cycle)} in ${event.refPlace}${zone}.\n${event.link}`;
}

/** iCalendar TEXT escaping (RFC 5545 3.3.11). */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets (RFC 5545 3.1), never splitting a UTF-8 character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line holds 75 octets; continuation lines start with a space, so 74 more.
    const limit = parts.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * The .ics file: one VEVENT with UTC start and end. An untitled event has no SUMMARY, which
 * calendars show as "(No title)".
 */
export function icsFile(
  event: CalendarEvent,
  { uid, now, cycle }: { uid: string; now: Temporal.Instant; cycle: HourCycle },
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Blue Anvil Designs//Meridian//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${basicUtc(now)}`,
    `DTSTART:${basicUtc(event.start)}`,
    `DTEND:${basicUtc(eventEnd(event))}`,
    ...(event.title.trim() ? [`SUMMARY:${escapeText(event.title.trim())}`] : []),
    `DESCRIPTION:${escapeText(eventDescription(event, cycle))}`,
    `URL:${event.link}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "meridian-2026-12-04.ics": the start's date in the reference zone (M9-5). */
export function icsFileName(event: CalendarEvent): string {
  return `meridian-${event.start.toZonedDateTimeISO(event.refZone).toPlainDate().toString()}.ics`;
}

const query = (params: Record<string, string>) =>
  Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

/** Google Calendar's event template (decision 12). */
export function googleCalendarUrl(event: CalendarEvent, cycle: HourCycle): string {
  return `https://calendar.google.com/calendar/render?${query({
    action: 'TEMPLATE',
    text: event.title.trim(),
    dates: `${basicUtc(event.start)}/${basicUtc(eventEnd(event))}`,
    details: eventDescription(event, cycle),
  })}`;
}

/**
 * Outlook's compose page: Outlook.com for personal accounts, Microsoft 365 for work or school
 * (decision 12). Unofficial and best effort (decision 13); `outlook.office.com` now redirects to
 * `outlook.cloud.microsoft`, keeping the whole address through sign-in (M8-13).
 */
export function outlookUrl(
  event: CalendarEvent,
  account: 'personal' | 'work',
  cycle: HourCycle,
): string {
  const host = account === 'personal' ? 'outlook.live.com' : 'outlook.office.com';
  return `https://${host}/calendar/0/action/compose?${query({
    subject: event.title.trim(),
    startdt: extendedUtc(event.start),
    enddt: extendedUtc(eventEnd(event)),
    body: eventDescription(event, cycle),
    path: '/calendar/action/compose',
    rru: 'addevent',
  })}`;
}

/**
 * The end time the dialog shows (decision 10): in the reference city's zone, and in the person's
 * own calendar zone (the device's) when that's a different zone.
 */
export function endTimeLines(event: CalendarEvent, deviceZone: string, cycle: HourCycle): string[] {
  const end = eventEnd(event);
  const lines = [`Ends ${wallText(end, event.refZone, cycle)} in ${event.refPlace}`];
  if (deviceZone !== event.refZone) {
    lines.push(`${wallText(end, deviceZone, cycle)} in your calendar (${deviceZone})`);
  }
  return lines;
}
