// Bug reports (docs/archive/2026-11-21-bug-reporting.md): the diagnostics a report carries, and
// the link to GitHub's bug report form with them filled in.
//
// Diagnostics are built only from the app's version and what the browser says about itself, plus
// the time format setting. They never include saved cities or anything else from storage: the
// only input from the app's state is `timeFormat`, so nothing else can leak in.

import { BUG_REPORT_FORM_URL } from './links';
import { resolveHourCycle, type TimeFormatSetting } from '../time/format';

/** GitHub answers 414 somewhere past 8 KB; staying far below keeps every browser and proxy happy. */
export const MAX_URL_LENGTH = 2000;
/** User agents are long and growing; the rest of the diagnostics stay short. */
export const MAX_USER_AGENT_LENGTH = 256;

/** What the browser reports, gathered in one place so tests can supply their own. */
export interface BrowserInfo {
  userAgent: string;
  /** `navigator.userAgentData.platform`, where the browser has it (Chromium). */
  platform?: string | undefined;
  locale: string;
  timeZone: string;
}

export interface Diagnostics {
  version: string;
  browser: string;
  os: string;
  timeZone: string;
  timeFormat: string;
  locale: string;
}

interface NavigatorUAData {
  platform?: string;
}

export function readBrowserInfo(): BrowserInfo {
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
  return {
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform,
    locale: nav.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Control characters (newlines included) out, runs of space collapsed, ends trimmed. */
function oneLine(text: string): string {
  return text
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts to at most `max` characters (whole code points), marking the cut with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}

/** The operating system's name only, never its version or the device model. */
export function detectOs(userAgent: string, platform?: string): string {
  const named: Record<string, string> = {
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    android: 'Android',
    'chrome os': 'ChromeOS',
    chromeos: 'ChromeOS',
    ios: 'iOS',
  };
  const fromPlatform = platform ? named[platform.toLowerCase()] : undefined;
  if (fromPlatform) return fromPlatform;
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  if (/Windows/i.test(userAgent)) return 'Windows';
  // iPadOS asks for desktop sites as a Mac, so this can also be an iPad.
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown';
}

const FORMAT_NAMES: Record<TimeFormatSetting, string> = {
  browser: 'Browser default',
  '12': '12-hour',
  '24': '24-hour',
};

export function collectDiagnostics(
  timeFormat: TimeFormatSetting,
  info: BrowserInfo = readBrowserInfo(),
): Diagnostics {
  const resolved = `${resolveHourCycle(timeFormat, info.locale)}-hour`;
  return {
    version: `${__APP_VERSION__} (${__BUILD_SHA__})`,
    browser: truncate(oneLine(info.userAgent), MAX_USER_AGENT_LENGTH) || 'Unknown',
    os: detectOs(info.userAgent, info.platform),
    timeZone: truncate(oneLine(info.timeZone), 64) || 'Unknown',
    timeFormat:
      timeFormat === 'browser' ? `${FORMAT_NAMES.browser} (${resolved})` : FORMAT_NAMES[timeFormat],
    locale: truncate(oneLine(info.locale), 35) || 'Unknown',
  };
}

/** The diagnostics as the reporter sees them, and as they're sent. */
export function diagnosticsText(d: Diagnostics): string {
  return [
    `App version: ${d.version}`,
    `Browser: ${d.browser}`,
    `OS: ${d.os}`,
    `Time zone: ${d.timeZone}`,
    `Time format: ${d.timeFormat}`,
    `Locale: ${d.locale}`,
  ].join('\n');
}

/** Fields of the GitHub form a link can fill in (its ids in `bug_report.yml`). */
export interface FormPrefill {
  summary?: string;
  'what-happened'?: string;
  steps?: string;
  diagnostics?: string;
}

/** Shortened first when a link would be too long, most expendable first. */
const SHRINK_ORDER = ['steps', 'what-happened', 'summary', 'diagnostics'] as const;

function build(fields: FormPrefill): string {
  const params = new URLSearchParams({ template: 'bug_report.yml' });
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value !== '') params.set(key, value);
  }
  return `${BUG_REPORT_FORM_URL}?${params.toString()}`;
}

/**
 * The link to GitHub's bug report form, filled in, and never longer than `maxLength`: if it would
 * be, the most expendable fields are cut down (with an ellipsis), steps first, diagnostics last.
 */
export function bugReportUrl(fields: FormPrefill, maxLength = MAX_URL_LENGTH): string {
  const current: FormPrefill = { ...fields };
  let url = build(current);
  for (const key of SHRINK_ORDER) {
    if (url.length <= maxLength) break;
    const value = current[key];
    if (!value) continue;
    // The longest prefix of this field that fits (encoding makes length non-linear: search).
    const chars = Array.from(value);
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      current[key] = truncate(value, mid);
      if (build(current).length <= maxLength) lo = mid;
      else hi = mid - 1;
    }
    // An empty field is left out of the link altogether.
    current[key] = lo === 0 ? '' : truncate(value, lo);
    url = build(current);
  }
  return url;
}
