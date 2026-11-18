import { describe, expect, it } from 'vitest';
import {
  browserHourCycle,
  formatClock,
  formatClockInline,
  formatDate,
  formatDifference,
  formatOffset,
  formatShortDate,
  resolveHourCycle,
} from './format';
import { date } from './testUtils';

const M = '−';
const HOUR = 3600e9;

describe('formatOffset (canvas: "UTC−6:00", "UTC+5:30")', () => {
  it.each([
    [0, 'UTC+0:00'],
    [-6 * HOUR, `UTC${M}6:00`],
    [5.5 * HOUR, 'UTC+5:30'],
    [5.75 * HOUR, 'UTC+5:45'],
    [-2.5 * HOUR, `UTC${M}2:30`],
    [14 * HOUR, 'UTC+14:00'],
    [12.75 * HOUR, 'UTC+12:45'],
  ])('%d ns -> %s', (ns, text) => {
    expect(formatOffset(ns)).toBe(text);
  });
});

describe('formatDifference (canvas: "Same time", "+1h", "+11h 30m")', () => {
  it.each([
    [0, 'Same time'],
    [60, '+1h'],
    [690, '+11h 30m'],
    [-150, `${M}2h 30m`],
    [45, '+45m'],
    [-45, `${M}45m`],
    [1500, '+25h'],
  ])('%d min -> %s', (min, text) => {
    expect(formatDifference(min)).toBe(text);
  });
});

describe('formatClock', () => {
  it.each([
    [0, 0, '12', '12:00', 'AM'],
    [9, 13, '12', '9:13', 'AM'],
    [12, 5, '12', '12:05', 'PM'],
    [21, 43, '12', '9:43', 'PM'],
    [0, 0, '24', '00:00', ''],
    [9, 5, '24', '09:05', ''],
    [21, 43, '24', '21:43', ''],
  ] as const)('%d:%d in %sh -> %s %s', (h, m, cycle, text, period) => {
    expect(formatClock(h, m, cycle)).toEqual({ time: text, dayPeriod: period });
  });

  it('joins for banners: "8:00 AM" and "08:00"', () => {
    expect(formatClockInline(8, 0, '12')).toBe('8:00 AM');
    expect(formatClockInline(8, 0, '24')).toBe('08:00');
  });
});

describe('hour cycle', () => {
  it('follows the locale by default', () => {
    expect(browserHourCycle('en-US')).toBe('12');
    expect(browserHourCycle('en-GB')).toBe('24');
    expect(browserHourCycle('de-DE')).toBe('24');
  });

  it('lets the setting override the locale', () => {
    expect(resolveHourCycle('24', 'en-US')).toBe('24');
    expect(resolveHourCycle('12', 'en-GB')).toBe('12');
    expect(resolveHourCycle('browser', 'en-GB')).toBe('24');
  });
});

describe('dates (canvas: "Tue, Nov 17", "Fri, Dec 4, 2026")', () => {
  it('formats with and without the year', () => {
    expect(formatDate(date('2026-11-17'))).toBe('Tue, Nov 17');
    expect(formatDate(date('2026-12-04'), { withYear: true })).toBe('Fri, Dec 4, 2026');
    expect(formatDate(date('2027-03-14'), { withYear: true })).toBe('Sun, Mar 14, 2027');
  });

  it('formats the short date used in DST messages', () => {
    expect(formatShortDate(date('2027-03-14'))).toBe('Mar 14, 2027');
  });
});
