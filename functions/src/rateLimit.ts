// In-memory, fixed-window rate limits.
//
// Tradeoff (docs/archive/2026-11-21-bug-reporting.md): memory is free, needs no setup and adds no
// latency, but it is per instance and forgotten when the instance stops. The function runs with
// maxInstances 1, so while it's warm the counts are effectively global; after a cold start they
// begin again. App Check is the main defence against scripted abuse, and the global cap bounds
// how many issues can be created in a window even if per-address limits are dodged.

export interface Limit {
  max: number;
  windowMs: number;
}

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Window {
  start: number;
  count: number;
}

export class RateLimiter {
  readonly #windows = new Map<string, Window>();
  readonly #maxKeys: number;

  constructor(
    private readonly limit: Limit,
    private readonly now: () => number = Date.now,
    maxKeys = 10_000,
  ) {
    this.#maxKeys = maxKeys;
  }

  /** Counts one request for `key` and says whether it's allowed. Refused requests don't count. */
  take(key: string): RateDecision {
    const now = this.now();
    let window = this.#windows.get(key);
    if (!window || now - window.start >= this.limit.windowMs) {
      this.#evictIfFull(now);
      window = { start: now, count: 0 };
      this.#windows.set(key, window);
    }
    if (window.count >= this.limit.max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.start + this.limit.windowMs - now) / 1000),
        ),
      };
    }
    window.count++;
    return { allowed: true };
  }

  get size(): number {
    return this.#windows.size;
  }

  /** Bounds memory: drop expired windows, and if that isn't enough, the oldest. */
  #evictIfFull(now: number): void {
    if (this.#windows.size < this.#maxKeys) return;
    for (const [key, w] of this.#windows) {
      if (now - w.start >= this.limit.windowMs) this.#windows.delete(key);
    }
    while (this.#windows.size >= this.#maxKeys) {
      const oldest = this.#windows.keys().next();
      if (oldest.done) break;
      this.#windows.delete(oldest.value);
    }
  }
}

/**
 * The client's address as Firebase Hosting passes it on: the first entry of X-Forwarded-For.
 * A client can put its own value in front, so this is a best effort, not an identity; see the
 * decision file. Falls back to the socket address.
 */
export function clientAddress(
  headers: Record<string, string | string[] | undefined>,
  fallback: string | undefined,
): string {
  const raw = headers['x-forwarded-for'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const first = value?.split(',')[0]?.trim();
  return first || fallback || 'unknown';
}
