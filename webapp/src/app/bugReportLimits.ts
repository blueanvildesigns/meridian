// Character limits for the in-app bug report. The server (functions/src/limits.ts) holds the same
// numbers and refuses anything longer; keep the two in step.
export const REPORT_LIMITS = {
  description: 2000,
  steps: 2000,
  email: 254,
  diagnostics: 1000,
} as const;
