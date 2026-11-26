// DST heads-up (M10). Runs in both test projects, native Temporal and the polyfill (vite.config.ts):
// every answer here is the engine's zone rules.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTransitionCache,
  HEADS_UP_DAYS,
  nextTransition,
  offsetDiffers,
  upcomingChange,
} from './dst';
import { instant } from './testUtils';

const iso = (i: Temporal.Instant | null | undefined) => i?.toString() ?? null;
const change = (zone: string, at: string, days?: number) => {
  const c = upcomingChange(zone, instant(at), days);
  return c && { at: c.at.toString(), date: c.date.toString() };
};

beforeEach(() => {
  clearTransitionCache();
});

describe('nextTransition', () => {
  it('finds New York’s change both ways (a DST-skip day, then clocks going back)', () => {
    expect(iso(nextTransition('America/New_York', instant('2027-03-05T22:00:00Z')))).toBe(
      '2027-03-14T07:00:00Z',
    );
    expect(iso(nextTransition('America/New_York', instant('2027-03-14T07:00:00Z')))).toBe(
      '2027-11-07T06:00:00Z',
    );
  });

  it('finds a southern-hemisphere change (Sydney goes back in April, forward in October)', () => {
    expect(iso(nextTransition('Australia/Sydney', instant('2027-03-05T22:00:00Z')))).toBe(
      '2027-04-03T16:00:00Z',
    );
    expect(iso(nextTransition('Australia/Sydney', instant('2027-04-03T16:00:00Z')))).toBe(
      '2027-10-02T16:00:00Z',
    );
  });

  it('finds Lord Howe’s half-hour change', () => {
    expect(iso(nextTransition('Australia/Lord_Howe', instant('2027-03-30T00:00:00Z')))).toBe(
      '2027-04-03T15:00:00Z',
    );
  });

  it('is null for zones that don’t change: a half-hour zone, UTC, and one that dropped DST', () => {
    expect(nextTransition('Asia/Kolkata', instant('2027-03-05T22:00:00Z'))).toBeNull();
    expect(nextTransition('UTC', instant('2027-03-05T22:00:00Z'))).toBeNull();
    // São Paulo's last change was Feb 17, 2019.
    expect(iso(nextTransition('America/Sao_Paulo', instant('2019-01-01T00:00:00Z')))).toBe(
      '2019-02-17T02:00:00Z',
    );
    expect(nextTransition('America/Sao_Paulo', instant('2019-02-17T02:00:00Z'))).toBeNull();
  });

  it('keeps its answer until the change passes, and asks again after', () => {
    const zone = 'America/New_York';
    const first = nextTransition(zone, instant('2027-03-01T00:00:00Z'));
    expect(nextTransition(zone, instant('2027-03-14T06:59:59Z'))).toBe(first);
    expect(iso(nextTransition(zone, instant('2027-03-14T07:00:00Z')))).toBe('2027-11-07T06:00:00Z');
    // A clock set back before the remembered moment gets a fresh answer, not the later one.
    expect(iso(nextTransition(zone, instant('2026-12-01T00:00:00Z')))).toBe('2027-03-14T07:00:00Z');
  });
});

describe('upcomingChange', () => {
  it('flags a change within 14 days, with the day it happens there (canvas DstLive)', () => {
    expect(HEADS_UP_DAYS).toBe(14);
    // Fri, Mar 5, 2027, 4:00 PM in Chicago.
    const at = '2027-03-05T22:00:00Z';
    expect(change('America/Chicago', at)).toEqual({
      at: '2027-03-14T08:00:00Z',
      date: '2027-03-14',
    });
    expect(change('America/New_York', at)).toEqual({
      at: '2027-03-14T07:00:00Z',
      date: '2027-03-14',
    });
    // London changes on Mar 28 and Sydney on Apr 4: too far off. Kolkata never.
    expect(change('Europe/London', at)).toBeNull();
    expect(change('Australia/Sydney', at)).toBeNull();
    expect(change('Asia/Kolkata', at)).toBeNull();
  });

  it('counts 14 days to the instant', () => {
    expect(change('America/New_York', '2027-02-28T07:00:00Z')?.date).toBe('2027-03-14');
    expect(change('America/New_York', '2027-02-28T06:59:00Z')).toBeNull();
    expect(change('America/New_York', '2027-03-14T06:59:00Z')?.date).toBe('2027-03-14');
    expect(change('America/New_York', '2027-03-14T07:00:00Z')).toBeNull();
    expect(change('America/New_York', '2027-02-20T00:00:00Z', 30)?.date).toBe('2027-03-14');
  });

  it('names the day in the offset before the change, as the zone announces it', () => {
    // Clocks going back: 2:00 AM EDT becomes 1:00 AM EST on Sun, Nov 7.
    expect(change('America/New_York', '2027-11-01T00:00:00Z')?.date).toBe('2027-11-07');
    // Sydney goes back at 3:00 AM AEDT on Sun, Apr 4 (still Saturday in UTC).
    expect(change('Australia/Sydney', '2027-03-25T00:00:00Z')).toEqual({
      at: '2027-04-03T16:00:00Z',
      date: '2027-04-04',
    });
    // Lord Howe moves 30 minutes, at 2:00 AM on Sun, Apr 4.
    expect(change('Australia/Lord_Howe', '2027-03-25T00:00:00Z')?.date).toBe('2027-04-04');
    // São Paulo's midnight changes: forward on Sun, Nov 4, 2018, back on Sun, Feb 17, 2019 (read
    // after the change, that one would be Saturday 11:00 PM).
    expect(change('America/Sao_Paulo', '2018-10-25T00:00:00Z')).toEqual({
      at: '2018-11-04T03:00:00Z',
      date: '2018-11-04',
    });
    expect(change('America/Sao_Paulo', '2019-02-10T00:00:00Z')).toEqual({
      at: '2019-02-17T02:00:00Z',
      date: '2019-02-17',
    });
  });

  it('flags nothing for zones that no longer change', () => {
    expect(change('America/Sao_Paulo', '2027-10-25T00:00:00Z')).toBeNull();
    expect(change('Asia/Kolkata', '2027-10-25T00:00:00Z')).toBeNull();
  });
});

describe('offsetDiffers', () => {
  // Canvas DstJump: a Jump to Tue, Mar 30, 2027, 9:00 AM in New York, seen on Fri, Mar 5.
  const then = instant('2027-03-30T13:00:00Z');
  const now = instant('2027-03-05T22:00:00Z');

  it('flags zones whose offset on the jumped date isn’t today’s', () => {
    expect(offsetDiffers('America/Chicago', then, now)).toBe(true);
    expect(offsetDiffers('America/New_York', then, now)).toBe(true);
    expect(offsetDiffers('Europe/London', then, now)).toBe(true);
  });

  it('leaves the others, even when their difference from My Local Time changes', () => {
    expect(offsetDiffers('Asia/Kolkata', then, now)).toBe(false);
    expect(offsetDiffers('Asia/Tokyo', then, now)).toBe(false);
    // Sydney is on AEDT on both days: it changes on Apr 4.
    expect(offsetDiffers('Australia/Sydney', then, now)).toBe(false);
  });

  it('compares offsets, not days: a Jump past two changes back to the same offset isn’t flagged', () => {
    expect(offsetDiffers('America/New_York', instant('2027-12-05T22:00:00Z'), now)).toBe(false);
    expect(offsetDiffers('Australia/Lord_Howe', instant('2027-06-01T00:00:00Z'), now)).toBe(true);
  });
});
