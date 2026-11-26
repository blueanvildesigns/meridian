// Add to calendar (M9): the .ics file, the web calendar links and the end time. Runs in both test
// projects, native Temporal and the polyfill (vite.config.ts), since all of it is time math.
import { describe, expect, it } from 'vitest';
import { instant, wallIn } from '../../time/testUtils';
import {
  durationLabel,
  endTimeLines,
  eventDescription,
  googleCalendarUrl,
  icsFile,
  icsFileName,
  outlookUrl,
  parseCustomMinutes,
  type CalendarEvent,
} from './calendar';

const LINK = 'https://meridian.example/#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';
// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO: CalendarEvent = {
  title: 'Planning call',
  start: instant('2026-12-03T23:00:00Z'),
  minutes: 60,
  refZone: 'Asia/Tokyo',
  refPlace: 'Tokyo',
  link: LINK,
};
const NOW = instant('2026-11-18T03:43:00Z');
const ics = (event: CalendarEvent) =>
  icsFile(event, { uid: 'test-uid@meridian', now: NOW, cycle: '12' });
const field = (file: string, name: string) =>
  file
    .replace(/\r\n /g, '')
    .split('\r\n')
    .find((l) => l.startsWith(`${name}:`));

describe('durations', () => {
  it('labels the presets as drawn', () => {
    expect([15, 30, 45, 60, 90, 120].map(durationLabel)).toEqual([
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
      '1.5 hours',
      '2 hours',
    ]);
  });

  it('takes whole minutes from 5 to 1,440 for Custom…', () => {
    expect(parseCustomMinutes('25')).toBe(25);
    expect(parseCustomMinutes(' 1440 ')).toBe(1440);
    for (const bad of ['', '4', '1441', '2.5', '-10', 'ten', '1e2']) {
      expect(parseCustomMinutes(bad)).toBeNull();
    }
  });
});

describe('icsFile', () => {
  it('writes one event with UTC times, CRLF lines and a final CRLF', () => {
    expect(ics(TOKYO)).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Blue Anvil Designs//Meridian//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:test-uid@meridian',
        'DTSTAMP:20261118T034300Z',
        'DTSTART:20261203T230000Z',
        'DTEND:20261204T000000Z',
        'SUMMARY:Planning call',
        'DESCRIPTION:Set in Meridian for Fri\\, Dec 4\\, 2026 · 8:00 AM in Tokyo (Asi',
        ' a/Tokyo).\\nhttps://meridian.example/#at=2026-12-03T23:00:00Z&ref=Asia/Toky',
        ' o&name=Tokyo',
        'URL:https://meridian.example/#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=T',
        ' okyo',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
    );
  });

  it('leaves out SUMMARY for an untitled event', () => {
    expect(field(ics({ ...TOKYO, title: '   ' }), 'SUMMARY')).toBeUndefined();
  });

  it('escapes commas, semicolons, backslashes and newlines in the title', () => {
    expect(field(ics({ ...TOKYO, title: 'A, B; C\\D\nE' }), 'SUMMARY')).toBe(
      'SUMMARY:A\\, B\\; C\\\\D\\nE',
    );
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    const file = ics({ ...TOKYO, title: 'Réunion à Zürich '.repeat(8) });
    const encoder = new TextEncoder();
    for (const line of file.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(field(file, 'SUMMARY')).toBe(`SUMMARY:${'Réunion à Zürich '.repeat(8).trim()}`);
  });

  it('runs across a DST change by the real length, not the wall clock', () => {
    // 1:30 AM EST in New York on 2027-03-14; clocks skip 2:00–3:00, so an hour later it's 3:30 EDT.
    const event: CalendarEvent = {
      ...TOKYO,
      start: wallIn('2027-03-14T01:30', 'America/New_York'),
      refZone: 'America/New_York',
      refPlace: 'New York',
    };
    const file = ics(event);
    expect(field(file, 'DTSTART')).toBe('DTSTART:20270314T063000Z');
    expect(field(file, 'DTEND')).toBe('DTEND:20270314T073000Z');
    expect(endTimeLines(event, 'America/New_York', '12')).toEqual([
      'Ends Sun, Mar 14, 2027 · 3:30 AM in New York',
    ]);
  });

  it('names the file for the start date in the reference zone', () => {
    // 11:00 PM UTC on Dec 3 is already Dec 4 in Tokyo.
    expect(icsFileName(TOKYO)).toBe('meridian-2026-12-04.ics');
    expect(icsFileName({ ...TOKYO, refZone: 'Europe/London', refPlace: 'London' })).toBe(
      'meridian-2026-12-03.ics',
    );
  });
});

describe('web calendar links', () => {
  it('Google Calendar: a template with UTC dates', () => {
    const url = new URL(googleCalendarUrl(TOKYO, '12'));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Planning call',
      dates: '20261203T230000Z/20261204T000000Z',
      details: eventDescription(TOKYO, '12'),
    });
  });

  it('Outlook.com and Microsoft 365: their own hosts, UTC times with Z', () => {
    const personal = new URL(outlookUrl(TOKYO, 'personal', '12'));
    const work = new URL(outlookUrl(TOKYO, 'work', '12'));
    expect(personal.origin).toBe('https://outlook.live.com');
    expect(work.origin).toBe('https://outlook.office.com');
    for (const url of [personal, work]) {
      expect(url.pathname).toBe('/calendar/0/action/compose');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        subject: 'Planning call',
        startdt: '2026-12-03T23:00:00Z',
        enddt: '2026-12-04T00:00:00Z',
        body: eventDescription(TOKYO, '12'),
        path: '/calendar/action/compose',
        rru: 'addevent',
      });
    }
  });

  it('leaves the title out of the links when it’s empty', () => {
    expect(new URL(googleCalendarUrl({ ...TOKYO, title: '' }, '12')).searchParams.has('text')).toBe(
      false,
    );
    expect(
      new URL(outlookUrl({ ...TOKYO, title: '' }, 'work', '12')).searchParams.has('subject'),
    ).toBe(false);
  });
});

describe('eventDescription', () => {
  it('names the zone after the place, unless the place is the zone', () => {
    expect(eventDescription(TOKYO, '24')).toBe(
      `Set in Meridian for Fri, Dec 4, 2026 · 08:00 in Tokyo (Asia/Tokyo).\n${LINK}`,
    );
    const zoneOnly = { ...TOKYO, refZone: 'America/Chicago', refPlace: 'America/Chicago' };
    expect(eventDescription(zoneOnly, '12')).toBe(
      `Set in Meridian for Thu, Dec 3, 2026 · 5:00 PM in America/Chicago.\n${LINK}`,
    );
  });
});

describe('endTimeLines', () => {
  it('gives the end in the reference zone and in the person’s own zone', () => {
    expect(endTimeLines(TOKYO, 'America/Chicago', '12')).toEqual([
      'Ends Fri, Dec 4, 2026 · 9:00 AM in Tokyo',
      'Thu, Dec 3, 2026 · 6:00 PM in your calendar (America/Chicago)',
    ]);
  });

  it('handles a half-hour zone', () => {
    const kolkata = { ...TOKYO, refZone: 'Asia/Kolkata', refPlace: 'Kolkata', minutes: 45 };
    expect(endTimeLines(kolkata, 'America/Chicago', '24')).toEqual([
      'Ends Fri, Dec 4, 2026 · 05:15 in Kolkata',
      'Thu, Dec 3, 2026 · 17:45 in your calendar (America/Chicago)',
    ]);
  });

  it('handles a southern-hemisphere zone as its clocks go back', () => {
    // Sydney's daylight time ends at 3:00 AM on 2027-04-04 (back to 2:00 AM). An hour from
    // 2:30 AM AEDT is 2:30 AM AEST.
    const sydney: CalendarEvent = {
      ...TOKYO,
      start: instant('2027-04-03T15:30:00Z'),
      refZone: 'Australia/Sydney',
      refPlace: 'Sydney',
    };
    expect(sydney.start.toZonedDateTimeISO('Australia/Sydney').hour).toBe(2);
    expect(endTimeLines(sydney, 'Australia/Sydney', '12')).toEqual([
      'Ends Sun, Apr 4, 2027 · 2:30 AM in Sydney',
    ]);
  });

  it('handles a zone that dropped DST (São Paulo)', () => {
    // Noon on Jan 15: UTC−2 in 2019 (its last daylight-time summer), UTC−3 now.
    const at2019 = {
      ...TOKYO,
      start: instant('2019-01-15T14:00:00Z'),
      refZone: 'America/Sao_Paulo',
      refPlace: 'São Paulo',
    };
    const at2027 = { ...at2019, start: instant('2027-01-15T15:00:00Z') };
    expect(endTimeLines(at2019, 'UTC', '12')).toEqual([
      'Ends Tue, Jan 15, 2019 · 1:00 PM in São Paulo',
      'Tue, Jan 15, 2019 · 3:00 PM in your calendar (UTC)',
    ]);
    expect(endTimeLines(at2027, 'UTC', '12')).toEqual([
      'Ends Fri, Jan 15, 2027 · 1:00 PM in São Paulo',
      'Fri, Jan 15, 2027 · 4:00 PM in your calendar (UTC)',
    ]);
  });
});
