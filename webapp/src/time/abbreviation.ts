// Zone abbreviations ("CST", "IST", "AEDT"). Browsers don't expose tzdata abbreviations, so we ask
// Intl in a few English locales and keep only alphabetic answers; "GMT+9"-style answers are dropped
// because the offset is shown next to it anyway (decision D7, refined in M1-4).

/**
 * The tz database's own alphabetic abbreviations for zones no English Intl locale names, keyed by
 * UTC offset in seconds. The offset guard means a future rule change makes us omit the
 * abbreviation rather than show a wrong one. These are labels, not rules: no tzdata is bundled.
 */
const TZDB_ABBREVIATIONS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  'Asia/Tokyo': { 32400: 'JST' },
  'Asia/Seoul': { 32400: 'KST' },
  'Asia/Pyongyang': { 32400: 'KST' },
  'Asia/Shanghai': { 28800: 'CST' },
  'Asia/Taipei': { 28800: 'CST' },
  'Asia/Macau': { 28800: 'CST' },
  'Asia/Karachi': { 18000: 'PKT' },
  'Asia/Jerusalem': { 7200: 'IST', 10800: 'IDT' },
  'Europe/Moscow': { 10800: 'MSK' },
};

const ALPHABETIC = /^[A-Za-z]{2,6}$/;
const cache = new Map<string, Intl.DateTimeFormat | null>();

function shortName(locale: string, zone: string, epochMilliseconds: number): string | undefined {
  const key = `${locale}|${zone}`;
  let f = cache.get(key);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' });
    } catch {
      f = null;
    }
    cache.set(key, f);
  }
  const name = f?.formatToParts(epochMilliseconds).find((p) => p.type === 'timeZoneName')?.value;
  return name !== undefined && ALPHABETIC.test(name) ? name : undefined;
}

/**
 * Abbreviation for `zone` at an instant, or undefined if none is known.
 * Order: the city's country locale (en-IN → IST), the tzdb table, then en-US and en-GB.
 */
export function zoneAbbreviation(
  epochMilliseconds: number,
  zone: string,
  offsetSeconds: number,
  country?: string,
): string | undefined {
  if (country && /^[A-Z]{2}$/.test(country)) {
    const local = shortName(`en-${country}`, zone, epochMilliseconds);
    if (local) return local;
  }
  const tzdb = TZDB_ABBREVIATIONS[zone]?.[offsetSeconds];
  if (tzdb) return tzdb;
  return shortName('en-US', zone, epochMilliseconds) ?? shortName('en-GB', zone, epochMilliseconds);
}
