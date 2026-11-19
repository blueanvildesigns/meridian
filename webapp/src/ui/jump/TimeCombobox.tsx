// The Jump picker's time field (M5-3, option D): a text field with a list of times every half
// hour. Typing narrows the list, and any minute can still be typed ("8:15 PM"); the arrow keys or
// the button open the whole list on the time in the field. An editable combobox with list
// autocomplete (WAI-ARIA APG): focus stays in the field and aria-activedescendant follows the
// highlight. Enter picks the highlighted time, or applies when it's the time already typed.
//
// The list is fixed to the window, under the field (above it when there's no room), because the
// picker scrolls on short screens and would clip it.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { HourCycle } from '../../time/format';
import { CheckIcon, ChevronDownIcon } from '../icons';
import { isTyped, matchingTimes, startingIndex, timeOptions, type TimeOption } from './timeList';
import styles from './TimeCombobox.module.css';

/** The list's tallest: six rows, so it fits above or below the field on a phone. */
const MAX_HEIGHT = 280;
/** Room between the field and the list, and the least room kept to the window's edge. */
const GAP = 4;
const EDGE = 8;

const minutesOf = (o: TimeOption) => o.hour * 60 + o.minute;

/** Puts the list under the box, or above it if there's more room there, as wide as the box. */
function placeList(list: HTMLElement, box: HTMLElement) {
  const at = box.getBoundingClientRect();
  const height = window.innerHeight;
  const below = height - at.bottom - GAP - EDGE;
  const above = at.top - GAP - EDGE;
  const down = below >= Math.min(MAX_HEIGHT, list.scrollHeight) || below >= above;
  list.style.left = `${String(at.left)}px`;
  list.style.width = `${String(at.width)}px`;
  list.style.maxHeight = `${String(Math.max(0, Math.min(MAX_HEIGHT, down ? below : above)))}px`;
  list.style.top = `${String(down ? at.bottom + GAP : at.top - GAP - list.offsetHeight)}px`;
}

/** Scrolls the list so the row is in view: centred on opening, just enough when moving. */
function reveal(list: HTMLElement, row: HTMLElement, centre: boolean) {
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (centre) {
    list.scrollTop = top - (list.clientHeight - row.offsetHeight) / 2;
  } else if (top < list.scrollTop) {
    list.scrollTop = top;
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight;
  }
}

export interface TimeComboboxProps {
  /** The field's ID, for its <label>. */
  id: string;
  value: string;
  hourCycle: HourCycle;
  invalid: boolean;
  describedBy?: string | undefined;
  /** The box around the field and its button, styled by the picker like its other fields. */
  boxClassName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (text: string) => void;
  /** Enter that the form will act on: with the list closed, or on the time already typed. */
  onEnter: () => void;
  /** Focus has left the field and its list. */
  onBlur: () => void;
}

export function TimeCombobox({
  id,
  value,
  hourCycle,
  invalid,
  describedBy,
  boxClassName,
  inputRef,
  onChange,
  onEnter,
  onBlur,
}: TimeComboboxProps) {
  const listId = useId();
  const optionId = (i: number) => `${listId}-${String(i)}`;
  const wrapper = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const lastPointer = useRef('');
  /**
   * How the list follows the highlight when it next moves: centred on opening or typing, just
   * enough for the arrow keys, and not at all for the pointer. The row is already under the
   * pointer, and scrolling would slide another row there, which the pointer would then highlight.
   */
  const follow = useRef<'centre' | 'nearest' | 'stay'>('centre');

  const [open, setOpen] = useState(false);
  /** What's been typed since the list opened, which narrows it; null shows every time. */
  const [query, setQuery] = useState<string | null>(null);
  /** The highlighted time, in minutes after midnight, once the arrow keys or pointer move it. */
  const [moved, setMoved] = useState<number | null>(null);

  const options = useMemo(
    () => (query === null ? timeOptions(hourCycle) : matchingTimes(query, hourCycle)),
    [query, hourCycle],
  );
  const movedIndex = moved === null ? -1 : options.findIndex((o) => minutesOf(o) === moved);
  const active = movedIndex >= 0 ? movedIndex : startingIndex(options, value, query !== null);
  // Typed down to the one time it already reads as ("8:00 AM"): nothing left to offer, and it
  // would hang over Apply.
  const only = query !== null && options.length === 1 ? options[0] : undefined;
  const settled = only !== undefined && isTyped(only, value);
  const shown = open && options.length > 0 && !settled;

  const close = () => {
    setOpen(false);
    setQuery(null);
    setMoved(null);
  };

  const openAll = () => {
    follow.current = 'centre';
    setOpen(true);
    setQuery(null);
    setMoved(null);
  };

  const pick = (option: TimeOption) => {
    onChange(option.label);
    close();
  };

  const move = (index: number) => {
    const option = options[Math.min(options.length - 1, Math.max(0, index))];
    if (!option) return;
    follow.current = 'nearest';
    setMoved(minutesOf(option));
  };

  // Placed before it's painted, and kept with the field while the picker scrolls, resizes or
  // moves (an alert appearing under the fields can push a popover up).
  useLayoutEffect(() => {
    const listEl = list.current;
    const boxEl = box.current;
    if (!shown || !listEl || !boxEl) return;
    const place = () => {
      placeList(listEl, boxEl);
    };
    place();
    const onScroll = (e: Event) => {
      if (e.target !== listEl) place();
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    observer?.observe(boxEl.closest('dialog') ?? boxEl);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [shown, options]);

  // Only when the highlight or the times change: not on other renders, which would pull the list
  // back from wherever the wheel took it.
  const activeId = shown ? optionId(active) : null;
  useLayoutEffect(() => {
    const row = activeId === null ? null : document.getElementById(activeId);
    if (list.current && row && follow.current !== 'stay') {
      reveal(list.current, row, follow.current === 'centre');
    }
  }, [activeId, options]);

  // A press anywhere else closes it (focus may not be in the field: a tap on the button leaves
  // the phone's keyboard down).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown) openAll();
      else move(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      const option = shown ? options[active] : undefined;
      if (option && !isTyped(option, value)) {
        e.preventDefault();
        pick(option);
        return;
      }
      // Nothing highlighted, or it's what's typed: close the list and let the form apply.
      close();
      onEnter();
    } else if (e.key === 'Escape' && shown) {
      // Close the list, not the picker (the dialog closes on an Esc that isn't cancelled).
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  return (
    <div ref={wrapper} className={styles.combo}>
      <div ref={box} className={boxClassName}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          className={styles.input}
          required
          value={value}
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          {...(shown && active >= 0 ? { 'aria-activedescendant': optionId(active) } : {})}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            // Not when focus only moved to the button or the list (a screen reader's click).
            if (wrapper.current?.contains(e.relatedTarget)) return;
            close();
            onBlur();
          }}
          onChange={(e) => {
            const text = e.target.value;
            onChange(text);
            follow.current = 'centre';
            setOpen(text.trim() !== '');
            setQuery(text);
            setMoved(null);
          }}
        />
        {/* Out of the Tab order, as the APG pattern has it: the arrow keys open the list. */}
        <button
          type="button"
          tabIndex={-1}
          className={styles.toggle}
          aria-label="Show times"
          aria-expanded={shown}
          aria-controls={listId}
          onPointerDown={(e) => {
            lastPointer.current = e.pointerType;
          }}
          // Keep focus where it is; the click decides whether the field should have it.
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            if (shown) {
              close();
            } else {
              openAll();
              // Not on touch, where focusing the field would bring up the keyboard over the list.
              if (lastPointer.current !== 'touch') inputRef.current?.focus();
            }
            lastPointer.current = '';
          }}
        >
          <ChevronDownIcon size={18} />
        </button>
      </div>

      {/* Always rendered, hidden when closed, so aria-controls always points somewhere. */}
      <div
        ref={list}
        id={listId}
        role="listbox"
        aria-label="Times"
        tabIndex={-1}
        hidden={!shown}
        className={styles.list}
        // Keep focus in the field when a time is clicked or tapped.
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        {shown &&
          options.map((option, i) => {
            const current = isTyped(option, value);
            return (
              // The keyboard path is the field (aria-activedescendant); a click or tap picks.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                key={option.label}
                id={optionId(i)}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.active : ''} ${current ? styles.current : ''}`}
                onMouseMove={
                  i === active
                    ? undefined
                    : () => {
                        follow.current = 'stay';
                        setMoved(minutesOf(option));
                      }
                }
                onClick={() => {
                  pick(option);
                }}
              >
                <span>{option.label}</span>
                {current && <CheckIcon size={18} className={styles.check} />}
              </div>
            );
          })}
      </div>
    </div>
  );
}
