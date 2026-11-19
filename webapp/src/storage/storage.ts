// Loading and saving app state (D19, refined in M2-2).
//
// Rules:
// - Storage that can't be used (blocked, private mode, quota) means running in memory. The UI
//   shows the amber banner (spec 4.6); nothing crashes.
// - Data that can't be read fully is copied to BACKUP_KEY first. If that copy can't be made, the
//   app runs in memory rather than risk overwriting the only copy.
// - Data from a newer schema (an older tab after a deploy) is read as well as possible but never
//   written, so the newer version's data survives.
// - Loading never writes the main key. The first change does. Before a migrated shape replaces
//   older data, the older copy also goes to BACKUP_KEY (best effort).
// - BACKUP_KEY holds one copy; a later problem replaces it.

import { migrate, MIGRATIONS, type MigrationRegistry, type StoredData } from './migrations';
import { parseState } from './parse';
import { BACKUP_KEY, defaultState, SCHEMA_VERSION, STORAGE_KEY, type AppState } from './schema';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadStatus =
  /** Nothing stored yet: first run (D22: starts with My Local Time). */
  | 'fresh'
  /** Read exactly. */
  | 'ok'
  /** Some entries or settings were unusable and were dropped; the original is in BACKUP_KEY. */
  | 'repaired'
  /** Nothing was readable; the original is in BACKUP_KEY and the app starts fresh. */
  | 'reset'
  /** Written by a newer version; read as well as possible, and never overwritten. */
  | 'newer'
  /** Storage can't be used; the app runs in memory. */
  | 'unavailable';

export interface LoadResult {
  state: AppState;
  status: LoadStatus;
  /** False means keep everything in memory and show the storage banner. */
  persistent: boolean;
}

const PROBE_KEY = 'meridian.probe';

/**
 * Returns usable storage, or null. Merely touching `localStorage` can throw (blocked cookies), and
 * some browsers expose it but refuse writes, so this probes with a real write.
 */
export function openStorage(
  get: () => StorageLike | undefined = () => window.localStorage,
): StorageLike | null {
  try {
    const storage = get();
    if (!storage) return null;
    storage.setItem(PROBE_KEY, '1');
    storage.removeItem(PROBE_KEY);
    return storage;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is StoredData =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function backup(storage: StorageLike, raw: string): boolean {
  try {
    storage.setItem(BACKUP_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export interface LoadOptions {
  /** For tests: a different current version and registry. */
  version?: number;
  migrations?: MigrationRegistry;
}

export function loadState(storage: StorageLike | null, options: LoadOptions = {}): LoadResult {
  const version = options.version ?? SCHEMA_VERSION;
  const migrations = options.migrations ?? MIGRATIONS;
  const unavailable = (state = defaultState()): LoadResult => ({
    state,
    status: 'unavailable',
    persistent: false,
  });
  if (!storage) return unavailable();

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return unavailable();
  }
  if (raw === null) return { state: defaultState(), status: 'fresh', persistent: true };

  const unreadable = (): LoadResult =>
    backup(storage, raw)
      ? { state: defaultState(), status: 'reset', persistent: true }
      : unavailable();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return unreadable();
  }
  if (!isObject(data)) return unreadable();
  const stored = data.schemaVersion;
  if (typeof stored !== 'number' || !Number.isSafeInteger(stored) || stored < 1) {
    return unreadable();
  }

  if (stored > version) {
    return { state: parseState(data).state, status: 'newer', persistent: false };
  }

  let current: StoredData;
  try {
    current = migrate(data, stored, version, migrations);
  } catch {
    return unreadable();
  }
  // Keep the pre-migration copy too, best effort: the first save replaces it with the new shape.
  if (stored < version) backup(storage, raw);

  const { state, repairs } = parseState(current);
  if (repairs === 0) return { state, status: 'ok', persistent: true };
  return backup(storage, raw)
    ? { state, status: 'repaired', persistent: true }
    : unavailable(state);
}

export function serializeState(state: AppState, version: number = SCHEMA_VERSION): string {
  return JSON.stringify({ schemaVersion: version, cities: state.cities, settings: state.settings });
}

/** Writes the whole state. Returns false if the write failed (quota, revoked access). */
export function saveState(storage: StorageLike, state: AppState): boolean {
  try {
    storage.setItem(STORAGE_KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}
