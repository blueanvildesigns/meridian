import { useCallback, useMemo, useRef, useState } from 'react';
import { deviceZone } from '../time/zones';
import { resolveHourCycle } from '../time/format';
import { T } from '../time/temporal';
import { AboutDialog } from '../ui/about/AboutDialog';
import { AddCityDialog, type AddCityMode } from '../ui/addCity/AddCityDialog';
import { BugReportDialog } from '../ui/bugReport/BugReportDialog';
import { CardMenu } from '../ui/clock/CardMenu';
import { ClockGrid } from '../ui/clock/ClockGrid';
import { cardView, type ClockView } from '../ui/clock/cardView';
import { Controls } from '../ui/Controls';
import { EmptyState } from '../ui/EmptyState';
import { GearIcon, InfoIcon, LogoMark } from '../ui/icons';
import { JumpPicker } from '../ui/jump/JumpPicker';
import { bannerWhen, referenceCardId, referencePlace } from '../ui/jump/jumpView';
import { SettingsDialog } from '../ui/settings/SettingsDialog';
import { StorageBanner } from '../ui/StorageBanner';
import { UndoToast } from '../ui/UndoToast';
import {
  cityKey,
  defaultName,
  displayName,
  type NewCity,
  type StoredCity,
} from '../storage/schema';
import type { JumpState } from '../time/jumpUrl';
import {
  addCity,
  addLocalTime,
  changeSettings,
  moveCity,
  moveCityBy,
  removeCity,
  renameCity,
  replaceCity,
  restoreCity,
} from './actions';
import { bugReportUrl, collectDiagnostics, diagnosticsText } from './bugReport';
import type { BugReportService } from './bugReportClient';
import { jumpLink, setJumpState, useJumpState } from './jumpLocation';
import { useStore, type AppStore, type StorageNotice } from './store';
import { KOFI_URL } from './links';
import { useMinuteClock } from './useMinuteClock';
import styles from './App.module.css';

/** Where focus goes when a card disappears (a new object each time, so the same target refocuses). */
interface FocusRequest {
  id: string | null;
  /** The card's More options button rather than the card (after Move up or down). */
  more?: boolean;
}

/** The Jump picker, open: the control it hangs from, and the card for "Jump from here" (M6). */
interface PickerRequest {
  anchor: HTMLElement | null;
  fromCardId?: string;
}

/** A card's menu, open: which card, and its More options button. */
interface MenuRequest {
  id: string;
  anchor: HTMLElement | null;
}

/** The card just removed, for Undo: where it was and what the toast says. */
interface Removal {
  city: StoredCity;
  index: number;
  text: string;
}

export interface AppProps {
  store: AppStore;
  /** Sends in-app bug reports; null (the default) when this build can't, so GitHub's form opens. */
  reportBug?: BugReportService | null;
}

export function App({ store, reportBug = null }: AppProps) {
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

  // The card menu (spec 4.4) and what it leads to.
  const [menu, setMenu] = useState<MenuRequest | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  /** Said by the polite live region: where Move up or Move down put a card. */
  const [announcement, setAnnouncement] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  /** About, open; `focusData` when the storage banner's "What can I do?" opened it. */
  const [about, setAbout] = useState<{ focusData: boolean } | null>(null);

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
  // Bug reports: the in-app form when this build can send (phase 2), else GitHub's form with the
  // diagnostics filled in (phase 1). Either way nothing is sent until the reporter says so, and
  // they see the diagnostics first.
  const diagnostics = useMemo(
    () => diagnosticsText(collectDiagnostics(state.settings.timeFormat)),
    [state.settings.timeFormat],
  );
  const reportUrl = useMemo(() => bugReportUrl({ diagnostics }), [diagnostics]);
  const menuIndex = menu ? state.cities.findIndex((c) => c.id === menu.id) : -1;
  const menuView = views.find((v): v is ClockView => v.id === menu?.id && v.status === 'ok');

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
    const city = state.cities[i];
    if (!city) return;
    const neighbour = state.cities[i + 1] ?? state.cities[i - 1];
    store.update((s) => removeCity(s, id));
    setFocusRequest({ id: neighbour?.id ?? null });
    // A new removal replaces the toast; the one before stands.
    setRemoval({ city, index: i, text: `${displayName(city)} removed` });
  };

  const undoRemove = () => {
    if (!removal) return;
    store.update((s) => restoreCity(s, removal.city, removal.index));
    setRemoval(null);
    // Undo goes with the toast: focus the card it brought back (unless it was added again since).
    if (store.getSnapshot().state.cities.some((c) => c.id === removal.city.id)) {
      setFocusRequest({ id: removal.city.id });
    }
  };

  const endRemoval = useCallback(() => {
    setRemoval(null);
  }, []);

  const moveBy = (id: string, step: -1 | 1) => {
    store.update((s) => moveCityBy(s, id, step));
    const cities = store.getSnapshot().state.cities;
    const i = cities.findIndex((c) => c.id === id);
    const city = cities[i];
    if (city) {
      setAnnouncement(`${displayName(city)} moved to position ${i + 1} of ${cities.length}.`);
      setFocusRequest({ id, more: true });
    }
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
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Settings"
            onClick={() => {
              setSettingsOpen(true);
            }}
          >
            <GearIcon size={22} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="About Meridian"
            onClick={() => {
              setAbout({ focusData: false });
            }}
          >
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
            onHelp={() => {
              setAbout({ focusData: true });
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
            menuFor={menu?.id ?? null}
            renaming={renaming}
            onMenu={(id, anchor) => {
              setMenu({ id, anchor });
            }}
            onRenameEnd={(id, name) => {
              if (name !== null) store.update((s) => renameCity(s, id, name));
              setRenaming(null);
            }}
          />
        )}
      </main>

      {menu && menuView && (
        <CardMenu
          view={menuView}
          anchor={menu.anchor}
          canMoveUp={menuIndex > 0}
          canMoveDown={menuIndex < state.cities.length - 1}
          onJump={() => {
            // The picker hangs from the same button, set to this card (spec 4.4).
            setMenu(null);
            setPicker({ anchor: menu.anchor, fromCardId: menu.id });
          }}
          onRename={() => {
            setMenu(null);
            setRenaming(menu.id);
          }}
          onMove={(step) => {
            setMenu(null);
            moveBy(menu.id, step);
          }}
          onRemove={() => {
            setMenu(null);
            remove(menu.id);
          }}
          onClose={() => {
            setMenu(null);
          }}
        />
      )}

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

      {settingsOpen && (
        <SettingsDialog
          settings={state.settings}
          now={now}
          deviceZone={zone}
          onChange={(change) => {
            store.update((s) => changeSettings(s, change));
          }}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      )}

      {about && (
        <AboutDialog
          focusData={about.focusData}
          reportUrl={reportUrl}
          {...(reportBug && {
            onReportBug: () => {
              // About closes (focus back on its opener), then the report opens over the page.
              setAbout(null);
              setBugReportOpen(true);
            },
          })}
          onClose={() => {
            setAbout(null);
          }}
        />
      )}

      {bugReportOpen && reportBug && (
        <BugReportDialog
          service={reportBug}
          diagnostics={diagnostics}
          onClose={() => {
            setBugReportOpen(false);
          }}
        />
      )}

      <UndoToast message={removal} onUndo={undoRemove} onExpire={endRemoval} aboveBar={!empty} />
      <div role="status" className="visually-hidden">
        {announcement}
      </div>

      <footer className={styles.footer}>
        <span>Meridian is a Blue Anvil Designs project.</span>
        <span className={styles.footerLinks}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setAbout({ focusData: false });
            }}
          >
            About
          </button>
          {reportBug ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setBugReportOpen(true);
              }}
            >
              Report a bug
            </button>
          ) : (
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              Report a bug
            </a>
          )}
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            Support on Ko-fi
          </a>
        </span>
      </footer>
    </div>
  );
}
