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

// Where Firebase Hosting's requests to the function come from, as Google's front end records them.
// Seen in production on 2026-11-24/25 (17 requests, all in these blocks). All three are Google's
// own ranges (goog.json) and none is a Google Cloud customer range (cloud.json), so nobody can rent
// a machine there to pose as Hosting. If Hosting starts arriving from elsewhere, its visitors fall
// back to sharing that address's limit: the limit gets stricter, never looser.
const HOSTING_PROXY_V4: readonly (readonly [number, number])[] = [
  cidr('66.102.0.0/20'),
  cidr('74.125.0.0/16'),
  cidr('192.178.0.0/15'),
  cidr('127.0.0.0/8'), // the Hosting emulator; Google's front end never appends a loopback address
];

function cidr(block: string): readonly [number, number] {
  const [base = '', bits = '32'] = block.split('/');
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return [((ipv4ToInt(base) ?? 0) & mask) >>> 0, mask];
}

function ipv4ToInt(address: string): number | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return undefined;
    n = n * 256 + Number(part);
  }
  return n;
}

/** True for an address Hosting's requests arrive from (or the emulator's loopback). */
export function isHostingProxy(address: string): boolean {
  if (address === '::1') return true;
  const v4 = ipv4ToInt(address.replace(/^::ffff:/i, ''));
  if (v4 === undefined) return false;
  return HOSTING_PROXY_V4.some(([base, mask]) => (v4 & mask) >>> 0 === base);
}

/**
 * The client's address, from X-Forwarded-For. Google's front end appends the address it received
 * the request from, so the last entry is the only one a client can't write. At the function's own
 * URL that is the client. Through Hosting it is Hosting, and the entry before it is the visitor
 * (Hosting replaces whatever X-Forwarded-For the visitor sent; decision item 25). So: walk from the
 * right past Hosting's addresses and take the first other one. Falls back to the socket address.
 */
export function clientAddress(
  headers: Record<string, string | string[] | undefined>,
  fallback: string | undefined,
): string {
  const raw = headers['x-forwarded-for'];
  const entries = (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry && !isHostingProxy(entry)) return entry;
  }
  return entries[0] || fallback || 'unknown';
}
