// Modal dialog (design-spec sections 3 and 6): a native <dialog> opened with showModal(), so the
// page behind is inert and Tab stays inside, Esc closes, and focus goes back to whatever opened
// it. A centred panel on desktop, a full-screen sheet on phones (decision M4-5).
//
// Mount it to open it and unmount it to close it: the parent owns whether it's showing. The
// element marked `data-autofocus` gets focus on opening; otherwise the browser picks the first.
//
// The "popover" variant (Jump, design-spec 3) is the same modal dialog drawn as a card below the
// control that opened it, with the page left visible, and as a bottom sheet on phones (M5-2).
// The "sheet" variant (Add to calendar, M9) is a centred panel as tall as its content on wide
// screens and the same bottom sheet on phones (CalendarDialog, CalendarDialogPhone).

import { useEffectEvent, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

/** Room between a popover and its anchor, unless the caller says (canvas JumpPicker: 18 px). */
const ANCHOR_GAP = 18;
/** A popover keeps this far from the window's edges. */
const EDGE = 16;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Puts a popover under its anchor, right edges lined up, kept inside the window; centred if the
 * anchor has gone. The CSS reads the result only on wide screens: phones get a bottom sheet.
 */
function placePopover(dialog: HTMLDialogElement, anchor: HTMLElement | null, gap: number) {
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const box = dialog.getBoundingClientRect();
  const at = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
  const left = at ? at.right - box.width : (width - box.width) / 2;
  const top = at ? at.bottom + gap : (height - box.height) / 2;
  dialog.style.setProperty('--popover-left', `${clamp(left, EDGE, width - EDGE - box.width)}px`);
  dialog.style.setProperty(
    '--popover-top',
    `${Math.max(EDGE, Math.min(top, height - EDGE - box.height))}px`,
  );
}

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
  /**
   * "panel" (centred, fixed size), "popover" (under `anchor`; a bottom sheet on phones) or "sheet"
   * (centred and as tall as its content; a bottom sheet on phones).
   */
  variant?: 'panel' | 'popover' | 'sheet';
  /** The control a popover hangs from. */
  anchor?: HTMLElement | null;
  /** Room between a popover and its anchor (18 px; the card menu hangs straight off its button). */
  gap?: number;
  /** A panel as tall as its content (Settings, About), not add-city's fixed height. */
  fit?: boolean;
  className?: string | undefined;
  children: ReactNode;
}

export function Dialog({
  labelledBy,
  describedBy,
  onClose,
  onOpenerGone,
  variant = 'panel',
  anchor = null,
  gap = ANCHOR_GAP,
  fit = false,
  className,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const openerGone = useEffectEvent(() => onOpenerGone?.());

  // Placed before the first paint, and again whenever its size (an alert appearing) or the
  // window's changes. The page behind can't scroll, so the anchor only moves on a resize.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (variant !== 'popover' || !dialog) return;
    const place = () => {
      placePopover(dialog, anchor, gap);
    };
    place();
    // Every supported browser has ResizeObserver; the unit tests' DOM doesn't.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    observer?.observe(dialog);
    window.addEventListener('resize', place);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [variant, anchor, gap]);

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
      className={`${styles.dialog} ${variant === 'panel' ? '' : (styles[variant] ?? '')} ${fit || variant === 'sheet' ? styles.fit : ''} ${className ?? ''}`}
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
