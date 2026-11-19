// The Jump picker (spec 4.3; canvas JumpPicker, JumpPickerGap, JumpPickerOverlap, JumpPhone): a
// city, a date and a time, the UTC equivalent, then Apply. A skipped time explains itself and
// offers the first real time after it, with Apply off until it's fixed; a repeated time asks which
// one, the first preselected. A popover under the button on wide screens, a bottom sheet on phones.

import { useId, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import type { StoredCity } from '../../storage/schema';
import { formatClockInline, type HourCycle } from '../../time/format';
import type { JumpState } from '../../time/jumpUrl';
import { T } from '../../time/temporal';
import { parseTimeText } from '../../time/timeText';
import { resolveWallTime } from '../../time/wallTime';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import { AlertTriangleIcon, ChevronDownIcon, ClockIcon, CloseIcon } from '../icons';
import {
  gapText,
  initialReferenceKey,
  overlapText,
  parseDateInput,
  referenceOptions,
  utcLine,
  wallFields,
  type ReferenceOption,
} from './jumpView';
import styles from './JumpPicker.module.css';

export interface JumpPickerProps {
  cities: readonly StoredCity[];
  deviceZone: string;
  hourCycle: HourCycle;
  /** The live time, which the fields start from when nothing is jumped yet. */
  now: number;
  /** The Jump being changed, if any. */
  jump: JumpState | null;
  /** Its reference card, if it's in the list. */
  refId: string | null;
  /** "Jump from here" on a card (card menu, M6). */
  fromCardId?: string | undefined;
  /** The button that opened it, which the popover hangs from. */
  anchor: HTMLElement | null;
  onApply: (state: JumpState, cityId: string | null) => void;
  onClose: () => void;
}

type Occurrence = 'earlier' | 'later';

interface Fields {
  date: string;
  time: string;
  /** False until the date or time is edited: until then they show the starting moment. */
  edited: boolean;
}

/** Which occurrence of a repeated wall time `instant` is, so Change reopens on the same one. */
function occurrenceOf(instant: Temporal.Instant, fields: Fields, zone: string): Occurrence {
  const date = parseDateInput(fields.date);
  const time = parseTimeText(fields.time);
  if (!date.ok || !time) return 'earlier';
  const result = resolveWallTime(date.date, T().PlainTime.from(time), zone);
  return result.kind === 'overlap' && T().Instant.compare(instant, result.later) >= 0
    ? 'later'
    : 'earlier';
}

export function JumpPicker({
  cities,
  deviceZone,
  hourCycle,
  now,
  jump,
  refId,
  fromCardId,
  anchor,
  onApply,
  onClose,
}: JumpPickerProps) {
  const id = useId();
  const ids = {
    title: `${id}-title`,
    lede: `${id}-lede`,
    city: `${id}-city`,
    date: `${id}-date`,
    dateError: `${id}-date-error`,
    time: `${id}-time`,
    timeError: `${id}-time-error`,
    gap: `${id}-gap`,
  };
  const timeInput = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () => referenceOptions(cities, deviceZone, jump, refId),
    [cities, deviceZone, jump, refId],
  );
  const byKey = (key: string): ReferenceOption =>
    options.find((o) => o.key === key) ?? (options[0] as ReferenceOption);

  // The moment the untouched fields describe: the Jump being changed, or now. Changing the city
  // before editing shows that same moment there.
  const [start] = useState(() => jump?.instant ?? T().Instant.fromEpochMilliseconds(now));
  const [refKey, setRefKey] = useState(() =>
    initialReferenceKey(cities, deviceZone, jump, refId, fromCardId),
  );
  const option = byKey(refKey);
  const [fields, setFields] = useState<Fields>(() => ({
    ...wallFields(start, option.zone, hourCycle),
    edited: false,
  }));
  const [occurrence, setOccurrence] = useState<Occurrence>(() =>
    occurrenceOf(start, fields, option.zone),
  );
  const [touched, setTouched] = useState({ date: false, time: false });

  const date = parseDateInput(fields.date);
  const typed = parseTimeText(fields.time);
  const result =
    date.ok && typed ? resolveWallTime(date.date, T().PlainTime.from(typed), option.zone) : null;
  const instant =
    result?.kind === 'exact'
      ? result.instant
      : result?.kind === 'overlap'
        ? result[occurrence]
        : null;
  const gap =
    result?.kind === 'gap' && date.ok && typed ? { result, typed, date: date.date } : null;
  const overlap =
    result?.kind === 'overlap' && date.ok && typed
      ? overlapText(result, typed, date.date, option, hourCycle)
      : null;

  const dateError =
    touched.date && !date.ok
      ? date.error === 'range'
        ? 'Pick a date between 1900 and 2200.'
        : 'Enter a date.'
      : null;
  const timeError =
    touched.time && !typed
      ? `Enter a time like ${hourCycle === '12' ? '8:00 AM' : '20:00'}.`
      : null;

  const edit = (change: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...change, edited: true }));
    setOccurrence('earlier');
  };

  const chooseCity = (key: string) => {
    setRefKey(key);
    if (fields.edited) {
      setOccurrence('earlier');
      return;
    }
    const zone = byKey(key).zone;
    const next = { ...wallFields(start, zone, hourCycle), edited: false };
    setFields(next);
    setOccurrence(occurrenceOf(start, next, zone));
  };

  const takeSuggestion = () => {
    if (!gap) return;
    edit(wallFields(gap.result.suggestion, option.zone, hourCycle));
    // The button goes away once the time is fixed; keep focus where the fix landed.
    timeInput.current?.focus();
  };

  const apply = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!instant) {
      setTouched({ date: true, time: true });
      return;
    }
    onApply(
      {
        instant,
        refZone: option.zone,
        ...(option.linkName === undefined ? {} : { refName: option.linkName }),
      },
      option.cityId ?? null,
    );
  };

  const gapCopy = gap && gapText(gap.result, gap.typed, gap.date, option.place, hourCycle);
  const timeDescription = [timeError && ids.timeError, gap && ids.gap].filter(Boolean).join(' ');

  return (
    <Dialog
      variant="popover"
      anchor={anchor}
      labelledBy={ids.title}
      describedBy={ids.lede}
      onClose={onClose}
      className={styles.dialog}
    >
      {/* Enter in a field applies. Nothing is ever submitted to a server (form-action 'none'). */}
      <form className={styles.form} onSubmit={apply} noValidate>
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={ids.title} className={styles.title}>
              Jump to a time
            </h2>
            <p id={ids.lede} className={styles.lede}>
              See that date and time in every city.
            </p>
          </div>
          <button
            type="button"
            className={`${buttons.icon} ${styles.close}`}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className={styles.field}>
          <label htmlFor={ids.city} className={styles.label}>
            Time is in
          </label>
          <div className={styles.selectBox}>
            <select
              id={ids.city}
              data-autofocus
              className={styles.select}
              value={refKey}
              onChange={(e) => {
                chooseCity(e.target.value);
              }}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={18} className={styles.chevron} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={`${styles.field} ${styles.dateField}`}>
            <label htmlFor={ids.date} className={styles.label}>
              Date
            </label>
            {/* The browser's own date control (D16), with its own calendar button. */}
            <input
              id={ids.date}
              type="date"
              className={`${styles.box} ${styles.dateInput} ${dateError ? styles.invalid : ''}`}
              min="1900-01-01"
              max="2200-12-31"
              required
              value={fields.date}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? ids.dateError : undefined}
              onChange={(e) => {
                edit({ date: e.target.value });
              }}
              onBlur={() => {
                setTouched((t) => ({ ...t, date: true }));
              }}
            />
            {dateError && (
              <p id={ids.dateError} className={styles.error}>
                {dateError}
              </p>
            )}
          </div>

          <div className={`${styles.field} ${styles.timeField}`}>
            <label htmlFor={ids.time} className={styles.label}>
              Time
            </label>
            <div className={`${styles.box} ${timeError || gap ? styles.invalid : ''}`}>
              <ClockIcon size={18} className={styles.boxIcon} />
              <input
                ref={timeInput}
                id={ids.time}
                type="text"
                className={styles.input}
                required
                value={fields.time}
                aria-invalid={timeError || gap ? true : undefined}
                aria-describedby={timeDescription || undefined}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                onKeyDown={(e) => {
                  // Apply is off while the time can't be read; say why instead of doing nothing.
                  if (e.key === 'Enter') setTouched((t) => ({ ...t, time: true }));
                }}
                onChange={(e) => {
                  edit({ time: e.target.value });
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, time: true }));
                  // Tidy what was typed into the app's own format: "8pm" → "8:00 PM".
                  if (typed) {
                    const tidy = formatClockInline(typed.hour, typed.minute, hourCycle);
                    if (tidy !== fields.time) setFields((f) => ({ ...f, time: tidy }));
                  }
                }}
              />
            </div>
            {timeError && (
              <p id={ids.timeError} className={styles.error}>
                {timeError}
              </p>
            )}
          </div>
        </div>

        {gapCopy && (
          <div role="alert" id={ids.gap} className={styles.gap}>
            <p className={styles.gapText}>
              <AlertTriangleIcon size={20} className={styles.gapIcon} />
              <span>
                <strong>{gapCopy.time} doesn’t exist</strong>
                {gapCopy.rest}
              </span>
            </p>
            <button type="button" className={styles.gapFix} onClick={takeSuggestion}>
              {gapCopy.fix}
            </button>
          </div>
        )}

        {overlap && (
          <fieldset className={styles.overlap}>
            <legend className={styles.legend}>{overlap.legend}</legend>
            <p className={styles.overlapText}>{overlap.text}</p>
            {overlap.choices.map((choice) => (
              <label key={choice.value} className={styles.choice}>
                <input
                  type="radio"
                  name="occurrence"
                  className={styles.radio}
                  value={choice.value}
                  checked={occurrence === choice.value}
                  onChange={() => {
                    setOccurrence(choice.value);
                  }}
                />
                <span>
                  <strong>{choice.time}</strong>{' '}
                  <span className={styles.choiceDetail}>{choice.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {instant && <p className={styles.utc}>{utcLine(instant, hourCycle)}</p>}

        <div className={styles.buttons}>
          <button
            type="button"
            className={`${buttons.secondary} ${styles.cancel}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${buttons.primary} ${styles.apply}`}
            disabled={instant === null}
          >
            Apply
          </button>
        </div>
      </form>
    </Dialog>
  );
}
