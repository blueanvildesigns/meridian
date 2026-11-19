// Shown when every card has been removed (canvas EmptyList, EmptyListPhone). A first visit starts
// with My Local Time instead (owner ruling R-2).

import { useEffect, useRef } from 'react';
import buttons from './buttons.module.css';
import { EmptyGlobe, PinIcon, PlusIcon } from './icons';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  onAddCity?: () => void;
  onUseLocalTime: () => void;
  /** Move focus to the heading, e.g. after the last card is removed. */
  focusRequest?: object | null;
}

export function EmptyState({ onAddCity, onUseLocalTime, focusRequest }: EmptyStateProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusRequest) heading.current?.focus();
  }, [focusRequest]);

  return (
    <section className={styles.empty} aria-labelledby="empty-title">
      <span className={styles.globe}>
        <EmptyGlobe />
      </span>
      <h2 id="empty-title" ref={heading} className={styles.title} tabIndex={-1}>
        No clocks yet
      </h2>
      <p className={styles.text}>
        Add a city to see its local time. You can start with where you are, then add the places your
        team works from.
      </p>
      <div className={styles.actions}>
        <button type="button" className={buttons.primary} onClick={onAddCity}>
          <PlusIcon size={18} />
          Add city
        </button>
        <button type="button" className={buttons.secondary} onClick={onUseLocalTime}>
          <PinIcon size={18} />
          Use my local time
        </button>
      </div>
    </section>
  );
}
