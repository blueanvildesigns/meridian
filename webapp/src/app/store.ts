// App state in one small external store, read with useSyncExternalStore.
//
// Every change is written straight away while storage works (one key, one write: M2-2). If a write
// fails, the app carries on in memory and shows the storage banner, which also says when saved
// data couldn't be read. Another tab's writes arrive as
// `storage` events and replace this tab's state, so two open tabs don't undo each other.

import { useSyncExternalStore } from 'react';
import { loadState, saveState, type LoadResult, type StorageLike } from '../storage/storage';
import type { AppState } from '../storage/schema';

/** What the storage banner says, if anything: changes aren't being saved, or saved data was lost. */
export type StorageNotice =
  /** Storage is blocked or full: "Can't save in this browser". */
  | 'unavailable'
  /** A newer version of Meridian wrote the data (another tab after a deploy). */
  | 'newer'
  /** Some cities or settings couldn't be read and were left out (R-17). */
  | 'repaired'
  /** Nothing saved could be read, so the list started again (R-17). */
  | 'reset';

export interface StoreSnapshot {
  state: AppState;
  notice: StorageNotice | null;
}

export interface AppStore {
  getSnapshot: () => StoreSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Applies a change and saves it. A change that returns the same state does nothing. */
  update: (change: (state: AppState) => AppState) => void;
  /** Re-reads storage after another tab wrote to it. */
  reload: () => void;
}

function noticeFor(loaded: LoadResult, persistent = loaded.persistent): StorageNotice | null {
  if (loaded.status === 'newer') return 'newer';
  if (!persistent) return 'unavailable';
  return loaded.status === 'repaired' || loaded.status === 'reset' ? loaded.status : null;
}

export function createStore(storage: StorageLike | null, loaded: LoadResult): AppStore {
  let persistent = loaded.persistent && storage !== null;
  // Data that was partly or wholly unreadable is saved back cleaned up straight away (the original
  // is in the backup key), so the notice about it shows on this visit only.
  const cleaned = loaded.status === 'repaired' || loaded.status === 'reset';
  if (cleaned && persistent && storage && !saveState(storage, loaded.state)) persistent = false;
  let snapshot: StoreSnapshot = { state: loaded.state, notice: noticeFor(loaded, persistent) };
  const listeners = new Set<() => void>();

  const publish = (next: StoreSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (change) => {
      const state = change(snapshot.state);
      if (state === snapshot.state) return;
      let notice = snapshot.notice;
      if (persistent && storage && !saveState(storage, state)) {
        persistent = false;
        notice = 'unavailable';
      }
      publish({ state, notice });
    },
    reload: () => {
      // Only a tab that is saving follows other tabs: one that has stopped keeps its own state.
      if (!persistent || !storage) return;
      const next = loadState(storage);
      persistent = next.persistent;
      publish({ state: next.state, notice: noticeFor(next) });
    },
  };
}

export function useStore(store: AppStore): StoreSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
