// The row under the header: LIVE status, Jump to a time and Add city (canvas Main, EmptyList), or,
// while a Jump is showing, the Jump banner and Add city (JumpActive).
// On phones with clocks, the buttons become a bar fixed to the bottom of the screen (Mobile);
// with an empty list they stay at the top, side by side (EmptyListPhone).

import { useEffect, useRef } from 'react';
import buttons from './buttons.module.css';
import { ClockIcon, PlusIcon } from './icons';
import { JumpBanner, type JumpBannerProps } from './jump/JumpBanner';
import styles from './Controls.module.css';

export interface ControlsProps {
  empty: boolean;
  /** The Jump being shown, or undefined in live mode. */
  jump?: JumpBannerProps | undefined;
  onJump?: (anchor: HTMLElement) => void;
  onAddCity?: () => void;
  /** Focus Jump to a time (a new object each time), e.g. after Reset to live. */
  focusJump?: object | null;
}

export function Controls({ empty, jump, onJump, onAddCity, focusJump = null }: ControlsProps) {
  const jumpButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusJump) jumpButton.current?.focus();
  }, [focusJump]);

  return (
    <section
      className={`${styles.controls} ${empty ? styles.empty : styles.hasClocks} ${jump ? styles.jumping : ''}`}
      aria-label="Controls"
    >
      {jump ? (
        <JumpBanner {...jump} />
      ) : (
        <p className={styles.status}>
          <svg className={styles.dot} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="5" fill="currentColor" />
          </svg>
          <span className={styles.live}>Live</span>
          <span className={styles.statusText}>Showing the current time</span>
        </p>
      )}
      <div className={styles.actions}>
        {!jump && (
          // Jump needs at least one city (spec 4.6).
          <button
            ref={jumpButton}
            type="button"
            className={`${buttons.primary} ${styles.jump}`}
            disabled={empty}
            onClick={(e) => {
              onJump?.(e.currentTarget);
            }}
          >
            <ClockIcon size={18} />
            Jump to a time
          </button>
        )}
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
