import { describe, expect, it } from 'vitest';
import { clientAddress, RateLimiter } from './rateLimit.js';

function clock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('allows up to the limit per key, then says when to retry', () => {
    const c = clock();
    const limiter = new RateLimiter({ max: 2, windowMs: 60_000 }, c.now);
    expect(limiter.take('a')).toEqual({ allowed: true });
    expect(limiter.take('a')).toEqual({ allowed: true });
    c.advance(15_000);
    expect(limiter.take('a')).toEqual({ allowed: false, retryAfterSeconds: 45 });
    expect(limiter.take('b')).toEqual({ allowed: true });
  });

  it('starts a fresh window once the old one has passed', () => {
    const c = clock();
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 }, c.now);
    limiter.take('a');
    expect(limiter.take('a').allowed).toBe(false);
    c.advance(1000);
    expect(limiter.take('a').allowed).toBe(true);
  });

  it('does not count refused requests', () => {
    const c = clock();
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 }, c.now);
    limiter.take('a');
    for (let i = 0; i < 10; i++) limiter.take('a');
    c.advance(1000);
    expect(limiter.take('a').allowed).toBe(true);
  });

  it('keeps its memory bounded', () => {
    const c = clock();
    const limiter = new RateLimiter({ max: 1, windowMs: 1000 }, c.now, 100);
    for (let i = 0; i < 1000; i++) limiter.take(`k${i}`);
    expect(limiter.size).toBeLessThanOrEqual(100);
  });
});

describe('clientAddress', () => {
  it('takes the first X-Forwarded-For entry', () => {
    expect(clientAddress({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '10.0.0.2')).toBe(
      '203.0.113.7',
    );
    expect(clientAddress({ 'x-forwarded-for': ['198.51.100.1'] }, undefined)).toBe('198.51.100.1');
  });

  it('falls back to the socket address, then to a shared bucket', () => {
    expect(clientAddress({}, '10.0.0.2')).toBe('10.0.0.2');
    expect(clientAddress({ 'x-forwarded-for': ' ' }, undefined)).toBe('unknown');
  });
});
