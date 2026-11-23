import { describe, expect, it } from 'vitest';
import { LIMITS } from './limits.js';
import { validateReport } from './validate.js';

describe('validateReport', () => {
  it('accepts a minimal report', () => {
    expect(validateReport({ description: 'The clock is wrong' })).toEqual({
      ok: true,
      report: { description: 'The clock is wrong' },
    });
  });

  it('accepts every field, sanitized, and ignores unknown ones', () => {
    const result = validateReport({
      description: ' It broke\r\n',
      steps: '1. Open\u0000 it',
      email: '  me@example.com ',
      diagnostics: 'App version: 1.0.1',
      website: '',
      extra: 'ignored',
    });
    expect(result).toEqual({
      ok: true,
      report: {
        description: 'It broke',
        steps: '1. Open it',
        email: 'me@example.com',
        diagnostics: 'App version: 1.0.1',
      },
    });
  });

  it('treats empty optional fields as absent', () => {
    expect(validateReport({ description: 'x', steps: '  ', email: '', diagnostics: null })).toEqual(
      { ok: true, report: { description: 'x' } },
    );
  });

  it.each([undefined, null, '', '   \n\t ', '\u0000‮'])(
    'requires a description (%j)',
    (description) => {
      expect(validateReport({ description })).toMatchObject({
        ok: false,
        reason: 'invalid',
        fields: { description: 'Required.' },
      });
    },
  );

  it.each([null, 'text', 42, ['description'], true])('refuses a body that is %j', (body) => {
    expect(validateReport(body)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('refuses fields that are not text', () => {
    expect(validateReport({ description: 'x', steps: 5, email: { a: 1 } })).toMatchObject({
      ok: false,
      fields: { steps: 'Must be text.', email: 'Must be text.' },
    });
  });

  it.each(Object.entries(LIMITS))('holds %s to %d characters', (name, max) => {
    const base = { description: 'x' };
    const fill = name === 'email' ? `${'a'.repeat(max - 12)}@example.com` : 'a'.repeat(max);
    expect(validateReport({ ...base, [name]: fill })).toMatchObject({ ok: true });
    const over = name === 'email' ? `a${fill}` : `${fill}a`;
    expect(validateReport({ ...base, [name]: over })).toMatchObject({
      ok: false,
      fields: { [name]: `Must be ${max} characters or fewer.` },
    });
  });

  it('counts characters after sanitizing and by code point', () => {
    const emoji = '😀'.repeat(LIMITS.description); // 4,000 UTF-16 units
    expect(validateReport({ description: emoji })).toMatchObject({ ok: true });
    const padded = `${'\u0000'.repeat(500)}${'a'.repeat(LIMITS.description)}`;
    expect(validateReport({ description: padded })).toMatchObject({ ok: true });
  });

  it.each(['plainaddress', 'a@b', 'a b@example.com', '<a@example.com>', 'a@example.c'])(
    'refuses the email %s',
    (email) => {
      expect(validateReport({ description: 'x', email })).toMatchObject({
        ok: false,
        fields: { email: 'Not an email address.' },
      });
    },
  );

  it.each(['https://spam.example', ' ', 0, false])('rejects a filled honeypot (%j)', (website) => {
    expect(validateReport({ description: 'x', website })).toEqual({
      ok: false,
      reason: 'honeypot',
    });
  });
});
