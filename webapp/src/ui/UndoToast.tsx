// "London removed · Undo" after a card is removed (spec 4.4; canvas CardMenuRemoved). It stays
// 8 seconds (D15), longer while a mouse is over it or focus is in it, so there's time to reach
// Undo; a new removal replaces it. A tap doesn't count as hovering: it would never end. The region is always in the page, so screen readers announce
// what appears in it (design-spec 6: toasts use role status).

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import styles from './UndoToast.module.css';

/** How long the toast stays (D15). */
export const UNDO_MS = 8000;

export interface UndoToastProps {
  /** "London removed", or null for no toast. A new object each time restarts the clock. */
  message: { text: string } | null;
  onUndo: () => void;
  /** Time's up: the removal stands. */
  onExpire: () => void;
  /** On phones, sit above the fixed bar of Jump and Add (gone when the list is empty). */
  aboveBar?: boolean;
}

export function UndoToast({ message, onUndo, onExpire, aboveBar = true }: UndoToastProps) {
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
    const timer = window.setTimeout(onExpire, UNDO_MS);
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
          className={styles.toast}
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
          <button type="button" className={styles.undo} onClick={onUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
