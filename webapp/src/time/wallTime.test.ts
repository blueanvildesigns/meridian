import { describe, expect, it } from 'vitest';
import { date, instant, time } from './testUtils';
import { resolveWallTime } from './wallTime';

const NY = 'America/New_York';

describe('resolveWallTime', () => {
  it('resolves an ordinary time exactly', () => {
    expect(resolveWallTime(date('2027-06-01'), time('12:00'), NY)).toEqual({
      kind: 'exact',
      instant: instant('2027-06-01T16:00:00Z'),
    });
  });

  it('spec example: NY 2027-03-14 02:30 is skipped; suggest 3:00 AM', () => {
    const r = resolveWallTime(date('2027-03-14'), time('02:30'), NY);
    expect(r.kind).toBe('gap');
    if (r.kind !== 'gap') return;
    expect(r.skippedFrom.toString()).toBe('2027-03-14T02:00:00');
    expect(r.skippedTo.toString()).toBe('2027-03-14T03:00:00');
    expect(r.suggestion.equals(instant('2027-03-14T07:00:00Z'))).toBe(true);
  });

  it('treats the first skipped minute (02:00) as skipped, and 03:00 as exact', () => {
    expect(resolveWallTime(date('2027-03-14'), time('02:00'), NY).kind).toBe('gap');
    expect(resolveWallTime(date('2027-03-14'), time('03:00'), NY).kind).toBe('exact');
    expect(resolveWallTime(date('2027-03-14'), time('01:59'), NY).kind).toBe('exact');
  });

  it('spec example: NY 2027-11-07 01:30 happens twice; first is EDT', () => {
    expect(resolveWallTime(date('2027-11-07'), time('01:30'), NY)).toEqual({
      kind: 'overlap',
      earlier: instant('2027-11-07T05:30:00Z'),
      later: instant('2027-11-07T06:30:00Z'),
    });
  });

  it('treats 01:00 on the fall-back day as repeated and 02:00 as exact', () => {
    expect(resolveWallTime(date('2027-11-07'), time('01:00'), NY).kind).toBe('overlap');
    expect(resolveWallTime(date('2027-11-07'), time('02:00'), NY).kind).toBe('exact');
  });

  it('handles Lord Howe’s 30-minute gap and overlap', () => {
    const gap = resolveWallTime(date('2026-10-04'), time('02:15'), 'Australia/Lord_Howe');
    expect(gap.kind === 'gap' && [gap.skippedFrom.toString(), gap.skippedTo.toString()]).toEqual([
      '2026-10-04T02:00:00',
      '2026-10-04T02:30:00',
    ]);
    const overlap = resolveWallTime(date('2026-04-05'), time('01:45'), 'Australia/Lord_Howe');
    expect(overlap.kind).toBe('overlap');
    if (overlap.kind === 'overlap') {
      expect(overlap.earlier.until(overlap.later).total('minutes')).toBe(30);
    }
  });

  it('handles a whole skipped day (Samoa crossed the date line on 2011-12-30)', () => {
    const r = resolveWallTime(date('2011-12-30'), time('12:00'), 'Pacific/Apia');
    expect(r.kind === 'gap' && [r.skippedFrom.toString(), r.skippedTo.toString()]).toEqual([
      '2011-12-30T00:00:00',
      '2011-12-31T00:00:00',
    ]);
  });
});
