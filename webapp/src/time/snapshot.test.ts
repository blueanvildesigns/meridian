import { describe, expect, it } from 'vitest';
import { zoneSnapshot } from './snapshot';
import { instant } from './testUtils';

describe('zoneSnapshot', () => {
  it('matches the canvas Main board (Chicago device, 21:43 on Tue Nov 17)', () => {
    const at = instant('2026-11-18T03:43:00Z');
    const kolkata = zoneSnapshot(at, 'Asia/Kolkata', 'America/Chicago');
    expect(kolkata.dateTime.toString()).toBe('2026-11-18T09:13:00');
    expect(kolkata.dayDiff).toBe(1);
    expect(kolkata.minutesAhead).toBe(690);
    expect(zoneSnapshot(at, 'America/Chicago', 'America/Chicago').minutesAhead).toBe(0);
    expect(zoneSnapshot(at, 'Australia/Sydney', 'America/Chicago').minutesAhead).toBe(17 * 60);
  });
});
