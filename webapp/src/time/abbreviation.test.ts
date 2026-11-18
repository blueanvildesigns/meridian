// Abbreviations depend on the engine's CLDR data, so these pin Node 26 (ICU 78) behaviour.
// Browsers may differ; the contract that matters everywhere is "alphabetic or nothing".
import { describe, expect, it } from 'vitest';
import { zoneAbbreviation } from './abbreviation';
import { instant } from './testUtils';

const JAN = instant('2026-01-15T12:00:00Z');
const JUL = instant('2026-07-15T12:00:00Z');

function abbr(at: Temporal.Instant, zone: string, country?: string) {
  const offsetSeconds = at.toZonedDateTimeISO(zone).offsetNanoseconds / 1e9;
  return zoneAbbreviation(at.epochMilliseconds, zone, offsetSeconds, country);
}

describe('zoneAbbreviation', () => {
  it.each([
    [JAN, 'America/Chicago', 'US', 'CST'],
    [JUL, 'America/Chicago', 'US', 'CDT'],
    [JAN, 'Europe/London', 'GB', 'GMT'],
    [JUL, 'Europe/London', 'GB', 'BST'],
    [JAN, 'Europe/Warsaw', 'PL', 'CET'],
    [JAN, 'Asia/Kolkata', 'IN', 'IST'],
    [JAN, 'Australia/Sydney', 'AU', 'AEDT'],
    [JAN, 'America/St_Johns', 'CA', 'NST'],
    [JAN, 'Asia/Tokyo', 'JP', 'JST'],
    [JAN, 'Asia/Shanghai', 'CN', 'CST'],
    [JUL, 'Asia/Jerusalem', 'IL', 'IDT'],
    [JAN, 'UTC', undefined, 'UTC'],
  ])('%s %s (%s) -> %s', (at, zone, country, expected) => {
    expect(abbr(at, zone, country)).toBe(expected);
  });

  it('uses en-GB when the country locale has nothing (Europe/London summer, no country)', () => {
    expect(abbr(JUL, 'Europe/London')).toBe('BST');
  });

  it.each([
    ['Asia/Kathmandu', 'NP'],
    ['America/Sao_Paulo', 'BR'],
    ['Asia/Dhaka', 'BD'],
  ])('omits a GMT±… form for %s', (zone, country) => {
    expect(abbr(JAN, zone, country)).toBeUndefined();
  });

  it('omits rather than guesses if a tzdb label no longer matches the offset', () => {
    expect(zoneAbbreviation(JAN.epochMilliseconds, 'Asia/Tokyo', 36000, 'JP')).toBeUndefined();
  });

  it('ignores a malformed country code', () => {
    expect(abbr(JAN, 'America/Chicago', 'usa')).toBe('CST');
  });
});
