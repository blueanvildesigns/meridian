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

  it.each(SAMPLE_PATHS)('applies the security headers, and no noindex, to %s', (path) => {
    const h = headersFor(config, path);
    expect(h['content-security-policy']).toBeTruthy();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('geolocation=()');
    // Launched (R-25): search engines may index the site. Firebase still marks web.app previews.
    expect(h['x-robots-tag']).toBeUndefined();
  });

  it('caches hashed assets forever', () => {
    expect(headersFor(config, '/assets/index-abc123.js')['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it.each(['/', '/index.html', '/some/deep/route'])('never caches the app shell at %s', (path) => {
    expect(headersFor(config, path)['cache-control']).toBe('no-cache');
  });

  it.each(['/', '/some/deep/route'])(
    'rewrites the extensionless path %s to the SPA entry',
    (path) => {
      expect(rewriteFor(config, path)).toBe('/index.html');
    },
  );

  // Otherwise a missing hashed file (an old chunk after a deploy, a source map) would be
  // answered with index.html under the year-long immutable cache header.
  it.each(['/assets/index-gone.js', '/assets/index-abc123.js.map', '/data/cities.v0.json'])(
    'does not rewrite the file-like path %s',
    (path) => {
      expect(rewriteFor(config, path)).toBeUndefined();
    },
  );
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

  // WebKit applies it to http://localhost too, which breaks the e2e server, and in production it
  // does nothing: every resource is same-origin and Firebase serves HTTPS only, with HSTS.
  it('omits upgrade-insecure-requests', () => {
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });

  it('locks down framing, plugins, base URI and forms', () => {
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'none'"]);
  });
});
