// Firebase App Check for the bug report endpoint (docs/archive/2026-11-21-bug-reporting.md).
//
// Privacy: nothing here runs until the reporter presses Send. Only then are the Firebase SDK and
// Google's reCAPTCHA Enterprise script loaded (a separate chunk, never part of the first visit),
// and a single limited-use token fetched. Automatic token refresh is off, so nothing keeps
// talking to Google afterwards.

import type { AppCheck } from 'firebase/app-check';

export interface AppCheckConfig {
  apiKey: string;
  appId: string;
  projectId: string;
  /** reCAPTCHA Enterprise site key (score-based, web). */
  siteKey: string;
  /** Development only: use App Check's debug provider (token printed in the console). */
  debug?: boolean;
}

type Sdk = typeof import('./appCheckSdk');

let pending: Promise<{ sdk: Sdk; appCheck: AppCheck }> | null = null;

async function start(config: AppCheckConfig) {
  const sdk = await import('./appCheckSdk');
  if (config.debug) {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const app = sdk.initializeApp(
    { apiKey: config.apiKey, appId: config.appId, projectId: config.projectId },
    'meridian-bug-report',
  );
  const appCheck = sdk.initializeAppCheck(app, {
    provider: new sdk.ReCaptchaEnterpriseProvider(config.siteKey),
    isTokenAutoRefreshEnabled: false,
  });
  return { sdk, appCheck };
}

/** A limited-use token, which the server consumes: good for one report. */
export async function limitedUseToken(config: AppCheckConfig): Promise<string> {
  pending ??= start(config);
  try {
    const { sdk, appCheck } = await pending;
    return (await sdk.getLimitedUseToken(appCheck)).token;
  } catch (error) {
    // A failed script load shouldn't stick: let the next Send try again from scratch.
    pending = null;
    throw error;
  }
}
