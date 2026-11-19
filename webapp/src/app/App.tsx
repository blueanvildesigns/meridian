import { useMemo, useState } from 'react';
import { deviceZone } from '../time/zones';
import { resolveHourCycle } from '../time/format';
import { T } from '../time/temporal';
import { ClockGrid } from '../ui/clock/ClockGrid';
import { cardView } from '../ui/clock/cardView';
import { Controls } from '../ui/Controls';
import { EmptyState } from '../ui/EmptyState';
import { GearIcon, InfoIcon, LogoMark } from '../ui/icons';
import { StorageBanner } from '../ui/StorageBanner';
import { addLocalTime, moveCity, removeCity } from './actions';
import { useStore, type AppStore, type StorageNotice } from './store';
import { useMinuteClock } from './useMinuteClock';
import styles from './App.module.css';

// Owner ruling R-5.
export const KOFI_URL = 'https://ko-fi.com/grahamtholomew';

/** Where focus goes when a card disappears (a new object each time, so the same target refocuses). */
interface FocusRequest {
  id: string | null;
}

export function App({ store }: { store: AppStore }) {
  const { state, notice } = useStore(store);
  const now = useMinuteClock();
  const [dismissed, setDismissed] = useState<StorageNotice | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  // Read every render: the device zone can change while the page is open (travel, OS settings).
  const zone = deviceZone();
  const hourCycle = resolveHourCycle(state.settings.timeFormat);
  const views = useMemo(() => {
    const instant = T().Instant.fromEpochMilliseconds(now);
    return state.cities.map((city) =>
      cardView(city, { instant, deviceZone: zone, hourCycle, mode: 'live' }),
    );
  }, [state.cities, now, zone, hourCycle]);
  const empty = views.length === 0;

  const remove = (id: string) => {
    const i = state.cities.findIndex((c) => c.id === id);
    const neighbour = state.cities[i + 1] ?? state.cities[i - 1];
    store.update((s) => removeCity(s, id));
    setFocusRequest({ id: neighbour?.id ?? null });
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
        <Controls empty={empty} />
        {empty ? (
          <EmptyState
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
            focusRequest={focusRequest}
          />
        )}
      </main>

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
