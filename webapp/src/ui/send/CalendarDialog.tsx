// Add to calendar (M9; canvas CalendarDialog, CalendarDialogPhone): a title and a duration for the
// Jump's moment, then an .ics file or a web calendar's compose page. Jump mode only (decision 9).
// A centred dialog on wide screens and a bottom sheet on phones (decision 15). Every action stays
// off until a duration is chosen; then the end time shows in the reference city's zone and in the
// person's own (decision 10). Everything is built in the browser (decision 14).

import { useEffect, useId, useRef, useState } from 'react';
import type { HourCycle } from '../../time/format';
import { T } from '../../time/temporal';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import { AlertTriangleIcon, CloseIcon, DownloadIcon, ExternalIcon } from '../icons';
import {
  DURATION_PRESETS,
  durationLabel,
  endTimeLines,
  googleCalendarUrl,
  icsFile,
  icsFileName,
  MAX_TITLE_LENGTH,
  outlookUrl,
  parseCustomMinutes,
  type CalendarEvent,
} from './calendar';
import { saveFile } from './saveFile';
import styles from './CalendarDialog.module.css';

export interface CalendarDialogProps {
  /** The Jump: its instant, reference zone and name, and link. */
  moment: Omit<CalendarEvent, 'title' | 'minutes'>;
  /** "Fri, Dec 4, 2026 · 8:00 AM in Tokyo", as the banner says it. */
  when: string;
  deviceZone: string;
  hourCycle: HourCycle;
  /** Done: the file was handed over or a web calendar opened. The text is for the toast, if any. */
  onDone: (toast: string | null) => void;
  onClose: () => void;
}

type Duration = number | 'custom' | null;

/** A UID that's unique to this event (RFC 5545 asks for one per event). */
function newUid(): string {
  const random =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  return `${random}@meridian.blueanvildesigns.io`;
}

export function CalendarDialog({
  moment,
  when,
  deviceZone,
  hourCycle,
  onDone,
  onClose,
}: CalendarDialogProps) {
  const id = useId();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState<Duration>(null);
  const [customText, setCustomText] = useState('');
  const [customLeft, setCustomLeft] = useState(false);
  /** The browser couldn't make the file (M9-8). A new object each time, so it's focused again. */
  const [failed, setFailed] = useState<object | null>(null);
  const alert = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failed) alert.current?.focus();
  }, [failed]);

  const minutes = duration === 'custom' ? parseCustomMinutes(customText) : duration;
  const event: CalendarEvent | null =
    minutes === null ? null : { ...moment, title: title.trim(), minutes };
  const customError = duration === 'custom' && customLeft && minutes === null;

  const download = () => {
    if (!event) return;
    try {
      const file = icsFile(event, { uid: newUid(), now: T().Now.instant(), cycle: hourCycle });
      saveFile(icsFileName(event), file, 'text/calendar;charset=utf-8');
    } catch {
      setFailed({});
      return;
    }
    onDone('Calendar file downloaded');
  };

  const openWeb = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onDone(null);
  };

  return (
    <Dialog
      variant="sheet"
      labelledBy={`${id}-title`}
      describedBy={`${id}-when`}
      onClose={onClose}
      className={styles.dialog}
    >
      <form
        className={styles.body}
        onSubmit={(e) => {
          // Enter in the title or minutes field downloads, the main action, once it's ready.
          e.preventDefault();
          download();
        }}
      >
        <div className={styles.header}>
          <h2 id={`${id}-title`} className={styles.title}>
            Add to calendar
          </h2>
          <button
            type="button"
            className={`${buttons.icon} ${styles.close}`}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon size={22} />
          </button>
        </div>
        <p id={`${id}-when`} className={styles.when}>
          {when}
        </p>

        <div className={styles.field}>
          <label htmlFor={`${id}-name`} className={styles.label}>
            Title
          </label>
          <input
            id={`${id}-name`}
            className={styles.input}
            type="text"
            value={title}
            placeholder="What is it?"
            maxLength={MAX_TITLE_LENGTH}
            autoComplete="off"
            aria-describedby={title.trim() ? undefined : `${id}-untitled`}
            data-autofocus
            onChange={(e) => {
              setTitle(e.currentTarget.value);
            }}
          />
          {!title.trim() && (
            <p id={`${id}-untitled`} className={styles.hint}>
              Optional. Without one, the event will be untitled.
            </p>
          )}
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Duration</legend>
          <div className={styles.chips}>
            {[...DURATION_PRESETS, 'custom' as const].map((value) => (
              <label key={value} className={styles.chip}>
                <input
                  type="radio"
                  name={`${id}-duration`}
                  value={value}
                  required
                  checked={duration === value}
                  className={styles.radio}
                  onChange={() => {
                    setDuration(value);
                  }}
                />
                {value === 'custom' ? 'Custom…' : durationLabel(value)}
              </label>
            ))}
          </div>
          {duration === 'custom' && (
            <div className={styles.field}>
              <label htmlFor={`${id}-minutes`} className={styles.label}>
                Length in minutes
              </label>
              <input
                id={`${id}-minutes`}
                className={`${styles.input} ${styles.minutes} ${customError ? styles.invalid : ''}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={customText}
                aria-invalid={customError}
                aria-describedby={customError ? `${id}-minutes-error` : undefined}
                onChange={(e) => {
                  setCustomText(e.currentTarget.value);
                }}
                onBlur={() => {
                  setCustomLeft(true);
                }}
              />
              {customError && (
                <p id={`${id}-minutes-error`} className={styles.error}>
                  Enter whole minutes from 5 to 1,440.
                </p>
              )}
            </div>
          )}
        </fieldset>

        {/* Polite, so the end time is read out as the duration changes. */}
        <div className={styles.ends} aria-live="polite">
          {event ? (
            endTimeLines(event, deviceZone, hourCycle).map((line) => <p key={line}>{line}</p>)
          ) : (
            <p className={styles.hint}>Choose a duration to add the event.</p>
          )}
        </div>

        {failed && (
          <div ref={alert} className={styles.alert} role="alert" tabIndex={-1}>
            <AlertTriangleIcon size={20} className={styles.alertIcon} />
            <p>Your browser couldn’t make the file. Try a web calendar below.</p>
          </div>
        )}

        <div className={styles.main}>
          <button
            type="submit"
            className={`${buttons.primary} ${styles.download}`}
            disabled={!event}
          >
            <DownloadIcon size={18} />
            Download .ics file
          </button>
          <p className={styles.hint}>
            Works with Outlook for desktop, Apple Calendar and most other calendar apps.
          </p>
        </div>

        <section className={styles.web} aria-labelledby={`${id}-web`}>
          <h3 id={`${id}-web`} className={styles.label}>
            Open in a web calendar
          </h3>
          <div className={styles.webButtons}>
            {(
              [
                ['Google Calendar', null, (e: CalendarEvent) => googleCalendarUrl(e, hourCycle)],
                [
                  'Outlook.com',
                  'Personal accounts',
                  (e: CalendarEvent) => outlookUrl(e, 'personal', hourCycle),
                ],
                [
                  'Microsoft 365',
                  'Work or school accounts',
                  (e: CalendarEvent) => outlookUrl(e, 'work', hourCycle),
                ],
              ] as const
            ).map(([name, note, url]) => (
              <button
                key={name}
                type="button"
                className={`${buttons.secondary} ${styles.webButton}`}
                disabled={!event}
                onClick={() => {
                  if (event) openWeb(url(event));
                }}
              >
                <span className={styles.webName}>
                  {name}
                  <ExternalIcon size={16} />
                </span>
                {note && <span className={styles.webNote}>{note}</span>}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </button>
            ))}
          </div>
        </section>

        <p className={styles.privacy}>
          The file is made in your browser and goes nowhere. Opening Google Calendar or Outlook
          sends the title and time to Google or Microsoft.
        </p>

        <div className={styles.footer}>
          <button type="button" className={buttons.secondary} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
