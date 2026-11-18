// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { THEME_BOOT_SCRIPT } from '../src/app/themeBoot';
import {
  cspDirectives,
  globToRegExp,
  headersFor,
  loadHosting,
  rewriteFor,
} from './firebaseHosting';

const config = loadHosting();
const SAMPLE_PATHS = [
  '/',
  '/index.html',
  '/assets/index-abc123.js',
  '/assets/ibm-plex-sans-latin-400-normal-x.woff2',
  '/favicon.svg',
  '/robots.txt',
  '/some/deep/route',
  '/data/cities.v1.json',
];

describe('globToRegExp', () => {
  it.each([
    ['**', '/', true],
    ['**', '/a/b.js', true],
    ['/assets/**', '/assets/x/y.js', true],
    ['/assets/**', '/assetsx/y.js', false],
    ['**/*.html', '/index.html', true],
    ['**/*.html', '/a/b.htm', false],
  ])('%s vs %s -> %s', (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});

describe('firebase.json headers', () => {
  it('never sets the same header twice for one path (Firebase leaves that undefined)', () => {
    for (const path of SAMPLE_PATHS) expect(() => headersFor(config, path)).not.toThrow();
  });

  it.each(SAMPLE_PATHS)('applies security headers and noindex to %s', (path) => {
    const h = headersFor(config, path);
    expect(h['content-security-policy']).toBeTruthy();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('geolocation=()');
    expect(h['x-robots-tag']).toContain('noindex'); // pre-launch: remove at the launch gate
  });

  it('caches hashed assets forever', () => {
    expect(headersFor(config, '/assets/index-abc123.js')['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it.each(['/', '/index.html', '/some/deep/route'])('never caches the app shell at %s', (path) => {
    expect(headersFor(config, path)['cache-control']).toBe('no-cache');
  });

  it('rewrites unknown paths to the SPA entry', () => {
    expect(rewriteFor(config, '/some/deep/route')).toBe('/index.html');
  });
});

describe('Content-Security-Policy', () => {
  const csp = cspDirectives(config);

  it('allows the inline theme boot script by hash and nothing else inline', () => {
    const hash = createHash('sha256').update(THEME_BOOT_SCRIPT, 'utf8').digest('base64');
    expect(csp.get('script-src')).toEqual(["'self'", `'sha256-${hash}'`]);
  });

  it('allows only same-origin resources', () => {
    const all = [...csp.values()].flat().join(' ');
    expect(all).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
    for (const d of ['default-src', 'style-src', 'font-src', 'img-src', 'connect-src']) {
      expect(csp.get(d)).toEqual(["'self'"]);
    }
  });

  it('locks down framing, plugins, base URI and forms', () => {
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'none'"]);
  });
});
