// Toasts at the bottom of the page (design-spec 3 and 6): "London removed · Undo" after a card is
// removed (spec 4.4; canvas CardMenuRemoved) and "Copied as text" (M8). One at a time: a new one
// replaces the one showing. Each stays for its own time (Undo 8 seconds, D15), longer while a mouse
// is over it or focus is in it, so there's time to reach its button; a tap doesn't count as
// hovering: it would never end. The region is always in the page, so screen readers announce what
// appears in it (design-spec 6: toasts use role status).

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import styles from './Toast.module.css';

/** How long the Undo toast stays (D15). */
export const UNDO_MS = 8000;
/** How long a toast with nothing to press stays: as long as Copy link's "Link copied" (M5-8). */
export const NOTICE_MS = 3000;

export interface ToastMessage {
  /** "London removed", "Copied as text". */
  text: string;
  /** A button after the text ("Undo"), if any. */
  action?: string;
}

export interface ToastProps {
  /** The toast showing, or null for none. A new object each time restarts the clock. */
  message: ToastMessage | null;
  onAction?: () => void;
  /** Time's up (for Undo, the removal stands). */
  onExpire: () => void;
  /** On phones, sit above the fixed bar of Jump and Add (gone when the list is empty). */
  aboveBar?: boolean;
}

export function Toast({ message, onAction, onExpire, aboveBar = true }: ToastProps) {
  const [held, setHeld] = useState(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  const hold = () => {
    setHeld(hovered.current || focused.current);
  };
  const hover = (e: PointerEvent, over: boolean) => {
    if (e.pointerType === 'touch') return;
    hovered.current = over;
    hold();
  };

  // Restarts for each message and while it's let go; pauses while held.
  useEffect(() => {
    if (!message || held) return;
    const timer = window.setTimeout(onExpire, message.action ? UNDO_MS : NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [message, held, onExpire]);

  return (
    <div role="status" className={`${styles.region} ${aboveBar ? styles.aboveBar : ''}`}>
      {message && (
        // Pausing on hover and focus is a convenience; nothing here needs the pointer.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          className={`${styles.toast} ${message.action ? '' : styles.plain}`}
          onPointerEnter={(e) => {
            hover(e, true);
          }}
          onPointerLeave={(e) => {
            hover(e, false);
          }}
          onFocus={() => {
            focused.current = true;
            hold();
          }}
          onBlur={() => {
            focused.current = false;
            hold();
          }}
        >
          <span>{message.text}</span>
          {message.action && (
            <button type="button" className={styles.action} onClick={onAction}>
              {message.action}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
