// The Jump banner (spec 4.3; canvas JumpActive): the moment the paused clocks show, with Copy
// link, Change and Reset to live. It takes the LIVE status's place while a Jump is showing.

import { useEffect, useId, useRef, useState } from 'react';
import buttons from '../buttons.module.css';
import { CheckIcon, ClockIcon, LinkIcon, ResetIcon } from '../icons';
import styles from './JumpBanner.module.css';

/** How long "Link copied" stays on the button. */
const COPIED_MS = 3000;

export interface JumpBannerProps {
  /** "Fri, Dec 4, 2026 · 8:00 AM in Tokyo" */
  when: string;
  /** The address that reproduces this Jump. */
  link: string;
  onChange: (anchor: HTMLElement) => void;
  onReset: () => void;
  /** Focus the banner's text (a new object each time), e.g. once Apply has replaced Jump with it. */
  focusRequest: object | null;
}

export function JumpBanner({ when, link, onChange, onReset, focusRequest }: JumpBannerProps) {
  const id = useId();
  const text = useRef<HTMLDivElement>(null);
  const manualInput = useRef<HTMLInputElement>(null);
  /** idle; copied (for a few seconds); or manual, when the browser refused and the link is shown. */
  const [copy, setCopy] = useState<'idle' | 'copied' | 'manual'>('idle');

  useEffect(() => {
    if (focusRequest) text.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    // Focused and selected, ready for Ctrl+C or the phone's Copy (onFocus selects it).
    if (copy === 'manual') manualInput.current?.focus();
    if (copy !== 'copied') return;
    const timer = setTimeout(() => {
      setCopy('idle');
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copy]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopy('copied');
    } catch {
      // No clipboard access (an older browser, or permission refused): show the link to copy.
      setCopy('manual');
    }
  };

  return (
    <div className={styles.banner}>
      <ClockIcon size={24} className={styles.icon} />
      {/* A status, so a changed Jump is announced; focused after Apply, so it's read first. */}
      <div
        ref={text}
        className={styles.text}
        role="status"
        tabIndex={-1}
        aria-labelledby={`${id}-label ${id}-when ${id}-note`}
      >
        <span id={`${id}-label`} className={styles.label}>
          Jumped
        </span>
        <span id={`${id}-when`} className={styles.when}>
          {when}
        </span>
        <span id={`${id}-note`} className={styles.note}>
          Clocks are paused. Day labels compare with My Local Time.
        </span>
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            void copyLink();
          }}
        >
          {copy === 'copied' ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
          {copy === 'copied' ? 'Link copied' : 'Copy link'}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={(e) => {
            onChange(e.currentTarget);
          }}
        >
          Change
        </button>
        <button type="button" className={`${buttons.primary} ${styles.reset}`} onClick={onReset}>
          <ResetIcon size={18} />
          Reset to live
        </button>
      </div>
      {copy === 'manual' && (
        <label className={styles.manual}>
          <span>Your browser didn’t allow copying. Copy this link:</span>
          <input
            ref={manualInput}
            className={styles.manualInput}
            type="text"
            readOnly
            value={link}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
          />
        </label>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copy === 'copied' ? 'Link copied.' : ''}
      </span>
    </div>
  );
}
