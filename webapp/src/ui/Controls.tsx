// The row under the header: LIVE status, Jump to a time, Copy as text and Add city (canvas Main,
// SendLive, EmptyList), or, while a Jump is showing, the Jump banner and Add city (JumpActive).
// On phones with clocks, the buttons become a bar fixed to the bottom of the screen (Mobile), where
// Copy as text shows only its icon (M8-6); with an empty list they stay at the top, side by side
// (EmptyListPhone), and there's nothing to copy.

import { useEffect, useRef } from 'react';
import buttons from './buttons.module.css';
import { ClockIcon, CopyTextIcon, PlusIcon } from './icons';
import { JumpBanner, type JumpBannerProps } from './jump/JumpBanner';
import styles from './Controls.module.css';

export interface ControlsProps {
  empty: boolean;
  /** The Jump being shown, or undefined in live mode. */
  jump?: JumpBannerProps | undefined;
  onJump?: (anchor: HTMLElement) => void;
  onAddCity?: () => void;
  /** Copy as text in live mode (M8); the banner has its own button during a Jump. */
  onCopyText?: () => void;
  /**
   * The text to copy by hand, when the browser refused the clipboard (a new object each time, so a
   * second refusal focuses it again); null otherwise.
   */
  copyFallback?: { text: string } | null;
  /** Focus Jump to a time (a new object each time), e.g. after Reset to live. */
  focusJump?: object | null;
}

export function Controls({
  empty,
  jump,
  onJump,
  onAddCity,
  onCopyText,
  copyFallback = null,
  focusJump = null,
}: ControlsProps) {
  const jumpButton = useRef<HTMLButtonElement>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusJump) jumpButton.current?.focus();
  }, [focusJump]);
  // Focused and selected, ready for Ctrl+C or the phone's Copy (onFocus selects it), as Copy
  // link's own fallback does (M5-8).
  useEffect(() => {
    if (copyFallback) fallback.current?.focus();
  }, [copyFallback]);

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
        {!jump && !empty && (
          // Beside Jump to a time (decision 8). A secondary button, so Jump stays the main action.
          <button
            type="button"
            className={`${buttons.secondary} ${styles.copyText}`}
            onClick={onCopyText}
          >
            <CopyTextIcon size={18} />
            <span className={styles.copyWords}>Copy as text</span>
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
      {copyFallback && (
        <label className={styles.fallback}>
          <span>Your browser didn’t allow copying. Copy this text:</span>
          <textarea
            ref={fallback}
            className={styles.fallbackText}
            readOnly
            rows={Math.min(copyFallback.text.split('\n').length, 8)}
            value={copyFallback.text}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
          />
        </label>
      )}
    </section>
  );
}
