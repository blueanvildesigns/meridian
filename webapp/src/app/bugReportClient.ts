// Sending an in-app bug report to POST /api/report-bug (a Hosting rewrite to the reportBug Cloud
// Function), and whether this build can at all. Without the Firebase settings in the build's
// environment there's no form, and "Report a bug" opens GitHub's form instead (phase 1).

import { limitedUseToken, type AppCheckConfig } from './appCheck';
import { GITHUB_REPO } from './links';

export const BUG_REPORT_ENDPOINT = '/api/report-bug';

/** Exactly what's sent: the dialog shows the diagnostics text before sending. */
export interface BugReportPayload {
  description: string;
  steps?: string;
  email?: string;
  diagnostics?: string;
  /** The honeypot field: empty unless a bot filled it in. */
  website: string;
}

export type SendResult =
  | { ok: true; number: number; url: string }
  | { ok: false; reason: 'network' | 'verification' | 'server'; message: string };

export interface BugReportService {
  send(payload: BugReportPayload, signal?: AbortSignal): Promise<SendResult>;
}

export interface ClientOptions {
  /** An App Check token for the request; absent only against the emulator. */
  getToken?: () => Promise<string>;
  fetch?: typeof fetch;
  endpoint?: string;
}

/** Texts for the server's error codes. Anything else gets the generic one. */
const MESSAGES: Record<string, string> = {
  rate_limited: 'You’ve sent several reports in a short time. Please try again later.',
  busy: 'Lots of reports are arriving right now. Please try again later.',
  app_check: 'Meridian couldn’t confirm this report came from the app.',
  disabled: 'Sending reports from the app is switched off right now.',
  invalid: 'Part of the report is missing or too long.',
  rejected: 'This report couldn’t be accepted.',
  github: 'GitHub didn’t accept the report just now.',
};
const GENERIC = 'Something went wrong sending your report.';

/** Only links to this repo's issues are shown as the result. */
const ISSUE_BASE = `https://github.com/${GITHUB_REPO}/issues/`;
const isIssueUrl = (url: string) =>
  url.startsWith(ISSUE_BASE) && /^\d+$/.test(url.slice(ISSUE_BASE.length));

export function createBugReportService(options: ClientOptions = {}): BugReportService {
  const { getToken, endpoint = BUG_REPORT_ENDPOINT } = options;
  // The global looked up at call time, so a test can replace it.
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    async send(payload, signal) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (getToken) {
        try {
          headers['X-Firebase-AppCheck'] = await getToken();
        } catch {
          return {
            ok: false,
            reason: 'verification',
            message: 'Meridian couldn’t run its spam check. Is something blocking google.com?',
          };
        }
      }
      let res: Response;
      try {
        res = await doFetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          credentials: 'omit',
          ...(signal && { signal }),
        });
      } catch {
        return { ok: false, reason: 'network', message: 'Meridian couldn’t reach its server.' };
      }
      const json = (await res.json().catch(() => null)) as {
        ok?: unknown;
        number?: unknown;
        url?: unknown;
        error?: unknown;
      } | null;
      if (
        res.ok &&
        json?.ok === true &&
        typeof json.number === 'number' &&
        typeof json.url === 'string' &&
        isIssueUrl(json.url)
      ) {
        return { ok: true, number: json.number, url: json.url };
      }
      const code = typeof json?.error === 'string' ? json.error : '';
      return {
        ok: false,
        reason: code === 'app_check' ? 'verification' : 'server',
        message: MESSAGES[code] ?? GENERIC,
      };
    },
  };
}

/** The build's settings (Vite env, see webapp/.env.example). */
export interface BugReportEnv {
  DEV?: boolean;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string;
  VITE_BUG_REPORT_EMULATOR?: string;
  VITE_APPCHECK_DEBUG?: string;
}

/**
 * The service this build can use, or null for the GitHub link instead. Needs the four Firebase
 * settings; in development, VITE_BUG_REPORT_EMULATOR=true sends without App Check (the emulator
 * doesn't check), and VITE_APPCHECK_DEBUG=true uses App Check's debug provider.
 */
export function bugReportServiceFromEnv(env: BugReportEnv): BugReportService | null {
  const dev = env.DEV === true;
  if (dev && env.VITE_BUG_REPORT_EMULATOR === 'true') return createBugReportService();
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const appId = env.VITE_FIREBASE_APP_ID;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const siteKey = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!apiKey || !appId || !projectId || !siteKey) return null;
  const full: AppCheckConfig = {
    apiKey,
    appId,
    projectId,
    siteKey,
    debug: dev && env.VITE_APPCHECK_DEBUG === 'true',
  };
  return createBugReportService({ getToken: () => limitedUseToken(full) });
}
