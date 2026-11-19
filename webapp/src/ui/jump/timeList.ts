// The Jump picker's time list (M5-3, option D): every half hour of the day in the app's own format,
// narrowed as you type. Typing stays the fast path and any minute still works ("8:15 PM"); the
// list is there to pick from, and to show what can be typed.

import { formatClockInline, type HourCycle } from '../../time/format';
import { parseTimeText, type HourMinute } from '../../time/timeText';

export interface TimeOption extends HourMinute {
  /** "8:30 PM" or "20:30", which is also what picking it puts in the field. */
  label: string;
}

const STEP = 30;

export function timeOptions(cycle: HourCycle): TimeOption[] {
  return Array.from({ length: (24 * 60) / STEP }, (_, i) => {
    const hour = Math.floor((i * STEP) / 60);
    const minute = (i * STEP) % 60;
    return { hour, minute, label: formatClockInline(hour, minute, cycle) };
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "8:30 p.m." → digits "830", letters "pm"; null if it isn't shaped like a time being typed. */
function squash(query: string): { digits: string; letters: string } | null {
  const compact = query
    .toLowerCase()
    .replace(/[\s:.]+/g, '')
    .replace(/(\d)h(?=\d|$)/, '$1');
  const match = /^(\d*)([a-z]*)$/.exec(compact);
  if (!match) return null;
  const [, digits = '', letters = ''] = match;
  if (letters !== '' && !'am'.startsWith(letters) && !'pm'.startsWith(letters)) return null;
  return { digits, letters };
}

/**
 * The times that start with what's typed, read the way parseTimeText reads it: "8" gives 8:00 and
 * 8:30 (and 8 PM on the 12-hour clock), "8p" the PM ones, "20" 8 PM in either format, "0" the
 * small hours. Nothing typed gives every time.
 */
export function matchingTimes(query: string, cycle: HourCycle): TimeOption[] {
  const all = timeOptions(cycle);
  const typed = squash(query);
  if (!typed) return [];
  const { digits, letters } = typed;
  return all.filter(({ hour, minute }) => {
    const twelve = `${String(hour % 12 || 12)}${pad2(minute)}`;
    if (letters !== '') {
      return twelve.startsWith(digits) && (hour < 12 ? 'am' : 'pm').startsWith(letters);
    }
    const forms = [`${String(hour)}${pad2(minute)}`, `${pad2(hour)}${pad2(minute)}`];
    if (cycle === '12') forms.push(twelve);
    return forms.some((form) => form.startsWith(digits));
  });
}

/**
 * Which time the list should start on. The one typed, if it's there ("12" lands on noon, as
 * Apply would read it); otherwise the first match while filtering, or the half hour before the
 * time in the field when the whole list is showing (3:43 AM opens on 3:30 AM). -1 if empty.
 */
export function startingIndex(
  options: readonly TimeOption[],
  text: string,
  filtering: boolean,
): number {
  if (options.length === 0) return -1;
  const time = parseTimeText(text);
  if (!time) return 0;
  const exact = options.findIndex((o) => o.hour === time.hour && o.minute === time.minute);
  if (exact >= 0 || filtering) return Math.max(exact, 0);
  const minutes = time.hour * 60 + time.minute;
  const before = options.findLastIndex((o) => o.hour * 60 + o.minute <= minutes);
  return Math.max(before, 0);
}

/** Whether the time in the field is this option, so Enter on it applies rather than just picks. */
export function isTyped(option: HourMinute, text: string): boolean {
  const time = parseTimeText(text);
  return time !== null && time.hour === option.hour && time.minute === option.minute;
}
