import { useMemo, useRef, useState } from 'react';
import { deviceZone } from '../time/zones';
import { resolveHourCycle } from '../time/format';
import { T } from '../time/temporal';
import { AddCityDialog, type AddCityMode } from '../ui/addCity/AddCityDialog';
import { ClockGrid } from '../ui/clock/ClockGrid';
import { cardView } from '../ui/clock/cardView';
import { Controls } from '../ui/Controls';
import { EmptyState } from '../ui/EmptyState';
import { GearIcon, InfoIcon, LogoMark } from '../ui/icons';
import { JumpPicker } from '../ui/jump/JumpPicker';
import { bannerWhen, referenceCardId, referencePlace } from '../ui/jump/jumpView';
import { StorageBanner } from '../ui/StorageBanner';
import { cityKey, defaultName, type NewCity } from '../storage/schema';
import type { JumpState } from '../time/jumpUrl';
import { addCity, addLocalTime, moveCity, removeCity, replaceCity } from './actions';
import { jumpLink, setJumpState, useJumpState } from './jumpLocation';
import { useStore, type AppStore, type StorageNotice } from './store';
import { useMinuteClock } from './useMinuteClock';
import styles from './App.module.css';

// Owner ruling R-5.
export const KOFI_URL = 'https://ko-fi.com/grahamtholomew';

/** Where focus goes when a card disappears (a new object each time, so the same target refocuses). */
interface FocusRequest {
  id: string | null;
}

/** The Jump picker, open: the control it hangs from, and the card for "Jump from here" (M6). */
interface PickerRequest {
  anchor: HTMLElement | null;
  fromCardId?: string;
}

export function App({ store }: { store: AppStore }) {
  const { state, notice } = useStore(store);
  const now = useMinuteClock();
  const [dismissed, setDismissed] = useState<StorageNotice | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [addCityMode, setAddCityMode] = useState<AddCityMode | null>(null);
  /** The last city added while the dialog was open, to focus if its opener has gone. */
  const lastAdded = useRef<string | null>(null);

  // Jump (spec 4.3): the moment lives in the URL hash (D11). While one shows, the clocks stop at it.
  const jump = useJumpState();
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  /** The card picked as the reference last, to tell apart two with the same name and zone. */
  const [refHint, setRefHint] = useState<string | null>(null);
  const [focusBanner, setFocusBanner] = useState<object | null>(null);
  const [focusJump, setFocusJump] = useState<object | null>(null);

  // Read every render: the device zone can change while the page is open (travel, OS settings).
  const zone = deviceZone();
  const hourCycle = resolveHourCycle(state.settings.timeFormat);
  const refId = jump ? referenceCardId(state.cities, jump, zone, refHint) : null;
  const shownMs = jump ? jump.instant.epochMilliseconds : now;
  const views = useMemo(() => {
    const instant = T().Instant.fromEpochMilliseconds(shownMs);
    const mode = jump ? 'jump' : 'live';
    return state.cities.map((city) =>
      cardView(city, { instant, deviceZone: zone, hourCycle, mode, referenceId: refId }),
    );
  }, [state.cities, shownMs, jump, zone, hourCycle, refId]);
  const empty = views.length === 0;

  const applyJump = (next: JumpState, cityId: string | null) => {
    // Back from the first Jump returns to live; Change replaces the Jump rather than stacking up.
    setJumpState(next, { replace: jump !== null });
    setRefHint(cityId);
    setPicker(null);
    // Jump to a time has given way to the banner: put focus on what it says.
    if (!jump) setFocusBanner({});
  };

  const resetToLive = () => {
    setJumpState(null);
    setFocusJump({});
  };

  const remove = (id: string) => {
    const i = state.cities.findIndex((c) => c.id === id);
    const neighbour = state.cities[i + 1] ?? state.cities[i - 1];
    store.update((s) => removeCity(s, id));
    setFocusRequest({ id: neighbour?.id ?? null });
  };

  const openAddCity = () => {
    lastAdded.current = null;
    setAddCityMode({ kind: 'add' });
  };

  const chooseZone = (id: string) => {
    const city = state.cities.find((c) => c.id === id);
    if (!city) return;
    // Start from the city's own name (a renamed zone is often findable by it), or the zone's last
    // part: "Europe/Kiev" → "Kiev".
    const query =
      city.kind === 'place'
        ? city.name
        : city.kind === 'zone'
          ? (city.zone.split('/').pop() ?? '').replace(/_/g, ' ')
          : '';
    lastAdded.current = null;
    setAddCityMode({ kind: 'replace', id, name: defaultName(city), query });
  };

  const add = (city: NewCity) => {
    store.update((s) => addCity(s, city));
    const key = cityKey(city);
    lastAdded.current =
      store.getSnapshot().state.cities.find((c) => cityKey(c) === key)?.id ?? null;
  };

  const replace = (id: string, city: NewCity) => {
    store.update((s) => replaceCity(s, id, city));
    setAddCityMode(null);
    setFocusRequest({ id });
  };

  const addMyLocalTime = () => {
    store.update(addLocalTime);
    const local = store.getSnapshot().state.cities.find((c) => c.kind === 'local');
    if (local) setFocusRequest({ id: local.id });
  };

  return (
    <div className={`${styles.page} ${empty ? '' : styles.withBar}`}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <LogoMark />
          <h1 className={styles.wordmark}>Meridian</h1>
        </div>
        <div className={styles.headerActions}>
          {/* Settings and About dialogs arrive in M6. */}
          <button type="button" className={styles.iconButton} aria-label="Settings">
            <GearIcon size={22} />
          </button>
          <button type="button" className={styles.iconButton} aria-label="About Meridian">
            <InfoIcon size={22} />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {notice && notice !== dismissed && (
          <StorageBanner
            notice={notice}
            onDismiss={() => {
              setDismissed(notice);
            }}
          />
        )}
        <Controls
          empty={empty}
          jump={
            jump
              ? {
                  when: bannerWhen(
                    jump,
                    referencePlace(state.cities, jump, zone, refId),
                    hourCycle,
                  ),
                  link: jumpLink(jump),
                  onChange: (anchor) => {
                    setPicker({ anchor });
                  },
                  onReset: resetToLive,
                  focusRequest: focusBanner,
                }
              : undefined
          }
          onJump={(anchor) => {
            setPicker({ anchor });
          }}
          onAddCity={openAddCity}
          focusJump={focusJump}
        />
        {empty ? (
          <EmptyState
            onAddCity={openAddCity}
            onUseLocalTime={addMyLocalTime}
            focusRequest={focusRequest?.id === null ? focusRequest : null}
          />
        ) : (
          <ClockGrid
            views={views}
            onMove={(activeId, overId) => {
              store.update((s) => moveCity(s, activeId, overId));
            }}
            onRemove={remove}
            onAddCity={openAddCity}
            onChooseZone={chooseZone}
            focusRequest={focusRequest}
            dimmed={picker !== null}
          />
        )}
      </main>

      {picker && (
        <JumpPicker
          cities={state.cities}
          deviceZone={zone}
          hourCycle={hourCycle}
          now={now}
          jump={jump}
          refId={refId}
          fromCardId={picker.fromCardId}
          anchor={picker.anchor}
          onApply={applyJump}
          onClose={() => {
            setPicker(null);
          }}
        />
      )}

      {addCityMode && (
        <AddCityDialog
          mode={addCityMode}
          cities={state.cities}
          now={now}
          deviceZone={zone}
          hourCycle={hourCycle}
          onAdd={add}
          onReplace={replace}
          onClose={() => {
            setAddCityMode(null);
          }}
          onOpenerGone={() => {
            // Adding the first city replaces the empty state, and with it the Add city button.
            if (lastAdded.current) setFocusRequest({ id: lastAdded.current });
          }}
        />
      )}

      <footer className={styles.footer}>
        <span>Meridian is a Blue Anvil Designs project.</span>
        <span className={styles.footerLinks}>
          <button type="button" className={styles.linkButton}>
            About
          </button>
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            Support on Ko-fi
          </a>
        </span>
      </footer>
    </div>
  );
}
