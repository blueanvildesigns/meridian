// One clock card (canvas boards Main, Mobile, DarkMain, DarkMobile), and the card for a saved zone
// this browser doesn't know (ErrorZone, ErrorPhone).
//
// The DOM order is the reading order: name first, then day/night, then the time. CSS grid areas
// place things where the canvas draws them, on desktop and phone, from the same markup.

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useEffect, useRef, type TouchEventHandler } from 'react';
import { MAX_NAME_LENGTH } from '../../text/name';
import {
  CheckIcon,
  CloseIcon,
  DragHandleIcon,
  MoonIcon,
  MoreIcon,
  SunIcon,
  WarningIcon,
} from '../icons';
import buttons from '../buttons.module.css';
import type { ClockView, UnknownZoneView } from './cardView';
import styles from './ClockGrid.module.css';

export interface DragHandleProps {
  setActivator: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

const SEP = ' · ';

/** Focus moves to a card when a request names it, e.g. after its neighbour is removed. */
function useFocusRequest(request: object | null) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (request) ref.current?.focus();
  }, [request]);
  return ref;
}

interface RenameFieldProps {
  name: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

/**
 * Rename in place (spec 4.4; canvas CardMenuRename): Enter or the tick saves, Esc or the cross
 * cancels. Leaving the field saves too. The buttons keep focus in the field when pressed, so a
 * press on Cancel can't count as leaving it (Safari doesn't focus buttons it clicks).
 */
function RenameField({ name, onSave, onCancel }: RenameFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(input.current?.value ?? name);
    else onCancel();
  };

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const keepFocus = (e: { preventDefault: () => void }) => {
    e.preventDefault();
  };

  return (
    <form
      className={styles.rename}
      // Nothing is ever submitted to a server (form-action 'none').
      onSubmit={(e) => {
        e.preventDefault();
        finish(true);
      }}
    >
      <input
        ref={input}
        className={styles.renameInput}
        type="text"
        defaultValue={name}
        maxLength={MAX_NAME_LENGTH}
        aria-label="City name"
        autoComplete="off"
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.form?.contains(e.relatedTarget)) finish(true);
        }}
      />
      <button
        type="submit"
        className={`${buttons.icon} ${styles.renameSave}`}
        aria-label="Save name"
        onMouseDown={keepFocus}
      >
        <CheckIcon size={20} />
      </button>
      <button
        type="button"
        className={`${buttons.icon} ${styles.renameCancel}`}
        aria-label="Cancel renaming"
        onMouseDown={keepFocus}
        onClick={() => {
          finish(false);
        }}
      >
        <CloseIcon size={20} />
      </button>
    </form>
  );
}

export interface ClockCardProps {
  view: ClockView;
  handle: DragHandleProps;
  /** Focus the card, or its More options button with `more` (after Move up or down). */
  focusRequest: { more?: boolean } | null;
  /** This card's menu is open (its button looks pressed; on phones the card is ringed). */
  menuOpen?: boolean;
  onMenu?: ((id: string, button: HTMLElement | null) => void) | undefined;
  /** Showing the rename field in place of the name. */
  renaming?: boolean;
  /** The rename field closed: `name` if it was saved, null if cancelled. */
  onRenameEnd?: ((id: string, name: string | null) => void) | undefined;
}

export function ClockCard({
  view,
  handle: { setActivator, attributes, listeners },
  focusRequest,
  menuOpen = false,
  onMenu,
  renaming = false,
  onRenameEnd,
}: ClockCardProps) {
  const nameId = `card-${view.id}-name`;
  const ref = useFocusRequest(focusRequest?.more ? null : focusRequest);
  const more = useRef<HTMLButtonElement>(null);
  // Moving the card re-inserts it in the page, which drops focus (in browsers as in tests).
  useEffect(() => {
    if (focusRequest?.more) more.current?.focus();
  }, [focusRequest]);
  const endRename = (name: string | null) => {
    onRenameEnd?.(view.id, name);
  };

  // Once the rename field closes, focus goes back to the button that started it (the whole card
  // on phones, which is hidden while renaming, so this waits for the render that shows it again).
  const wasRenaming = useRef(renaming);
  useEffect(() => {
    if (wasRenaming.current && !renaming) more.current?.focus();
    wasRenaming.current = renaming;
  }, [renaming]);
  // On phones the drag handle is hidden and the whole card is the menu button (see the CSS), so a
  // long press on it starts a drag, as on the handle.
  const onTouchStart = listeners?.onTouchStart as TouchEventHandler<HTMLButtonElement> | undefined;

  return (
    <article
      ref={ref}
      className={[
        styles.card,
        view.daytime ? styles.day : styles.night,
        view.reference ? styles.reference : '',
        menuOpen ? styles.menuOpen : '',
        renaming ? styles.renaming : '',
      ].join(' ')}
      aria-labelledby={nameId}
      tabIndex={-1}
    >
      {/* Kept while renaming, out of sight, so the card keeps its name. */}
      <h2 id={nameId} className={renaming ? 'visually-hidden' : styles.name}>
        {view.name}
      </h2>
      {renaming && (
        <RenameField
          name={view.name}
          onSave={endRename}
          onCancel={() => {
            endRename(null);
          }}
        />
      )}
      {view.reference && <p className={styles.refTag}>Jump reference</p>}
      <p className={styles.period}>
        {view.daytime ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        <span className={styles.periodLabel}>{view.daytime ? 'Daytime' : 'Night'}</span>
      </p>
      {renaming ? (
        <p className={styles.sub}>Enter to save · Esc to cancel</p>
      ) : (
        <p className={styles.sub}>{view.subtitle}</p>
      )}
      <p className={styles.time}>
        <span className={styles.digits}>{view.time}</span>
        {view.dayPeriod && (
          <>
            {' '}
            <span className={styles.ap}>{view.dayPeriod}</span>
          </>
        )}
      </p>
      <p className={styles.chip}>{view.dayLabel}</p>
      <p className={styles.details}>
        <span className={styles.meta}>
          <span className={styles.dateAbbr}>
            {view.date}
            {view.abbreviation && ` · ${view.abbreviation}`}
          </span>
          <span className={styles.sep} aria-hidden="true">
            {' · '}
          </span>
          <span className={styles.offset}>{view.offset}</span>
        </span>
        <span className={styles.sepPhone} aria-hidden="true">
          {SEP}
        </span>
        <span className={styles.diff}>{view.difference}</span>
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          ref={setActivator}
          className={`${buttons.icon} ${styles.handle}`}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${view.name}`}
        >
          <DragHandleIcon size={18} />
        </button>
        <button
          ref={more}
          type="button"
          className={`${buttons.icon} ${styles.more}`}
          aria-label={`More options for ${view.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            onMenu?.(view.id, more.current);
          }}
          onTouchStart={onTouchStart}
        >
          <MoreIcon size={18} />
        </button>
      </div>
    </article>
  );
}

export interface UnknownZoneCardProps {
  view: UnknownZoneView;
  onRemove: (id: string) => void;
  /** Opens add-city in replace mode (D14). */
  onChooseZone?: ((id: string) => void) | undefined;
  focusRequest: object | null;
}

export function UnknownZoneCard({
  view,
  onRemove,
  onChooseZone,
  focusRequest,
}: UnknownZoneCardProps) {
  const nameId = `card-${view.id}-name`;
  const ref = useFocusRequest(focusRequest);
  return (
    <article ref={ref} className={styles.unknown} aria-labelledby={nameId} tabIndex={-1}>
      <p className={styles.unknownLabel}>
        <WarningIcon size={20} />
        <span>Time zone not recognized</span>
      </p>
      <h2 id={nameId} className={styles.unknownName}>
        {view.name}
      </h2>
      <p className={styles.unknownText}>
        Your browser doesn’t know the zone saved for this city ({view.zone}). The time can’t be
        shown.
      </p>
      <div className={styles.unknownActions}>
        <button
          type="button"
          className={`${buttons.primary} ${buttons.compact}`}
          onClick={() => {
            onChooseZone?.(view.id);
          }}
        >
          Choose a zone
        </button>
        <button
          type="button"
          className={`${buttons.secondary} ${buttons.compact}`}
          onClick={() => {
            onRemove(view.id);
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
