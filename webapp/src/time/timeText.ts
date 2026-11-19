// Typing a time into the Jump picker (D16, M5-3): its own field with a list of times, because
// native time inputs ignore the app's 12/24-hour setting. It's lenient about what people type
// ("8am", "8:30 pm", "20:00", "0830") and the picker rewrites it in the app's format when the
// field loses focus.

export interface HourMinute {
  hour: number;
  minute: number;
}

// Hours, then optional minutes (":30", ".30", "h30" or just "30"), then an optional AM/PM.
const PATTERN = /^(\d{1,2})(?:[:.h]?(\d{2}))?(a|am|p|pm)?$/;

/**
 * "8:30 AM" → 8:30, "8pm" → 20:00, "20:00" → 20:00, "0830" → 8:30. Without AM or PM the hour is
 * read on the 24-hour clock, so "8" is 8 in the morning in either format. Returns null for
 * anything that isn't a time.
 */
export function parseTimeText(text: string): HourMinute | null {
  const compact = text
    .toLowerCase()
    .replace(/[\s.]+(?=[ap])|\s+/g, '')
    .replace(/\.m\.?$/, 'm');
  const match = PATTERN.exec(compact);
  if (!match) return null;
  const [, h = '', m = '00', suffix] = match;
  let hour = Number(h);
  const minute = Number(m);
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix.startsWith('p') ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}
