import { describe, expect, it, vi } from 'vitest';
import { canonicalZone, deviceZone, isValidZone, ZONE_ALIASES } from './zones';

describe('canonicalZone', () => {
  it.each([
    ['America/New_York', 'America/New_York'],
    ['america/new_york', 'America/New_York'],
    ['Asia/Calcutta', 'Asia/Kolkata'],
    ['US/Eastern', 'America/New_York'],
    ['Etc/UTC', 'UTC'],
    [' UTC ', 'UTC'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalZone(input)).toBe(expected);
  });

  it.each(['Not/AZone', '', 'Mars/Olympus_Mons'])('rejects %j', (input) => {
    expect(canonicalZone(input)).toBeUndefined();
    expect(isValidZone(input)).toBe(false);
  });

  it('maps only to zones this engine knows', () => {
    for (const target of new Set(Object.values(ZONE_ALIASES))) {
      expect(isValidZone(target), target).toBe(true);
    }
  });

  it('maps every legacy name the engine accepts to its current name', () => {
    for (const [legacy, target] of Object.entries(ZONE_ALIASES)) {
      if (isValidZone(legacy)) expect(canonicalZone(legacy), legacy).toBe(target);
    }
  });
});

describe('deviceZone', () => {
  it('normalises a legacy name reported by the engine', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: 'Asia/Calcutta',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(deviceZone()).toBe('Asia/Kolkata');
  });

  it('falls back to UTC when the engine reports nothing usable', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      timeZone: undefined,
    } as unknown as Intl.ResolvedDateTimeFormatOptions);
    expect(deviceZone()).toBe('UTC');
  });
});
