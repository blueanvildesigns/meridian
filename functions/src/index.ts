// Cloud Functions for Firebase (2nd gen) for Meridian. One function: reportBug, reached through the
// Hosting rewrite /api/report-bug (firebase.json). Decisions: docs/archive/2026-11-21-bug-reporting.md.
//
// Configuration (owner steps in docs/manual-setup-bug-reporting.md):
// - GITHUB_BUG_TOKEN (secret): fine-grained PAT, Issues: write on the one repo.
// - BUG_REPORT_REPO (param, default blueanvildesigns/meridian): where issues go.
// - BUG_REPORT_ENABLED (param, default true): off switch, applied on the next deploy.

import { initializeApp } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { contactRecord, saveContact } from './contacts.js';
import { createIssue } from './github.js';
import { createHandler } from './handler.js';
import { isAllowedOrigin } from './origins.js';
import { RateLimiter } from './rateLimit.js';
import { claimToken, readVerifiedToken } from './tokenLedger.js';

initializeApp();

const GITHUB_BUG_TOKEN = defineSecret('GITHUB_BUG_TOKEN');
const BUG_REPORT_REPO = defineString('BUG_REPORT_REPO', {
  default: 'blueanvildesigns/meridian',
  description: 'owner/name of the repository bug reports become issues in',
});
const BUG_REPORT_ENABLED = defineBoolean('BUG_REPORT_ENABLED', {
  default: true,
  description: 'Set to false to switch the bug report endpoint off (503)',
});

/** Set by the Functions emulator; never set in production. */
const EMULATOR = process.env['FUNCTIONS_EMULATOR'] === 'true';

// Kept for the life of the instance. maxInstances 1 makes them effectively global while warm.
const perAddress = new RateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });
const global = new RateLimiter({ max: 30, windowMs: 60 * 60 * 1000 });

let handler: ReturnType<typeof createHandler> | undefined;

/** Built on the first request: params and secrets can only be read at run time. */
function getHandler() {
  handler ??= createHandler({
    enabled: BUG_REPORT_ENABLED.value(),
    // consume: App Check's own replay protection. It misses reuses, so claimToken (our record in
    // Firestore) is what actually makes a token good for one report.
    verifyAppCheck: async (token) =>
      readVerifiedToken(await getAppCheck().verifyToken(token, { consume: true })),
    claimToken: (token) => claimToken(getFirestore(), token, new Date()),
    skipAppCheck: EMULATOR,
    createIssue: async (draft) => {
      const token = GITHUB_BUG_TOKEN.value();
      if (EMULATOR && token === 'dry-run') {
        logger.info('dry run: no issue created', { title: draft.title });
        return { number: 0, url: `https://github.com/${BUG_REPORT_REPO.value()}/issues/0` };
      }
      return createIssue(draft, { token, repo: BUG_REPORT_REPO.value() });
    },
    saveContact: async (email, issue) => {
      // Without the Firestore emulator the Admin SDK would write to production: refuse instead.
      if (EMULATOR && !process.env['FIRESTORE_EMULATOR_HOST']) {
        throw new Error('Firestore emulator not running; contact not saved');
      }
      await saveContact(getFirestore(), contactRecord(email, issue, new Date()));
    },
    perAddress,
    global,
    isAllowedOrigin: (origin) => isAllowedOrigin(origin, { emulator: EMULATOR }),
    log: logger,
  });
  return handler;
}

export const reportBug = onRequest(
  {
    region: 'us-central1',
    maxInstances: 1,
    concurrency: 80,
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [GITHUB_BUG_TOKEN],
    // Its own account with only what it needs (Firestore user, App Check token verifier, the one
    // secret), not the default compute account's broad roles. Owner step 4.2.
    serviceAccount: 'report-bug@meridian-web-a5829.iam.gserviceaccount.com',
    // Hosting calls the function as an anonymous user; App Check does the gatekeeping.
    invoker: 'public',
  },
  async (req, res) => {
    await getHandler()(req, res);
  },
);
