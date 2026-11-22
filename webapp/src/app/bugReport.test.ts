import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  bugReportUrl,
  collectDiagnostics,
  detectOs,
  diagnosticsText,
  MAX_URL_LENGTH,
  MAX_USER_AGENT_LENGTH,
  truncate,
  type BrowserInfo,
} from './bugReport';

const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';

const info = (over: Partial<BrowserInfo> = {}): BrowserInfo => ({
  userAgent: CHROME_WIN,
  locale: 'en-GB',
  timeZone: 'Europe/London',
  ...over,
});

const params = (url: string) => new URL(url).searchParams;

describe('collectDiagnostics', () => {
  it('reports the version, browser, OS, zone, time format and locale', () => {
    const text = diagnosticsText(collectDiagnostics('browser', info()));
    expect(text).toMatch(/^App version: \d+\.\d+\.\d+ \(\w+\)$/m);
    expect(text).toContain(`Browser: ${CHROME_WIN}`);
    expect(text).toContain('OS: Windows');
    expect(text).toContain('Time zone: Europe/London');
    expect(text).toContain('Time format: Browser default (24-hour)');
    expect(text).toContain('Locale: en-GB');
    expect(text.split('\n')).toHaveLength(6);
  });

  it('names an explicit time format plainly', () => {
    expect(collectDiagnostics('12', info()).timeFormat).toBe('12-hour');
    expect(collectDiagnostics('24', info({ locale: 'en-US' })).timeFormat).toBe('24-hour');
    expect(collectDiagnostics('browser', info({ locale: 'en-US' })).timeFormat).toBe(
      'Browser default (12-hour)',
    );
  });

  it('caps the user agent and keeps every field on one line', () => {
    const d = collectDiagnostics(
      'browser',
      info({ userAgent: `Evil\nOS: Faked\r\n${'x'.repeat(1000)}`, timeZone: 'A\nB' }),
    );
    expect(Array.from(d.browser).length).toBeLessThanOrEqual(MAX_USER_AGENT_LENGTH);
    expect(d.browser.endsWith('…')).toBe(true);
    for (const value of Object.values(d)) expect(value).not.toMatch(/[\r\n]/);
    expect(diagnosticsText(d).split('\n')).toHaveLength(6);
  });

  it('says Unknown rather than leaving a field blank', () => {
    const d = collectDiagnostics('browser', info({ userAgent: '', locale: '', timeZone: '' }));
    expect(d).toMatchObject({ browser: 'Unknown', os: 'Unknown', locale: 'Unknown' });
    expect(d.timeZone).toBe('Unknown');
  });

  it('has nothing to read saved cities from: only the time format setting goes in', () => {
    // A structural guarantee: the signature takes the setting and the browser's own facts.
    expect(collectDiagnostics.length).toBeLessThanOrEqual(2);
    const keys = Object.keys(collectDiagnostics('12', info())).toSorted();
    expect(keys).toEqual(['browser', 'locale', 'os', 'timeFormat', 'timeZone', 'version']);
  });
});

describe('detectOs', () => {
  it.each([
    [CHROME_WIN, undefined, 'Windows'],
    [SAFARI_IPHONE, undefined, 'iOS'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/151.0', undefined, 'macOS'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0', undefined, 'Linux'],
    ['Mozilla/5.0 (Linux; Android 16; Pixel 10) Chrome/150.0 Mobile', undefined, 'Android'],
    ['Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) Chrome/150.0', undefined, 'ChromeOS'],
    ['Mozilla/5.0 (X11; Linux x86_64) Chrome/150.0', 'Chrome OS', 'ChromeOS'],
    ['whatever', 'macOS', 'macOS'],
    ['whatever', 'Plan 9', 'Unknown'],
  ])('%s (%s) → %s', (ua, platform, expected) => {
    expect(detectOs(ua, platform)).toBe(expected);
  });
});

describe('truncate', () => {
  it('leaves short text alone and marks a cut', () => {
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcdef', 4)).toBe('abc…');
  });

  it('never splits a character made of two UTF-16 units', () => {
    expect(truncate('😀😀😀', 2)).toBe('😀…');
  });
});

describe('bugReportUrl', () => {
  it('opens the bug form on this repo with the diagnostics filled in', () => {
    const diagnostics = diagnosticsText(collectDiagnostics('12', info()));
    const url = new URL(bugReportUrl({ diagnostics }));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/blueanvildesigns/meridian/issues/new',
    );
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('diagnostics')).toBe(diagnostics);
    expect([...url.searchParams.keys()]).toEqual(['template', 'diagnostics']);
  });

  it('encodes characters that mean something in a URL', () => {
    const tricky = 'a & b = c?#d+e/f %20 "q" <x> 東京 😀\nnext';
    const url = bugReportUrl({ diagnostics: tricky, summary: tricky });
    expect(url).not.toContain('#');
    expect(url).not.toContain(' ');
    expect(params(url).get('diagnostics')).toBe(tricky);
    expect(params(url).get('summary')).toBe(tricky);
    expect(params(url).get('template')).toBe('bug_report.yml');
  });

  it('leaves out empty fields', () => {
    expect([...params(bugReportUrl({ summary: '', diagnostics: 'x' })).keys()]).toEqual([
      'template',
      'diagnostics',
    ]);
  });

  it('a real set of diagnostics fits well inside the cap untouched', () => {
    const diagnostics = diagnosticsText(
      collectDiagnostics('browser', info({ userAgent: 'U'.repeat(5000) })),
    );
    const url = bugReportUrl({ diagnostics });
    expect(url.length).toBeLessThan(MAX_URL_LENGTH);
    expect(params(url).get('diagnostics')).toBe(diagnostics);
  });

  it('cuts steps first and diagnostics last to stay under the cap', () => {
    const diagnostics = diagnosticsText(collectDiagnostics('12', info()));
    const url = bugReportUrl({
      summary: 'Short summary',
      'what-happened': 'h'.repeat(600),
      steps: 's'.repeat(5000),
      diagnostics,
    });
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    const p = params(url);
    expect(p.get('diagnostics')).toBe(diagnostics);
    expect(p.get('summary')).toBe('Short summary');
    expect(p.get('what-happened')).toBe('h'.repeat(600));
    expect(p.get('steps')?.endsWith('…')).toBe(true);
  });

  it('never goes over the cap, whatever goes in', () => {
    const field = fc.option(fc.string({ unit: 'binary', maxLength: 3000 }), { nil: undefined });
    fc.assert(
      fc.property(
        fc.record(
          { summary: field, 'what-happened': field, steps: field, diagnostics: field },
          { requiredKeys: [] },
        ),
        (fields) => {
          const defined = Object.fromEntries(
            Object.entries(fields).filter(([, v]) => v !== undefined),
          );
          const url = bugReportUrl(defined);
          expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
          expect(params(url).get('template')).toBe('bug_report.yml');
        },
      ),
      { numRuns: 200 },
    );
  });
});
