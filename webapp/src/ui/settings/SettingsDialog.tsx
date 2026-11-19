// Settings (spec 4.5; canvas Settings): time format and appearance, each a row of three choices.
// Changes apply at once and are saved with everything else; Done or Esc closes. A dialog on wide
// screens, a full sheet on phones (design-spec 1).
//
// The choices are native radio buttons drawn as a segmented control, so the arrow keys move
// between them and screen readers hear a radio group, as the board marks them up.

import { useId, type ReactNode } from 'react';
import type { Appearance } from '../../app/theme';
import { useMediaQuery } from '../../app/useMediaQuery';
import type { Settings } from '../../storage/schema';
import {
  browserHourCycle,
  formatClockInline,
  type HourCycle,
  type TimeFormatSetting,
} from '../../time/format';
import { T } from '../../time/temporal';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import { CloseIcon, MonitorIcon, MoonIcon, SunIcon } from '../icons';
import styles from './SettingsDialog.module.css';

export interface SettingsDialogProps {
  settings: Settings;
  /** The current time, for the example under Time format. */
  now: number;
  deviceZone: string;
  onChange: (change: Partial<Settings>) => void;
  onClose: () => void;
}

interface Choice<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

const TIME_CHOICES: Choice<TimeFormatSetting>[] = [
  { value: 'browser', label: 'Browser default' },
  { value: '12', label: '12-hour' },
  { value: '24', label: '24-hour' },
];

const LOOK_CHOICES: Choice<Appearance>[] = [
  { value: 'system', label: 'System', icon: <MonitorIcon size={18} /> },
  { value: 'light', label: 'Light', icon: <SunIcon size={18} /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon size={18} /> },
];

interface SegmentedProps<V extends string> {
  title: string;
  name: string;
  choices: Choice<V>[];
  value: V;
  hint: string;
  /** Focus starts on this group's current choice. */
  first?: boolean;
  onChange: (value: V) => void;
}

function Segmented<V extends string>({
  title,
  name,
  choices,
  value,
  hint,
  first = false,
  onChange,
}: SegmentedProps<V>) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.sectionTitle}>
        {title}
      </h3>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint`}
        className={styles.segments}
      >
        {choices.map((choice) => (
          <label key={choice.value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              className={styles.radio}
              {...(first && value === choice.value ? { 'data-autofocus': true } : {})}
              onChange={() => {
                onChange(choice.value);
              }}
            />
            {choice.icon}
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
      <p id={`${id}-hint`} className={styles.hint}>
        {hint}
      </p>
    </section>
  );
}

function timeHint(setting: TimeFormatSetting, now: number, zone: string): string {
  const { hour, minute } = T().Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone);
  const example = (cycle: HourCycle) => `Example: ${formatClockInline(hour, minute, cycle)}`;
  if (setting === 'browser') {
    return `Follows your browser’s language and region. ${example(browserHourCycle())}`;
  }
  return example(setting);
}

function lookHint(setting: Appearance, systemDark: boolean): string {
  if (setting === 'system')
    return `Matches your device. It is currently ${systemDark ? 'Dark' : 'Light'}.`;
  return `Always use the ${setting} appearance.`;
}

export function SettingsDialog({
  settings,
  now,
  deviceZone,
  onChange,
  onClose,
}: SettingsDialogProps) {
  const titleId = useId();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');

  return (
    <Dialog labelledBy={titleId} onClose={onClose} fit className={styles.dialog}>
      <div className={styles.body}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Settings
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

        <Segmented
          title="Time format"
          name="time-format"
          choices={TIME_CHOICES}
          value={settings.timeFormat}
          hint={timeHint(settings.timeFormat, now, deviceZone)}
          first
          onChange={(timeFormat) => {
            onChange({ timeFormat });
          }}
        />
        <Segmented
          title="Appearance"
          name="appearance"
          choices={LOOK_CHOICES}
          value={settings.appearance}
          hint={lookHint(settings.appearance, systemDark)}
          onChange={(appearance) => {
            onChange({ appearance });
          }}
        />

        <div className={styles.footer}>
          <p className={styles.saved}>Settings are saved in this browser.</p>
          <button type="button" className={`${buttons.primary} ${styles.done}`} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
