import { describe, expect, it } from 'vitest';
import { clientAddress, isHostingProxy, RateLimiter } from './rateLimit.js';

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

describe('isHostingProxy', () => {
  it('knows the blocks Hosting arrives from, and loopback', () => {
    for (const a of ['66.102.8.32', '74.125.210.170', '192.178.11.103', '192.179.0.1']) {
      expect(isHostingProxy(a)).toBe(true);
    }
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(isHostingProxy(a)).toBe(true);
  });

  it('refuses everything else, including Google Cloud customer ranges', () => {
    for (const a of [
      '66.102.16.1', // just past 66.102.0.0/20
      '74.126.0.1',
      '192.177.255.255',
      '192.180.0.0',
      '34.120.0.1', // Google Cloud
      '104.15.219.238',
      '2600:1700:32e0:4690::10',
      '198.51.100.25',
      'not-an-address',
      '1.2.3',
      '1.2.3.256',
    ]) {
      expect(isHostingProxy(a)).toBe(false);
    }
  });
});

describe('clientAddress', () => {
  it('at the function’s own URL, ignores a made-up entry in front of the real one', () => {
    // As seen in production: Google's front end appends the address it received the request from.
    expect(clientAddress({ 'x-forwarded-for': '198.51.100.25,104.15.219.238' }, undefined)).toBe(
      '104.15.219.238',
    );
    expect(
      clientAddress({ 'x-forwarded-for': '198.51.100.25,2600:1700:32e0:4690::10' }, undefined),
    ).toBe('2600:1700:32e0:4690::10');
  });

  it('through Hosting, takes the visitor Hosting names in front of its own address', () => {
    expect(
      clientAddress({ 'x-forwarded-for': '2600:1700:32e0:4690::10,192.178.11.103' }, undefined),
    ).toBe('2600:1700:32e0:4690::10');
    expect(clientAddress({ 'x-forwarded-for': '203.0.113.7, 74.125.210.10' }, undefined)).toBe(
      '203.0.113.7',
    );
  });

  it('can’t be fooled by a made-up Hosting address in front of the real one', () => {
    expect(
      clientAddress({ 'x-forwarded-for': '198.51.100.25, 74.125.0.1, 104.15.219.238' }, undefined),
    ).toBe('104.15.219.238');
  });

  it('keeps the emulator’s made-up address (Hosting emulator passes it through)', () => {
    expect(clientAddress({ 'x-forwarded-for': '203.0.113.9' }, '127.0.0.1')).toBe('203.0.113.9');
    expect(clientAddress({ 'x-forwarded-for': '203.0.113.9, 127.0.0.1' }, '127.0.0.1')).toBe(
      '203.0.113.9',
    );
  });

  it('joins repeated headers in order', () => {
    expect(clientAddress({ 'x-forwarded-for': ['198.51.100.1', '203.0.113.7'] }, undefined)).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to the leftmost proxy, the socket address, then a shared bucket', () => {
    expect(clientAddress({ 'x-forwarded-for': '74.125.0.1, 66.102.8.1' }, undefined)).toBe(
      '74.125.0.1',
    );
    expect(clientAddress({}, '10.0.0.2')).toBe('10.0.0.2');
    expect(clientAddress({ 'x-forwarded-for': ' ' }, undefined)).toBe('unknown');
  });
});
