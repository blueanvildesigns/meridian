import { describe, expect, it } from 'vitest';
import { calendarDayDiff, relativeDayLabel } from './relativeDay';
import { instant } from './testUtils';

const M = '−';

describe('relativeDayLabel', () => {
  it.each([
    [0, 'Today', 'Same day'],
    [1, 'Tomorrow', 'Next day'],
    [-1, 'Yesterday', 'Previous day'],
    [2, '+2 days', '+2 days'],
    [-2, `${M}2 days`, `${M}2 days`],
  ])('%d -> %s / %s', (diff, live, jump) => {
    expect(relativeDayLabel(diff, 'live')).toBe(live);
    expect(relativeDayLabel(diff, 'jump')).toBe(jump);
  });
});

describe('calendarDayDiff', () => {
  it('reaches two days between Kiritimati and Pago Pago', () => {
    const at = instant('2026-07-01T10:30:00Z'); // Kiritimati 00:30 Jul 2, Pago Pago 23:30 Jun 30
    expect(calendarDayDiff(at, 'Pacific/Kiritimati', 'Pacific/Pago_Pago')).toBe(2);
    expect(calendarDayDiff(at, 'Pacific/Pago_Pago', 'Pacific/Kiritimati')).toBe(-2);
  });

  it('is zero for the same zone', () => {
    expect(
      calendarDayDiff(instant('2026-03-08T08:00:00Z'), 'America/Chicago', 'America/Chicago'),
    ).toBe(0);
  });
});
