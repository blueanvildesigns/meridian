// Abbreviations depend on the engine's CLDR data, so these pin Node 26 (ICU 78) behaviour.
// Browsers may differ; the contract that matters everywhere is "alphabetic or nothing".
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('zoneAbbreviation where the engine says "GMT+0" (Chrome 152)', () => {
  const Real = Intl.DateTimeFormat;
  afterEach(() => {
    Object.defineProperty(Intl, 'DateTimeFormat', {
      value: Real,
      configurable: true,
      writable: true,
    });
    vi.resetModules();
  });

  it.each([
    [JAN, 'Europe/London', 'GB', 'GMT'],
    [JUL, 'Europe/London', 'GB', 'BST'],
    [JAN, 'Europe/Dublin', 'IE', 'GMT'],
    [JUL, 'Europe/Dublin', 'IE', 'IST'],
    [JAN, 'Africa/Accra', 'GH', 'GMT'],
    [JAN, 'Atlantic/Reykjavik', 'IS', 'GMT'],
  ])('%s %s (%s) -> %s', async (at, zone, country, expected) => {
    class ChromeLike extends Real {
      override formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
        return super
          .formatToParts(date)
          .map((p) =>
            p.type === 'timeZoneName' && /^(GMT|BST|IST)$/.test(p.value)
              ? { ...p, value: p.value === 'GMT' ? 'GMT+0' : 'GMT+1' }
              : p,
          );
      }
    }
    Object.defineProperty(Intl, 'DateTimeFormat', { value: ChromeLike, configurable: true });
    vi.resetModules();
    const fresh = await import('./abbreviation');
    const offsetSeconds = at.toZonedDateTimeISO(zone).offsetNanoseconds / 1e9;
    expect(fresh.zoneAbbreviation(at.epochMilliseconds, zone, offsetSeconds, country)).toBe(
      expected,
    );
  });

  it('still omits a label for UTC+0 zones the tz database calls something else (Lisbon is WET)', async () => {
    class GmtOnly extends Real {
      override formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
        return super
          .formatToParts(date)
          .map((p) => (p.type === 'timeZoneName' ? { ...p, value: 'GMT+0' } : p));
      }
    }
    Object.defineProperty(Intl, 'DateTimeFormat', { value: GmtOnly, configurable: true });
    vi.resetModules();
    const fresh = await import('./abbreviation');
    expect(fresh.zoneAbbreviation(JAN.epochMilliseconds, 'Europe/Lisbon', 0, 'PT')).toBeUndefined();
  });
});
