// Modal dialog (design-spec sections 3 and 6): a native <dialog> opened with showModal(), so the
// page behind is inert and Tab stays inside, Esc closes, and focus goes back to whatever opened
// it. A centred panel on desktop, a full-screen sheet on phones (decision M4-5).
//
// Mount it to open it and unmount it to close it: the parent owns whether it's showing. The
// element marked `data-autofocus` gets focus on opening; otherwise the browser picks the first.

import { useEffectEvent, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  /** ID of the element that names the dialog, usually its heading. */
  labelledBy: string;
  describedBy?: string;
  /** Esc, a click on the backdrop, or the browser closing the dialog. */
  onClose: () => void;
  /**
   * Called on close if the control that opened the dialog has gone meanwhile (adding the first
   * city replaces the empty state) or never had focus (Safari), so the parent can put focus
   * somewhere sensible.
   */
  onOpenerGone?: () => void;
  className?: string | undefined;
  children: ReactNode;
}

export function Dialog({
  labelledBy,
  describedBy,
  onClose,
  onOpenerGone,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const openerGone = useEffectEvent(() => onOpenerGone?.());

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Safari doesn't focus a button when it's clicked, leaving focus on <body>: that's no opener.
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // Browsers restore focus on close() too, but not all of them, and not when the dialog is
      // removed without closing; doing it here makes it the same everywhere.
      if (opener?.isConnected) opener.focus();
      else openerGone();
    };
  }, []);

  return (
    // The backdrop click is a pointer convenience; Esc is the keyboard way to close.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className={`${styles.dialog} ${className ?? ''}`}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Esc fires `cancel` then `close`; letting the browser close it and reporting that covers
      // browsers that skip `cancel` (Chrome does after repeated Esc presses). `close` arrives a
      // task later, so one from a close() that was followed by showModal() again (StrictMode's
      // remount in development) finds the dialog open and is ignored.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      // A click on the backdrop lands on the <dialog> itself: the panel inside covers the rest.
      // Both press and release must be there, so a text selection dragged out doesn't close it.
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div className={styles.panel}>{children}</div>
    </dialog>
  );
}
