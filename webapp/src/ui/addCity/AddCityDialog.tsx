// Add a city (spec 4.2; canvas AddCity, AddCityAirport, AddCityZone, AddCityEmpty, AddCityPhone).
//
// A search field drives a list of results (the ARIA combobox pattern): Up/Down move through the
// results while focus stays in the field, Enter adds the highlighted one, Esc closes. The dialog
// stays open after adding; added rows say "Added". The same dialog, in replace mode, picks a new
// city or zone for a card whose saved zone this browser doesn't know (D14): picking closes it.

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchCities } from '../../cities/search';
import { PHONE, useMediaQuery } from '../../app/useMediaQuery';
import { cityKey, type NewCity, type StoredCity } from '../../storage/schema';
import type { HourCycle } from '../../time/format';
import { T } from '../../time/temporal';
import buttons from '../buttons.module.css';
import { Dialog } from '../dialog/Dialog';
import {
  CheckIcon,
  CloseIcon,
  GlobeIcon,
  NoResultsIcon,
  PlusIcon,
  SearchIcon,
  WarningIcon,
} from '../icons';
import {
  bandGroup,
  localTimeRow,
  offersLocalTime,
  resultRows,
  statusText,
  zoneBand,
  type ResultRow,
  type RowContext,
} from './resultView';
import { useSearchIndex } from './useSearchIndex';
import styles from './AddCityDialog.module.css';

export type AddCityMode =
  | { kind: 'add' }
  /** Replace entry `id`, whose zone isn't recognised; the search starts from its name. */
  | { kind: 'replace'; id: string; name: string; query: string };

export interface AddCityDialogProps {
  mode: AddCityMode;
  cities: readonly StoredCity[];
  /** Epoch milliseconds, from the page's minute clock, so the times shown tick with the cards. */
  now: number;
  deviceZone: string;
  hourCycle: HourCycle;
  onAdd: (city: NewCity) => void;
  onReplace: (id: string, city: NewCity) => void;
  onClose: () => void;
  onOpenerGone?: () => void;
}

const HINT = 'Try a city name, a country, an airport code like LHR, or a time zone like PST.';

export function AddCityDialog({
  mode,
  cities,
  now,
  deviceZone,
  hourCycle,
  onAdd,
  onReplace,
  onClose,
  onOpenerGone,
}: AddCityDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-option-${String(i)}`;
  const replacing = mode.kind === 'replace' ? mode.id : null;
  const verb = replacing ? 'Choose' : 'Add';

  const phone = useMediaQuery(PHONE);
  const input = useRef<HTMLInputElement>(null);
  const { state: indexState, retry } = useSearchIndex();
  const [query, setQuery] = useState(mode.kind === 'replace' ? mode.query : '');
  // Not deferred: a search takes a few milliseconds, and Enter must act on the rows for what's
  // in the field now, not the previous query's.
  const searched = query;
  // The highlighted row, remembered by key for the query it was chosen in: a new query starts
  // again from the top, and a row keeps its highlight as the minute ticks or it becomes "Added".
  const [active, setActive] = useState<{ query: string; key: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const index = indexState.status === 'ready' ? indexState.index : undefined;
  const response = useMemo(
    () => (index && searched.trim() ? searchCities(index, searched) : undefined),
    [index, searched],
  );

  const added = useMemo(
    () => new Set(cities.filter((c) => c.id !== replacing).map(cityKey)),
    [cities, replacing],
  );
  const rows = useMemo(() => {
    const ctx: RowContext = {
      instant: T().Instant.fromEpochMilliseconds(now),
      deviceZone,
      hourCycle,
      added,
    };
    const local = offersLocalTime(searched, added) ? [localTimeRow(ctx)] : [];
    const found = response ? resultRows(response, ctx) : [];
    return [...local, ...found.filter((r) => !local.some((l) => l.key === r.key))];
  }, [response, searched, now, deviceZone, hourCycle, added]);

  const band = useMemo(() => {
    const group = response && bandGroup(response);
    return group && zoneBand(group, T().Instant.fromEpochMilliseconds(now));
  }, [response, now]);

  const hasQuery = searched.trim() !== '';
  const activeIndex = (() => {
    const kept = active?.query === searched ? rows.findIndex((r) => r.key === active.key) : -1;
    return kept >= 0 ? kept : rows.findIndex((r) => !r.added);
  })();
  const status = !hasQuery
    ? ''
    : indexState.status === 'loading'
      ? 'Loading cities…'
      : response && response.total > 0
        ? statusText(response)
        : '';
  const noResults = hasQuery && indexState.status === 'ready' && rows.length === 0;
  const liveText = announcement || (noResults ? `No cities match “${searched.trim()}”` : status);

  const pick = (row: ResultRow) => {
    if (row.added) return;
    if (replacing) {
      onReplace(replacing, row.city);
      return;
    }
    onAdd(row.city);
    // The place too, so adding a second London is announced as well.
    setAnnouncement(`${row.name}, ${row.place}, added.`);
  };

  const highlight = (i: number) => {
    const row = rows[i];
    if (!row) return;
    setActive({ query: searched, key: row.key });
    document.getElementById(optionId(i))?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (rows.length === 0) return;
      const from = activeIndex < 0 ? (e.key === 'ArrowDown' ? -1 : rows.length) : activeIndex;
      highlight(Math.min(rows.length - 1, Math.max(0, from + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) pick(row);
    }
  };

  return (
    <Dialog
      labelledBy={titleId}
      {...(replacing ? { describedBy: descId } : {})}
      onClose={onClose}
      {...(onOpenerGone ? { onOpenerGone } : {})}
      className={styles.dialog}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {replacing ? 'Choose a zone' : 'Add a city'}
        </h2>
        <button
          type="button"
          className={`${buttons.icon} ${styles.close}`}
          aria-label="Close"
          onClick={onClose}
        >
          <CloseIcon size={22} />
        </button>
      </div>
      {mode.kind === 'replace' && (
        <p id={descId} className={styles.lede}>
          Pick a city or time zone for “{mode.name}”.
        </p>
      )}

      <div className={styles.search}>
        <SearchIcon size={20} className={styles.searchIcon} />
        <input
          ref={input}
          data-autofocus
          className={styles.input}
          type="text"
          role="combobox"
          aria-label="Search cities"
          aria-autocomplete="list"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          {...(activeIndex >= 0 ? { 'aria-activedescendant': optionId(activeIndex) } : {})}
          placeholder={
            phone
              ? 'City, country, airport, or time zone'
              : 'City, country, airport code, or time zone'
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAnnouncement('');
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query !== '' && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setAnnouncement('');
              input.current?.focus();
            }}
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {status && <p className={styles.status}>{status}</p>}
      {band && (
        <div className={styles.band}>
          <GlobeIcon size={18} />
          <span>{band}</span>
        </div>
      )}

      {indexState.status === 'error' ? (
        <div className={styles.message}>
          <WarningIcon size={40} className={styles.messageIcon} />
          <p className={styles.messageTitle}>Couldn’t load the city list</p>
          <p className={styles.messageText}>Check your connection, then try again.</p>
          <button type="button" className={buttons.secondary} onClick={retry}>
            Try again
          </button>
        </div>
      ) : noResults ? (
        <div className={styles.message}>
          <NoResultsIcon size={40} className={styles.messageIcon} />
          <p className={styles.messageTitle}>No cities match “{searched.trim()}”</p>
          <p className={styles.messageText}>{HINT}</p>
        </div>
      ) : (
        <div className={styles.results}>
          {/* Always rendered, hidden when empty, so the field's aria-controls always resolves. */}
          <div
            id={listId}
            role="listbox"
            aria-label="Results"
            tabIndex={-1}
            hidden={rows.length === 0}
            // Keep focus in the search field when a row is clicked or tapped.
            onMouseDown={(e) => {
              e.preventDefault();
            }}
          >
            {rows.map((row, i) => (
              <ResultOption
                key={row.key}
                id={optionId(i)}
                row={row}
                verb={verb}
                active={i === activeIndex}
                onPoint={() => {
                  setActive({ query: searched, key: row.key });
                }}
                onPick={() => {
                  pick(row);
                }}
              />
            ))}
          </div>
          {!hasQuery && <p className={styles.hint}>{HINT}</p>}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.notes}>
          <span className={styles.keys}>
            ↑ ↓ to move · Enter to {verb.toLowerCase()} · Esc to close
          </span>
          <span>City data from GeoNames (CC BY 4.0)</span>
        </div>
        <button
          type="button"
          className={`${replacing ? buttons.secondary : buttons.primary} ${styles.done}`}
          onClick={onClose}
        >
          {replacing ? 'Cancel' : 'Done'}
        </button>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {liveText}
      </p>
    </Dialog>
  );
}

interface ResultOptionProps {
  id: string;
  row: ResultRow;
  verb: string;
  active: boolean;
  onPoint: () => void;
  onPick: () => void;
}

function ResultOption({ id, row, verb, active, onPoint, onPick }: ResultOptionProps) {
  // The option's name comes from what it shows (so it includes the visible text, WCAG 2.5.3):
  // "London, England, United Kingdom, 3:43 AM, UTC+0:00 GMT, Add". The hidden commas give screen
  // readers a pause where the layout gives sighted people one.
  const pause = <span className="visually-hidden">, </span>;
  return (
    // The keyboard path is the search field (aria-activedescendant); a click or tap picks the row.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-disabled={row.added || undefined}
      className={`${styles.row} ${active ? styles.active : ''} ${row.added ? styles.isAdded : ''}`}
      onMouseMove={active ? undefined : onPoint}
      onClick={onPick}
    >
      <span className={styles.what}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{row.name}</span>
          {row.tag && (
            <>
              {pause}
              <span className={styles.tag}>{row.tag}</span>
            </>
          )}
        </span>
        {pause}
        <span className={styles.place}>{row.place}</span>
      </span>
      {pause}
      <span className={styles.when}>
        <span className={styles.time}>
          {row.time}
          {row.dayPeriod && (
            <>
              {' '}
              <span className={styles.ap}>{row.dayPeriod}</span>
            </>
          )}
        </span>
        {pause}
        <span className={styles.zone}>
          {row.offset}
          {row.abbreviation && (
            <>
              {' '}
              <span aria-hidden="true">·</span> {row.abbreviation}
            </>
          )}
        </span>
      </span>
      {pause}
      <span className={styles.action}>
        {row.added ? (
          <span className={styles.addedLabel}>
            <CheckIcon size={18} />
            Added
          </span>
        ) : (
          <span className={styles.addButton}>
            <PlusIcon size={16} />
            {verb}
          </span>
        )}
      </span>
    </div>
  );
}
