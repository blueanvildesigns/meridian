// Size limits for a bug report. The web app's dialog (webapp/src/app/bugReportLimits.ts) holds the
// same numbers so its fields stop where the server would refuse; keep the two in step.

/** Largest request body accepted, in bytes, before it's even parsed. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Character limits (code points, after sanitizing). */
export const LIMITS = {
  description: 2000,
  steps: 2000,
  email: 254,
  diagnostics: 1000,
} as const;

/** Issue titles are cut to this many characters. */
export const MAX_TITLE = 80;
