// The amber banner shown when changes can't be saved (canvas ErrorStorage, ErrorPhone; spec 4.6).

import type { StorageNotice } from '../app/store';
import buttons from './buttons.module.css';
import { CloseIcon, WarningIcon } from './icons';
import styles from './StorageBanner.module.css';

const COPY: Record<StorageNotice, { title: string; text: string }> = {
  unavailable: {
    title: 'Can’t save in this browser',
    text:
      'Meridian still works, but your cities and settings will be lost when you close this tab. ' +
      'Private browsing or blocked site data can cause this.',
  },
  newer: {
    title: 'Meridian was updated in another tab',
    text: 'This tab is running an older version, so changes here won’t be saved.',
  },
};

export interface StorageBannerProps {
  notice: StorageNotice;
  onDismiss: () => void;
}

export function StorageBanner({ notice, onDismiss }: StorageBannerProps) {
  const { title, text } = COPY[notice];
  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.icon}>
        <WarningIcon size={20} />
      </span>
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        <span className={styles.text}>{text}</span>
        {/* "What can I do?" opens a "Your data" section in About (D19), arriving in M6. */}
        {notice === 'newer' && (
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload to update
          </button>
        )}
      </div>
      <button
        type="button"
        className={`${buttons.icon} ${styles.dismiss}`}
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <CloseIcon size={20} />
      </button>
    </div>
  );
}
