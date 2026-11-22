// Checking a bug report's JSON body. Unknown fields are ignored; known ones must be strings within
// their limits once sanitized. The honeypot (`website`) must be empty: people never see it, so a
// value there means a bot filled in every field it found.

import { LIMITS } from './limits.js';
import { charLength, sanitizeLine, sanitizeText } from './sanitize.js';

export interface BugReport {
  description: string;
  steps?: string;
  email?: string;
  diagnostics?: string;
}

export type FieldName = keyof typeof LIMITS;

export type ValidationResult =
  | { ok: true; report: BugReport }
  | { ok: false; reason: 'honeypot' }
  | { ok: false; reason: 'invalid'; fields: Partial<Record<FieldName | 'body', string>> };

/** Deliberately loose: one @, no spaces or angle brackets, a dot in the domain. */
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateReport(body: unknown): ValidationResult {
  if (!isRecord(body))
    return { ok: false, reason: 'invalid', fields: { body: 'Expected a JSON object.' } };

  const honeypot = body['website'];
  if (honeypot !== undefined && honeypot !== '') return { ok: false, reason: 'honeypot' };

  const fields: Partial<Record<FieldName | 'body', string>> = {};
  const text = (name: FieldName, line = false): string | undefined => {
    const raw = body[name];
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string') {
      fields[name] = 'Must be text.';
      return undefined;
    }
    const clean = line ? sanitizeLine(raw) : sanitizeText(raw);
    if (charLength(clean) > LIMITS[name]) {
      fields[name] = `Must be ${LIMITS[name]} characters or fewer.`;
      return undefined;
    }
    return clean === '' ? undefined : clean;
  };

  const description = text('description');
  const steps = text('steps');
  const email = text('email', true);
  const diagnostics = text('diagnostics');

  if (description === undefined && !fields.description) fields.description = 'Required.';
  if (email !== undefined && !EMAIL.test(email)) fields.email = 'Not an email address.';

  if (Object.keys(fields).length > 0 || description === undefined) {
    return { ok: false, reason: 'invalid', fields };
  }
  return {
    ok: true,
    report: {
      description,
      ...(steps !== undefined && { steps }),
      ...(email !== undefined && { email }),
      ...(diagnostics !== undefined && { diagnostics }),
    },
  };
}
