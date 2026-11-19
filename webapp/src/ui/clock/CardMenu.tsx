// A card's More options menu (spec 4.4; canvas CardMenu, CardMenuPhone): Jump from here, Rename,
// Move up, Move down, Remove. A popover hanging from the card's button on wide screens and a
// bottom sheet on phones: the same modal dialog as the Jump picker (M5-2), holding a WAI-ARIA
// menu. Up and Down move between items (wrapping), Home and End go to the ends, Esc or Tab
// closes it, and focus goes back to the button.

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Dialog } from '../dialog/Dialog';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  MoonIcon,
  PencilIcon,
  SunIcon,
  TrashIcon,
} from '../icons';
import type { ClockView } from './cardView';
import styles from './CardMenu.module.css';

export interface CardMenuProps {
  view: ClockView;
  /** The card's More options button. */
  anchor: HTMLElement | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onJump: () => void;
  onRename: () => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  onClose: () => void;
  /** The card went while the menu was open (Remove), so focus can't go back to its button. */
  onOpenerGone?: () => void;
}

interface ItemProps {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  first?: boolean;
  onSelect: () => void;
}

function Item({ icon, label, disabled = false, danger = false, first, onSelect }: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={`${styles.item} ${danger ? styles.danger : ''}`}
      // Still reachable with the arrow keys, as the APG pattern has it, but does nothing.
      aria-disabled={disabled || undefined}
      {...(first ? { 'data-autofocus': true } : {})}
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function CardMenu({
  view,
  anchor,
  canMoveUp,
  canMoveDown,
  onJump,
  onRename,
  onMove,
  onRemove,
  onClose,
  onOpenerGone,
}: CardMenuProps) {
  const titleId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const time = view.dayPeriod ? `${view.time} ${view.dayPeriod}` : view.time;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      items.at(i % items.length)?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
    else if (e.key === 'Tab') {
      // A menu isn't a Tab stop: Tab leaves it, back to the button.
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Dialog
      variant="popover"
      anchor={anchor}
      gap={0}
      labelledBy={titleId}
      onClose={onClose}
      {...(onOpenerGone ? { onOpenerGone } : {})}
      className={styles.dialog}
    >
      <div className={styles.body}>
        <div className={styles.grabber} aria-hidden="true" />
        <h2 id={titleId} className="visually-hidden">
          Options for {view.name}
        </h2>
        {/* Phones only (CardMenuPhone): which card this is, and its time. */}
        <div className={styles.header}>
          {view.daytime ? <SunIcon size={22} /> : <MoonIcon size={22} />}
          <p className={styles.headerText}>
            <span className={styles.headerName}>{view.name}</span>
            <span className={styles.headerSub}>
              {view.subtitle} · {time}
            </span>
          </p>
        </div>
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- its items take focus */}
        <div
          ref={menu}
          role="menu"
          aria-labelledby={titleId}
          className={styles.menu}
          onKeyDown={onKeyDown}
        >
          <Item icon={<ClockIcon />} label="Jump from here" first onSelect={onJump} />
          <Item icon={<PencilIcon />} label="Rename" onSelect={onRename} />
          <Item
            icon={<ArrowUpIcon />}
            label="Move up"
            disabled={!canMoveUp}
            onSelect={() => {
              onMove(-1);
            }}
          />
          <Item
            icon={<ArrowDownIcon />}
            label="Move down"
            disabled={!canMoveDown}
            onSelect={() => {
              onMove(1);
            }}
          />
          <div role="separator" className={styles.separator} />
          <Item icon={<TrashIcon />} label="Remove" danger onSelect={onRemove} />
        </div>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
