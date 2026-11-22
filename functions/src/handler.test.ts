import { describe, expect, it, vi } from 'vitest';
import { createHandler, type HandlerDeps, type HttpRequest } from './handler.js';
import { isAllowedOrigin } from './origins.js';
import { RateLimiter } from './rateLimit.js';

const ORIGIN = 'https://meridian.blueanvildesigns.io';

function response() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    set(field: string, value: string) {
      res.headers[field] = value;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    enabled: true,
    verifyAppCheck: vi.fn(() => Promise.resolve(true)),
    skipAppCheck: false,
    createIssue: vi.fn(() =>
      Promise.resolve({ number: 7, url: 'https://github.com/blueanvildesigns/meridian/issues/7' }),
    ),
    saveContact: vi.fn(() => Promise.resolve()),
    perAddress: new RateLimiter({ max: 5, windowMs: 3_600_000 }),
    global: new RateLimiter({ max: 30, windowMs: 3_600_000 }),
    isAllowedOrigin: (o) => isAllowedOrigin(o, { emulator: false }),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...over,
  };
}

function request(body: unknown, over: Partial<HttpRequest> = {}): HttpRequest {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      'x-firebase-appcheck': 'token',
      'x-forwarded-for': '203.0.113.7',
    },
    body,
    rawBody: raw,
    ip: '10.0.0.1',
    ...over,
  };
}

async function run(d: HandlerDeps, req: HttpRequest) {
  const res = response();
  await createHandler(d)(req, res);
  return res;
}

describe('report-bug handler', () => {
  it('creates an issue and answers with its number and URL', async () => {
    const d = deps();
    const res = await run(d, request({ description: 'Broken', diagnostics: 'App version: 1' }));
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      number: 7,
      url: 'https://github.com/blueanvildesigns/meridian/issues/7',
      contactSaved: false,
    });
    expect(d.verifyAppCheck).toHaveBeenCalledWith('token');
    expect(d.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ title: '[Bug]: Broken', labels: ['bug'] }),
    );
    expect(d.saveContact).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('stores the email privately and keeps it out of the issue and the logs', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const d = deps({ log });
    const email = 'reporter@example.com';
    const res = await run(d, request({ description: 'Broken', email }));
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ contactSaved: true });
    expect(d.saveContact).toHaveBeenCalledWith(email, {
      number: 7,
      url: 'https://github.com/blueanvildesigns/meridian/issues/7',
    });
    const draft = vi.mocked(d.createIssue).mock.calls[0]?.[0];
    expect(JSON.stringify(draft)).not.toContain(email);
    const logged = JSON.stringify([log.info.mock.calls, log.warn.mock.calls, log.error.mock.calls]);
    expect(logged).not.toContain(email);
    expect(logged).not.toContain('Broken');
    expect(logged).not.toContain('203.0.113.7');
  });

  it('still succeeds if the email cannot be stored, and says so', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const d = deps({ log, saveContact: vi.fn(() => Promise.reject(new Error('firestore down'))) });
    const res = await run(d, request({ description: 'Broken', email: 'a@example.com' }));
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ ok: true, contactSaved: false });
    expect(log.error).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('a@example.com');
  });

  it.each(['GET', 'PUT', 'OPTIONS'])('allows only POST (%s → 405)', async (method) => {
    const d = deps();
    const res = await run(d, request({}, { method }));
    expect(res.statusCode).toBe(405);
    expect(res.headers['Allow']).toBe('POST');
    expect(d.createIssue).not.toHaveBeenCalled();
  });

  it('wants JSON', async () => {
    const res = await run(
      deps(),
      request({}, { headers: { 'content-type': 'text/plain', origin: ORIGIN } }),
    );
    expect(res.statusCode).toBe(415);
  });

  it('refuses bodies over 16 KB before looking at them', async () => {
    const d = deps();
    const res = await run(
      d,
      request({ description: 'x' }, { rawBody: Buffer.alloc(16 * 1024 + 1) }),
    );
    expect(res.statusCode).toBe(413);
    expect(d.verifyAppCheck).not.toHaveBeenCalled();
  });

  it.each(['https://evil.example', 'http://meridian.blueanvildesigns.io', 'http://localhost:5173'])(
    'refuses posts from the page %s',
    async (origin) => {
      const req = request({ description: 'x' });
      req.headers['origin'] = origin;
      const res = await run(deps(), req);
      expect(res.statusCode).toBe(403);
    },
  );

  it.each([
    'https://meridian-web-a5829.web.app',
    'https://meridian-web-a5829--pr40-abc123de.web.app',
    'https://meridian-web-a5829.firebaseapp.com',
  ])('accepts posts from %s', async (origin) => {
    const req = request({ description: 'x' });
    req.headers['origin'] = origin;
    expect((await run(deps(), req)).statusCode).toBe(201);
  });

  it('accepts localhost only in the emulator', () => {
    expect(isAllowedOrigin('http://localhost:5173', { emulator: true })).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:5000', { emulator: true })).toBe(true);
    expect(isAllowedOrigin('http://localhost.evil.example', { emulator: true })).toBe(false);
  });

  it('answers 503 when switched off', async () => {
    const d = deps({ enabled: false });
    const res = await run(d, request({ description: 'x' }));
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ ok: false, error: 'disabled' });
    expect(d.createIssue).not.toHaveBeenCalled();
  });

  it('refuses a missing or invalid App Check token', async () => {
    const d = deps({ verifyAppCheck: vi.fn(() => Promise.resolve(false)) });
    const missing = request({ description: 'x' });
    delete missing.headers['x-firebase-appcheck'];
    expect((await run(d, missing)).statusCode).toBe(401);
    expect(d.verifyAppCheck).not.toHaveBeenCalled();

    expect((await run(d, request({ description: 'x' }))).statusCode).toBe(401);
    const throwing = deps({ verifyAppCheck: vi.fn(() => Promise.reject(new Error('bad jwt'))) });
    const res = await run(throwing, request({ description: 'x' }));
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: 'app_check' });
    expect(d.createIssue).not.toHaveBeenCalled();
  });

  it('skips App Check only when told to (the emulator)', async () => {
    const d = deps({ skipAppCheck: true });
    const req = request({ description: 'x' });
    delete req.headers['x-firebase-appcheck'];
    expect((await run(d, req)).statusCode).toBe(201);
    expect(d.verifyAppCheck).not.toHaveBeenCalled();
  });

  it('rejects honeypot hits without creating an issue', async () => {
    const d = deps();
    const res = await run(d, request({ description: 'x', website: 'https://spam.example' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: 'rejected' });
    expect(d.createIssue).not.toHaveBeenCalled();
  });

  it('explains invalid fields', async () => {
    const res = await run(deps(), request({ description: '', email: 'nope' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: 'invalid',
      fields: { description: 'Required.', email: 'Not an email address.' },
    });
  });

  it('limits each address to 5 an hour', async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) {
      expect((await run(d, request({ description: `r${i}` }))).statusCode).toBe(201);
    }
    const res = await run(d, request({ description: 'one too many' }));
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
    // Another address is unaffected.
    const other = request({ description: 'x' });
    other.headers['x-forwarded-for'] = '198.51.100.9';
    expect((await run(d, other)).statusCode).toBe(201);
  });

  it('caps issues across all addresses', async () => {
    const d = deps({ global: new RateLimiter({ max: 2, windowMs: 3_600_000 }) });
    const from = (ip: string) => {
      const req = request({ description: 'x' });
      req.headers['x-forwarded-for'] = ip;
      return req;
    };
    expect((await run(d, from('192.0.2.1'))).statusCode).toBe(201);
    expect((await run(d, from('192.0.2.2'))).statusCode).toBe(201);
    const res = await run(d, from('192.0.2.3'));
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ error: 'busy' });
  });

  it('answers 502 with a friendly message when GitHub fails', async () => {
    const d = deps({ createIssue: vi.fn(() => Promise.reject(new Error('GitHub answered 401'))) });
    const res = await run(d, request({ description: 'x' }));
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ ok: false, error: 'github' });
    expect((res.body as { message: string }).message).toMatch(/GitHub/);
    expect(JSON.stringify(res.body)).not.toContain('401');
  });
});
