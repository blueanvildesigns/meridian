// Text formats from the design canvas (boards Main, JumpActive, JumpPicker). English-only UI, so
// month and weekday names are fixed here instead of depending on each engine's Intl output.

const MINUS = '−'; // canvas uses a real minus sign: "UTC−6:00"
const pad2 = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const; // Temporal: 1 = Monday
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export type HourCycle = '12' | '24';
export type TimeFormatSetting = 'browser' | '12' | '24';

/** "UTC+5:30", "UTC−6:00", "UTC+0:00". Offsets are rounded to the minute. */
export function formatOffset(offsetNanoseconds: number): string {
  const minutes = Math.round(offsetNanoseconds / 60e9);
  const sign = minutes < 0 ? MINUS : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${Math.floor(abs / 60)}:${pad2(abs % 60)}`;
}

/** Difference from the user's own time: "Same time", "+1h", "+11h 30m", "−2h 30m", "+45m". */
export function formatDifference(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return 'Same time';
  const sign = rounded < 0 ? MINUS : '+';
  const abs = Math.abs(rounded);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts = [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : ''].filter(Boolean);
  return sign + parts.join(' ');
}

export interface ClockText {
  /** "5:00" (12-hour) or "17:00" (24-hour). */
  time: string;
  /** "AM" / "PM", or "" in 24-hour format. */
  dayPeriod: string;
}

export function formatClock(hour: number, minute: number, cycle: HourCycle): ClockText {
  if (cycle === '24') return { time: `${pad2(hour)}:${pad2(minute)}`, dayPeriod: '' };
  return { time: `${hour % 12 || 12}:${pad2(minute)}`, dayPeriod: hour < 12 ? 'AM' : 'PM' };
}

/** "8:00 AM" or "08:00": one string, for banners and dialogs. */
export function formatClockInline(hour: number, minute: number, cycle: HourCycle): string {
  const { time, dayPeriod } = formatClock(hour, minute, cycle);
  return dayPeriod ? `${time} ${dayPeriod}` : time;
}

/** The browser locale's preference: 12-hour (h11/h12) or 24-hour (h23/h24). */
export function browserHourCycle(locale?: string): HourCycle {
  try {
    const hc = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return hc === 'h11' || hc === 'h12' ? '12' : '24';
  } catch {
    return '12';
  }
}

export function resolveHourCycle(setting: TimeFormatSetting, locale?: string): HourCycle {
  return setting === 'browser' ? browserHourCycle(locale) : setting;
}

export interface DateFields {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
}

/** "Tue, Nov 17", or with the year "Fri, Dec 4, 2026". */
export function formatDate(date: DateFields, options: { withYear?: boolean } = {}): string {
  const base = `${WEEKDAYS[date.dayOfWeek - 1] ?? ''}, ${MONTHS[date.month - 1] ?? ''} ${date.day}`;
  return options.withYear ? `${base}, ${date.year}` : base;
}

/** "Mar 14, 2027" (no weekday), as in the Jump picker's skipped-time message. */
export function formatShortDate(date: Omit<DateFields, 'dayOfWeek'>): string {
  return `${MONTHS[date.month - 1] ?? ''} ${date.day}, ${date.year}`;
}
