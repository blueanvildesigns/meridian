import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msUntilNextMinute, useMinuteClock } from './useMinuteClock';

describe('msUntilNextMinute', () => {
  it('waits until just after the next boundary', () => {
    const t = Date.UTC(2026, 10, 18, 10, 59, 58, 500);
    expect(t + msUntilNextMinute(t)).toBe(Date.UTC(2026, 10, 18, 11, 0, 0, 25));
  });

  it('waits a full minute when exactly on a boundary', () => {
    const t = Date.UTC(2026, 10, 18, 11, 0, 0, 0);
    expect(msUntilNextMinute(t)).toBe(60_025);
  });
});

describe('useMinuteClock', () => {
  const START = Date.UTC(2026, 10, 18, 10, 59, 58, 0);

  beforeEach(() => {
    vi.useFakeTimers({ now: START });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates on the minute boundary, not before', () => {
    const { result } = renderHook(() => useMinuteClock());
    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(1_900);
    });
    expect(result.current).toBe(START);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(new Date(result.current).getUTCMinutes()).toBe(0);
    expect(new Date(result.current).getUTCHours()).toBe(11);
  });

  it('keeps ticking every minute', () => {
    const { result } = renderHook(() => useMinuteClock());
    act(() => {
      vi.advanceTimersByTime(2_100 + 3 * 60_000);
    });
    expect(new Date(result.current).getUTCMinutes()).toBe(3);
  });

  it('re-reads the time when the page becomes visible again', () => {
    const { result } = renderHook(() => useMinuteClock());
    // The tab was hidden and its timers starved; the clock moved on by 5 minutes.
    vi.setSystemTime(START + 5 * 60_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(START + 5 * 60_000);
  });

  it('stops its timer on unmount', () => {
    const { unmount } = renderHook(() => useMinuteClock());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
