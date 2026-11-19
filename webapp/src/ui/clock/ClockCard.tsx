// One clock card (canvas boards Main, Mobile, DarkMain, DarkMobile), and the card for a saved zone
// this browser doesn't know (ErrorZone, ErrorPhone).
//
// The DOM order is the reading order: name first, then day/night, then the time. CSS grid areas
// place things where the canvas draws them, on desktop and phone, from the same markup.

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useEffect, useRef, type TouchEventHandler } from 'react';
import { DragHandleIcon, MoonIcon, MoreIcon, SunIcon, WarningIcon } from '../icons';
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

export interface ClockCardProps {
  view: ClockView;
  handle: DragHandleProps;
  focusRequest: object | null;
}

export function ClockCard({
  view,
  handle: { setActivator, attributes, listeners },
  focusRequest,
}: ClockCardProps) {
  const nameId = `card-${view.id}-name`;
  const ref = useFocusRequest(focusRequest);
  // On phones the drag handle is hidden and the whole card is the menu button (see the CSS), so a
  // long press on it starts a drag, as on the handle.
  const onTouchStart = listeners?.onTouchStart as TouchEventHandler<HTMLButtonElement> | undefined;

  return (
    <article
      ref={ref}
      className={`${styles.card} ${view.daytime ? styles.day : styles.night} ${view.reference ? styles.reference : ''}`}
      aria-labelledby={nameId}
      tabIndex={-1}
    >
      <h2 id={nameId} className={styles.name}>
        {view.name}
      </h2>
      {view.reference && <p className={styles.refTag}>Jump reference</p>}
      <p className={styles.period}>
        {view.daytime ? <SunIcon size={18} /> : <MoonIcon size={18} />}
        <span className={styles.periodLabel}>{view.daytime ? 'Daytime' : 'Night'}</span>
      </p>
      <p className={styles.sub}>{view.subtitle}</p>
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
        {/* The card menu arrives in M6. */}
        <button
          type="button"
          className={`${buttons.icon} ${styles.more}`}
          aria-label={`More options for ${view.name}`}
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
