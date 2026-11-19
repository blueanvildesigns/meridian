// The row under the header: LIVE status, Jump to a time and Add city (canvas Main, EmptyList).
// On phones with clocks, the two buttons become a bar fixed to the bottom of the screen (Mobile);
// with an empty list they stay at the top, side by side (EmptyListPhone).

import buttons from './buttons.module.css';
import { ClockIcon, PlusIcon } from './icons';
import styles from './Controls.module.css';

export interface ControlsProps {
  empty: boolean;
  onJump?: () => void;
  onAddCity?: () => void;
}

export function Controls({ empty, onJump, onAddCity }: ControlsProps) {
  return (
    <section
      className={`${styles.controls} ${empty ? styles.empty : styles.hasClocks}`}
      aria-label="Controls"
    >
      <p className={styles.status}>
        <svg className={styles.dot} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r="5" fill="currentColor" />
        </svg>
        <span className={styles.live}>Live</span>
        <span className={styles.statusText}>Showing the current time</span>
      </p>
      <div className={styles.actions}>
        {/* Jump arrives in M5; it needs at least one city (spec 4.6). */}
        <button
          type="button"
          className={`${buttons.primary} ${styles.jump}`}
          disabled={empty}
          onClick={onJump}
        >
          <ClockIcon size={18} />
          Jump to a time
        </button>
        <button type="button" className={`${buttons.secondary} ${styles.add}`} onClick={onAddCity}>
          <PlusIcon size={18} />
          {/* One flex item, so the button's gap doesn't land between the words. */}
          <span>
            Add<span className={styles.addWord}> city</span>
          </span>
        </button>
      </div>
    </section>
  );
}
