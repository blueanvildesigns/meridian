// The clock list: a responsive grid of cards, reorderable by drag (pointer, touch or keyboard on
// the handle), ending with the "Add a city" tile.

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo } from 'react';
import { PlusIcon } from '../icons';
import type { CardView } from './cardView';
import { ClockCard, UnknownZoneCard } from './ClockCard';
import styles from './ClockGrid.module.css';

export interface ClockGridProps {
  views: readonly CardView[];
  onMove: (activeId: string, overId: string) => void;
  onRemove: (id: string) => void;
  onAddCity?: () => void;
  /** "Choose a zone" on an unrecognised card. */
  onChooseZone?: (id: string) => void;
  /** Move focus to the card with this ID (a new object each time; null ID means none). */
  focusRequest?: { id: string | null } | null;
  /** Faded behind the Jump popover, as canvas JumpPicker draws it. */
  dimmed?: boolean;
}

const INSTRUCTIONS =
  'To reorder, press Space or Enter on the drag handle, move the card with the arrow keys, ' +
  'then press Space or Enter again to drop it. Press Escape to cancel.';

/**
 * What screen readers hear while reordering. `lastOver` remembers the position last announced:
 * dnd-kit reports the card being over its own slot as soon as it's picked up, which would
 * immediately replace "Picked up" with "moved to" the same position.
 */
function announcements(views: readonly CardView[]): Announcements {
  let lastOver: UniqueIdentifier | null = null;
  const ids = views.map((v) => v.id);
  const name = (id: UniqueIdentifier) => views.find((v) => v.id === id)?.name ?? 'Card';
  const at = (id: UniqueIdentifier) => `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;
  return {
    onDragStart: ({ active }) => {
      lastOver = active.id;
      return `Picked up ${name(active.id)}, ${at(active.id)}.`;
    },
    onDragOver: ({ active, over }) => {
      if (!over || over.id === lastOver) return undefined;
      lastOver = over.id;
      return `${name(active.id)} moved to ${at(over.id)}.`;
    },
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} dropped at ${at(over.id)}.`
        : `${name(active.id)} dropped. Order unchanged.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${name(active.id)} is back at ${at(active.id)}.`,
  };
}

export function ClockGrid({
  views,
  onMove,
  onRemove,
  onAddCity,
  onChooseZone,
  focusRequest,
  dimmed = false,
}: ClockGridProps) {
  const sensors = useSensors(
    // Mouse and touch separately: a pointer sensor would turn every swipe on a phone into a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const accessibility = useMemo(
    () => ({
      announcements: announcements(views),
      screenReaderInstructions: { draggable: INSTRUCTIONS },
    }),
    [views],
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={accessibility}
    >
      <SortableContext items={views.map((v) => v.id)} strategy={rectSortingStrategy}>
        <ul className={`${styles.grid} ${dimmed ? styles.dimmed : ''}`} aria-label="Your clocks">
          {views.map((view) => (
            <SortableItem
              key={view.id}
              view={view}
              onRemove={onRemove}
              onChooseZone={onChooseZone}
              focusRequest={focusRequest?.id === view.id ? focusRequest : null}
            />
          ))}
          <li className={styles.item}>
            <button type="button" className={styles.tile} onClick={onAddCity}>
              <PlusIcon size={28} />
              Add a city
            </button>
          </li>
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemProps {
  view: CardView;
  onRemove: (id: string) => void;
  onChooseZone: ((id: string) => void) | undefined;
  focusRequest: object | null;
}

function SortableItem({ view, onRemove, onChooseZone, focusRequest }: SortableItemProps) {
  const ok = view.status === 'ok';
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: view.id,
    // The unrecognised-zone card has no handle (canvas ErrorZone); others can still move past it.
    disabled: ok ? false : { draggable: true },
  });

  return (
    <li
      ref={setNodeRef}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {ok ? (
        <ClockCard
          view={view}
          handle={{ setActivator: setActivatorNodeRef, attributes, listeners }}
          focusRequest={focusRequest}
        />
      ) : (
        <UnknownZoneCard
          view={view}
          onRemove={onRemove}
          onChooseZone={onChooseZone}
          focusRequest={focusRequest}
        />
      )}
    </li>
  );
}
