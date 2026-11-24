// POST /api/report-bug (a Firebase Hosting rewrite to the reportBug function).
//
// Order: cheap checks first (method, type, size, origin, per-address rate limit), then App Check
// and our own one-use check on the token (tokenLedger.ts), then validation, then the global cap,
// then GitHub. A token is used up even if the report then fails validation; the web app fetches
// a new one for every Send. The reporter's email goes to the private
// contact store after the issue exists, never into the issue. Logs carry outcomes and issue
// numbers only: no report text, no email, no address.
//
// Everything outside (App Check, GitHub, Firestore, the clock) comes in through `HandlerDeps`, so
// the tests can run it without any of them.

import type { CreatedIssue } from './github.js';
import { issueFromReport, type IssueDraft } from './issue.js';
import { MAX_BODY_BYTES } from './limits.js';
import { clientAddress, type RateLimiter } from './rateLimit.js';
import type { AppCheckResult, VerifiedToken } from './tokenLedger.js';
import { validateReport } from './validate.js';

/** The parts of an HTTP request the handler reads (an Express request has them all). */
export interface HttpRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: Buffer;
  ip?: string | undefined;
}

/** The parts of an HTTP response the handler uses (an Express response has them all). */
export interface HttpResponse {
  status(code: number): HttpResponse;
  set(field: string, value: string): HttpResponse;
  json(body: unknown): unknown;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface HandlerDeps {
  /** Off switch (BUG_REPORT_ENABLED). */
  enabled: boolean;
  /** Checks the App Check token (and asks App Check to consume it). Throws if it's invalid. */
  verifyAppCheck: (token: string) => Promise<AppCheckResult>;
  /** Records a verified token as used: true the first time, false on any later use. */
  claimToken: (token: VerifiedToken) => Promise<boolean>;
  /** Only ever true in the emulator, where there's no App Check to ask. */
  skipAppCheck: boolean;
  createIssue: (draft: IssueDraft) => Promise<CreatedIssue>;
  saveContact: (email: string, issue: CreatedIssue) => Promise<void>;
  perAddress: RateLimiter;
  global: RateLimiter;
  isAllowedOrigin: (origin: string) => boolean;
  log: Logger;
}

export type ErrorCode =
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'too_large'
  | 'forbidden_origin'
  | 'disabled'
  | 'rate_limited'
  | 'app_check'
  | 'rejected'
  | 'invalid'
  | 'busy'
  | 'unavailable'
  | 'github';

/** Short, friendly, and safe to show as is. The web app shows its own text for each code. */
const MESSAGES: Record<ErrorCode, string> = {
  method_not_allowed: 'Send bug reports with POST.',
  unsupported_media_type: 'Send bug reports as JSON.',
  too_large: 'That report is too long.',
  forbidden_origin: 'Bug reports can only be sent from Meridian.',
  disabled: 'Bug reports are switched off right now. Please report it on GitHub instead.',
  rate_limited: 'Too many reports from here. Please try again later.',
  app_check: 'This browser couldn’t be verified. Please report it on GitHub instead.',
  rejected: 'This report couldn’t be accepted. Please report it on GitHub instead.',
  invalid: 'Some of the report is missing or too long.',
  busy: 'Lots of reports are arriving right now. Please try again later.',
  unavailable: 'Bug reports aren’t working right now. Please report it on GitHub instead.',
  github: 'GitHub didn’t accept the report. Please try again, or report it on GitHub instead.',
};

function header(req: HttpRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function fail(res: HttpResponse, status: number, error: ErrorCode, extra: object = {}): void {
  res.status(status).json({ ok: false, error, message: MESSAGES[error], ...extra });
}

export function createHandler(deps: HandlerDeps) {
  return async (req: HttpRequest, res: HttpResponse): Promise<void> => {
    res.set('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      fail(res, 405, 'method_not_allowed');
      return;
    }
    const type = header(req, 'content-type') ?? '';
    if (!/^application\/json\b/i.test(type)) {
      fail(res, 415, 'unsupported_media_type');
      return;
    }
    const size = req.rawBody?.length ?? Number(header(req, 'content-length') ?? 0);
    if (size > MAX_BODY_BYTES) {
      fail(res, 413, 'too_large');
      return;
    }
    // Browsers send Origin on every POST. Other clients may leave it out; App Check stops them.
    const origin = header(req, 'origin');
    if (origin !== undefined && !deps.isAllowedOrigin(origin)) {
      deps.log.warn('bug report refused', { outcome: 'forbidden_origin' });
      fail(res, 403, 'forbidden_origin');
      return;
    }
    if (!deps.enabled) {
      fail(res, 503, 'disabled');
      return;
    }

    const rate = deps.perAddress.take(clientAddress(req.headers, req.ip));
    if (!rate.allowed) {
      deps.log.warn('bug report refused', { outcome: 'rate_limited' });
      res.set('Retry-After', String(rate.retryAfterSeconds));
      fail(res, 429, 'rate_limited');
      return;
    }

    if (!deps.skipAppCheck) {
      const token = header(req, 'x-firebase-appcheck');
      let outcome = 'app_check_missing';
      let verified: VerifiedToken | undefined;
      if (token) {
        try {
          const result = await deps.verifyAppCheck(token);
          if (result.ok) verified = result.token;
          else outcome = result.reason === 'consumed' ? 'app_check_consumed' : 'app_check_no_id';
        } catch {
          outcome = 'app_check_invalid';
        }
      }
      if (verified) {
        let firstUse: boolean;
        try {
          firstUse = await deps.claimToken(verified);
        } catch (err) {
          // Fail closed: without the record a token could be replayed.
          deps.log.error('bug report: used-token record unavailable', { error: String(err) });
          fail(res, 503, 'unavailable');
          return;
        }
        if (!firstUse) {
          outcome = 'app_check_replayed';
          verified = undefined;
        }
      }
      if (!verified) {
        deps.log.warn('bug report refused', { outcome });
        fail(res, 401, 'app_check');
        return;
      }
    }

    const result = validateReport(req.body);
    if (!result.ok) {
      if (result.reason === 'honeypot') {
        deps.log.warn('bug report refused', { outcome: 'honeypot' });
        fail(res, 400, 'rejected');
      } else {
        fail(res, 400, 'invalid', { fields: result.fields });
      }
      return;
    }

    const cap = deps.global.take('all');
    if (!cap.allowed) {
      deps.log.warn('bug report refused', { outcome: 'global_cap' });
      res.set('Retry-After', String(cap.retryAfterSeconds));
      fail(res, 429, 'busy');
      return;
    }

    let issue: CreatedIssue;
    try {
      issue = await deps.createIssue(issueFromReport(result.report));
    } catch (err) {
      deps.log.error('bug report: GitHub refused the issue', { error: String(err) });
      fail(res, 502, 'github');
      return;
    }

    let contactSaved = false;
    if (result.report.email) {
      try {
        await deps.saveContact(result.report.email, issue);
        contactSaved = true;
      } catch (err) {
        // The issue exists; say so rather than fail. The email itself is never logged.
        deps.log.error('bug report: contact email not saved', {
          issue: issue.number,
          error: String(err),
        });
      }
    }

    deps.log.info('bug report created', { issue: issue.number, contact: contactSaved });
    res.status(201).json({ ok: true, number: issue.number, url: issue.url, contactSaved });
  };
}
