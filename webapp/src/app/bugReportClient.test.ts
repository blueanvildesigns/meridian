import { describe, expect, it, vi } from 'vitest';
import {
  BUG_REPORT_ENDPOINT,
  bugReportServiceFromEnv,
  createBugReportService,
  type BugReportPayload,
} from './bugReportClient';

const payload: BugReportPayload = { description: 'Broken', website: '' };
const ISSUE = 'https://github.com/blueanvildesigns/meridian/issues/12';

function answer(status: number, body: unknown) {
  return vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
}

describe('createBugReportService', () => {
  it('posts the payload as JSON with the App Check token, and no cookies', async () => {
    const f = answer(201, { ok: true, number: 12, url: ISSUE });
    const service = createBugReportService({ fetch: f, getToken: () => Promise.resolve('tok') });
    expect(await service.send(payload)).toEqual({ ok: true, number: 12, url: ISSUE });
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe(BUG_REPORT_ENDPOINT);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': 'tok' },
    });
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  it('sends no App Check header without a token source (the emulator)', async () => {
    const f = answer(201, { ok: true, number: 0, url: ISSUE.replace('12', '0') });
    await createBugReportService({ fetch: f }).send(payload);
    expect(f.mock.calls[0]?.[1]?.headers).not.toHaveProperty('X-Firebase-AppCheck');
  });

  it('does not send at all if the spam check fails to load', async () => {
    const f = answer(201, {});
    const service = createBugReportService({
      fetch: f,
      getToken: () => Promise.reject(new Error('script blocked')),
    });
    expect(await service.send(payload)).toMatchObject({ ok: false, reason: 'verification' });
    expect(f).not.toHaveBeenCalled();
  });

  it('reports a network failure', async () => {
    const f = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('offline')));
    expect(await createBugReportService({ fetch: f }).send(payload)).toMatchObject({
      ok: false,
      reason: 'network',
    });
  });

  it.each([
    [429, 'rate_limited', /several reports/],
    [429, 'busy', /Lots of reports/],
    [401, 'app_check', /couldn’t confirm/],
    [503, 'disabled', /switched off/],
    [502, 'github', /GitHub didn’t accept/],
    [500, 'surprise', /Something went wrong/],
  ])('turns %d %s into its own message', async (status, error, message) => {
    const result = await createBugReportService({
      fetch: answer(status, { ok: false, error }),
    }).send(payload);
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(message) as unknown });
  });

  it('survives a body that is not JSON', async () => {
    const f = vi.fn<typeof fetch>(() => Promise.resolve(new Response('<html>', { status: 504 })));
    expect(await createBugReportService({ fetch: f }).send(payload)).toMatchObject({
      ok: false,
      reason: 'server',
    });
  });

  it.each([
    'https://evil.example/issues/12',
    'https://github.com/someone/else/issues/12',
    'https://github.com/blueanvildesigns/meridian/issues/12/../../x',
    'javascript:alert(1)',
  ])('never trusts a result link outside this repo’s issues (%s)', async (url) => {
    const f = answer(201, { ok: true, number: 12, url });
    expect(await createBugReportService({ fetch: f }).send(payload)).toMatchObject({ ok: false });
  });
});

describe('bugReportServiceFromEnv', () => {
  const full = {
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_APP_ID: '1:2:web:3',
    VITE_FIREBASE_PROJECT_ID: 'meridian-web-a5829',
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: 'site',
  };

  it('is off (GitHub’s form instead) unless all four settings are there', () => {
    expect(bugReportServiceFromEnv({})).toBeNull();
    for (const key of Object.keys(full)) {
      expect(bugReportServiceFromEnv({ ...full, [key]: '' })).toBeNull();
    }
    expect(bugReportServiceFromEnv(full)).not.toBeNull();
  });

  it('allows the emulator shortcut in development only', () => {
    expect(bugReportServiceFromEnv({ VITE_BUG_REPORT_EMULATOR: 'true' })).toBeNull();
    expect(bugReportServiceFromEnv({ DEV: true, VITE_BUG_REPORT_EMULATOR: 'true' })).not.toBeNull();
  });
});
