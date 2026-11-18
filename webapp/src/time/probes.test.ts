// The old app's probe cases (docs/REVERSE_ENGINEERING.md §3.3, §3.5, §3.6 and the appendix),
// now as regression tests. Each states what the old app got and what it should be.
import { describe, expect, it } from 'vitest';
import { formatOffset } from './format';
import { calendarDayDiff, relativeDayLabel } from './relativeDay';
import { instant, time, wallIn } from './testUtils';
import { nextOccurrence, resolveWallTime } from './wallTime';
import { date } from './testUtils';

const CHICAGO = 'America/Chicago';

describe('probe D: relative day on a DST-change day', () => {
  it('Tokyo at 2026-03-08 10:00 Chicago is Tomorrow (old app: Today)', () => {
    const at = wallIn('2026-03-08T10:00', CHICAGO);
    const diff = calendarDayDiff(at, 'Asia/Tokyo', CHICAGO);
    expect(relativeDayLabel(diff, 'live')).toBe('Tomorrow');
  });

  it('jumping to 2026-03-09 10:00 Chicago puts Tokyo on the next day (old app: Today)', () => {
    const at = wallIn('2026-03-09T10:00', CHICAGO);
    expect(relativeDayLabel(calendarDayDiff(at, 'Asia/Tokyo', CHICAGO), 'jump')).toBe('Next day');
  });
});

describe('probe E: next occurrence across a London DST change', () => {
  it('spring: Sat 2026-03-28 12:00, pick 09:00 → Sun 09:00 BST (old app: 10:00)', () => {
    const { date: d, result } = nextOccurrence(
      wallIn('2026-03-28T12:00', 'Europe/London'),
      time('09:00'),
      'Europe/London',
    );
    expect(d.toString()).toBe('2026-03-29');
    expect(result).toEqual({ kind: 'exact', instant: instant('2026-03-29T08:00:00Z') });
  });

  it('autumn: Sat 2026-10-24 12:00, pick 09:00 → Sun 09:00 GMT (old app: 08:00)', () => {
    const { result } = nextOccurrence(
      wallIn('2026-10-24T12:00', 'Europe/London'),
      time('09:00'),
      'Europe/London',
    );
    expect(result).toEqual({ kind: 'exact', instant: instant('2026-10-25T09:00:00Z') });
  });
});

describe('probe F: next occurrence across the device zone DST change', () => {
  it('Chicago, now 2026-03-07 12:00, pick 09:00 → 2026-03-08 09:00 CDT (old app: 10:00)', () => {
    const { result } = nextOccurrence(wallIn('2026-03-07T12:00', CHICAGO), time('09:00'), CHICAGO);
    expect(result).toEqual({ kind: 'exact', instant: instant('2026-03-08T14:00:00Z') });
  });
});

describe('probe G: skipped and repeated times are reported, not silently shifted', () => {
  it('New York 02:30 on 2026-03-08 does not exist (old app: silently 03:30)', () => {
    const r = resolveWallTime(date('2026-03-08'), time('02:30'), 'America/New_York');
    expect(r.kind).toBe('gap');
  });

  it('New York 01:30 on 2026-11-01 happens twice (old app: silently the first)', () => {
    const r = resolveWallTime(date('2026-11-01'), time('01:30'), 'America/New_York');
    expect(r).toEqual({
      kind: 'overlap',
      earlier: instant('2026-11-01T05:30:00Z'),
      later: instant('2026-11-01T06:30:00Z'),
    });
  });
});

describe('probe H: picking the current minute means now, not tomorrow', () => {
  const now = wallIn('2026-05-05T12:00:30', CHICAGO);

  it('at 12:00:30, picking 12:00 stays today (old app: 24 hours ahead)', () => {
    const { date: d } = nextOccurrence(now, time('12:00'), CHICAGO);
    expect(d.toString()).toBe('2026-05-05');
  });

  it('at 12:00:30, picking 11:59 moves to tomorrow', () => {
    const { date: d } = nextOccurrence(now, time('11:59'), CHICAGO);
    expect(d.toString()).toBe('2026-05-06');
  });
});

describe('§3.3 offsets at 2026-07-01T12:00Z, viewed from Chicago', () => {
  const at = instant('2026-07-01T12:00:00Z');
  it.each([
    ['Asia/Kolkata', '17:30:00', 'UTC+5:30', 'Today'],
    ['Asia/Kathmandu', '17:45:00', 'UTC+5:45', 'Today'],
    ['Pacific/Chatham', '00:45:00', 'UTC+12:45', 'Tomorrow'],
    ['Australia/Lord_Howe', '22:30:00', 'UTC+10:30', 'Today'],
    ['America/St_Johns', '09:30:00', 'UTC−2:30', 'Today'],
    ['Pacific/Kiritimati', '02:00:00', 'UTC+14:00', 'Tomorrow'],
    ['Pacific/Pago_Pago', '01:00:00', 'UTC−11:00', 'Today'],
  ])('%s shows %s, %s, %s', (zone, wall, offset, label) => {
    const zdt = at.toZonedDateTimeISO(zone);
    expect(zdt.toPlainTime().toString()).toBe(wall);
    expect(formatOffset(zdt.offsetNanoseconds)).toBe(offset);
    expect(relativeDayLabel(calendarDayDiff(at, zone, CHICAGO), 'live')).toBe(label);
  });

  it('Lord Howe uses its 30-minute DST in January: 23:00', () => {
    const zdt = instant('2027-01-01T12:00:00Z').toZonedDateTimeISO('Australia/Lord_Howe');
    expect(zdt.toPlainTime().toString()).toBe('23:00:00');
  });
});

describe('zone rules come from the engine, so they are current', () => {
  // The old app bundled tzdata 2024a and showed Paraguay at UTC−4. Paraguay moved to permanent
  // UTC−3 in tzdata 2024b. This holds wherever the engine's tz data is 2024b or later
  // (Node 26 here: tz 2026a). Older browsers may still differ; that is their data, not ours.
  it.each(['2026-04-15T12:00:00Z', '2026-07-15T12:00:00Z'])(
    'America/Asuncion at %s is UTC−3',
    (at) => {
      expect(
        formatOffset(instant(at).toZonedDateTimeISO('America/Asuncion').offsetNanoseconds),
      ).toBe('UTC−3:00');
    },
  );

  it('zones added after the old app’s data are available (America/Ciudad_Juarez)', () => {
    expect(instant('2026-07-01T12:00:00Z').toZonedDateTimeISO('America/Ciudad_Juarez').hour).toBe(
      6,
    );
  });
});
