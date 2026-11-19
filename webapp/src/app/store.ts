// App state in one small external store, read with useSyncExternalStore.
//
// Every change is written straight away while storage works (one key, one write: M2-2). If a write
// fails, the app carries on in memory and shows the storage banner. Another tab's writes arrive as
// `storage` events and replace this tab's state, so two open tabs don't undo each other.

import { useSyncExternalStore } from 'react';
import { loadState, saveState, type LoadResult, type StorageLike } from '../storage/storage';
import type { AppState } from '../storage/schema';

/** Why changes aren't being saved, if they aren't. */
export type StorageNotice =
  /** Storage is blocked or full: "Can't save in this browser". */
  | 'unavailable'
  /** A newer version of Meridian wrote the data (another tab after a deploy). */
  | 'newer';

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

function noticeFor(loaded: LoadResult): StorageNotice | null {
  if (loaded.status === 'newer') return 'newer';
  return loaded.persistent ? null : 'unavailable';
}

export function createStore(storage: StorageLike | null, loaded: LoadResult): AppStore {
  let persistent = loaded.persistent && storage !== null;
  let snapshot: StoreSnapshot = { state: loaded.state, notice: noticeFor(loaded) };
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
