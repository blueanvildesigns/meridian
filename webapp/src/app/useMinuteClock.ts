// The current time for the clock list, updated on each minute boundary (D10). No seconds are drawn,
// so nothing ticks in between. Background tabs throttle timers and laptops sleep, so the time is
// re-read whenever the page becomes visible again.

import { useEffect, useState } from 'react';

const MINUTE = 60_000;
/** Fire just after the boundary, so the new minute has definitely started. */
const SLACK_MS = 25;

/** Milliseconds from `now` until just after the next minute boundary. */
export function msUntilNextMinute(now: number): number {
  return MINUTE - (((now % MINUTE) + MINUTE) % MINUTE) + SLACK_MS;
}

/** Epoch milliseconds, refreshed every minute and on returning to the page. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (from: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, msUntilNextMinute(from));
    };
    const tick = () => {
      const t = Date.now();
      setNow(t);
      schedule(t);
    };
    const resync = () => {
      if (document.visibilityState === 'visible') tick();
    };

    schedule(Date.now());
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, []);

  return now;
}
