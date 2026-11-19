import { describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, STORAGE_KEY, type AppState } from '../storage/schema';
import { loadState, serializeState } from '../storage/storage';
import { fakeStorage } from '../storage/testStorage';
import { LONDON, TOKYO } from '../test/places';
import { removeCity } from './actions';
import { createStore } from './store';

const STATE: AppState = {
  cities: [LONDON, TOKYO],
  settings: { timeFormat: 'browser', appearance: 'system' },
};

function setup(initial: AppState | null = STATE, fail: Parameters<typeof fakeStorage>[1] = {}) {
  const storage = fakeStorage(initial ? { [STORAGE_KEY]: serializeState(initial) } : {}, fail);
  const store = createStore(storage, loadState(storage));
  return { storage, store };
}

const savedIds = (raw: string | undefined) =>
  (JSON.parse(raw ?? '{}') as { cities: { id: string }[] }).cities.map((c) => c.id);

describe('createStore', () => {
  it('starts from the loaded state with no notice', () => {
    const { store } = setup();
    expect(store.getSnapshot().state).toEqual(STATE);
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('saves each change and notifies subscribers', () => {
    const { storage, store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((s) => removeCity(s, 'london'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().state.cities.map((c) => c.id)).toEqual(['tokyo']);
    expect(savedIds(storage.data.get(STORAGE_KEY))).toEqual(['tokyo']);
  });

  it('ignores a change that returns the same state', () => {
    const { storage, store } = setup();
    const before = storage.data.get(STORAGE_KEY);
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((s) => removeCity(s, 'gone'));
    expect(listener).not.toHaveBeenCalled();
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
  });

  it('stops notifying after unsubscribe', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener)();
    store.update((s) => removeCity(s, 'london'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps working in memory, with a notice, when a save fails', () => {
    let full = false;
    const { storage, store } = setup(STATE, { write: (key) => full && key === STORAGE_KEY });
    full = true;
    store.update((s) => removeCity(s, 'london'));
    expect(store.getSnapshot().state.cities.map((c) => c.id)).toEqual(['tokyo']);
    expect(store.getSnapshot().notice).toBe('unavailable');
    // No further attempts: the stored copy is left as it was.
    full = false;
    store.update((s) => removeCity(s, 'tokyo'));
    expect(savedIds(storage.data.get(STORAGE_KEY))).toEqual(['london', 'tokyo']);
  });

  it('shows the notice and never writes when storage is unavailable', () => {
    const store = createStore(null, loadState(null));
    expect(store.getSnapshot().notice).toBe('unavailable');
    store.update((s) => ({ ...s, cities: [] }));
    expect(store.getSnapshot().state.cities).toEqual([]);
  });

  it('never overwrites data from a newer version', () => {
    const raw = JSON.stringify({ ...JSON.parse(serializeState(STATE)), schemaVersion: 99 });
    const storage = fakeStorage({ [STORAGE_KEY]: raw });
    const store = createStore(storage, loadState(storage));
    expect(store.getSnapshot().notice).toBe('newer');
    store.update((s) => removeCity(s, 'london'));
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
  });
});

describe('unreadable saved data (R-17)', () => {
  it('says some was left out, once: the cleaned-up data is saved straight away', () => {
    const raw = JSON.stringify({
      ...JSON.parse(serializeState(STATE)),
      cities: [LONDON, { kind: 'mystery' }, TOKYO],
    });
    const storage = fakeStorage({ [STORAGE_KEY]: raw });
    const store = createStore(storage, loadState(storage));
    expect(store.getSnapshot().notice).toBe('repaired');
    expect(savedIds(storage.data.get(STORAGE_KEY))).toEqual(['london', 'tokyo']);
    expect(storage.data.get(BACKUP_KEY)).toBe(raw);
    expect(createStore(storage, loadState(storage)).getSnapshot().notice).toBeNull();
  });

  it('says it started again when nothing could be read', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{not json' });
    const store = createStore(storage, loadState(storage));
    expect(store.getSnapshot().notice).toBe('reset');
    expect(loadState(storage).status).toBe('ok');
    expect(storage.data.get(BACKUP_KEY)).toBe('{not json');
  });

  it('says it can’t save instead, if saving the cleaned-up data fails', () => {
    const storage = fakeStorage(
      { [STORAGE_KEY]: '{not json' },
      { write: (key) => key === STORAGE_KEY },
    );
    const store = createStore(storage, loadState(storage));
    expect(store.getSnapshot().notice).toBe('unavailable');
  });
});

describe('reload (another tab wrote)', () => {
  it("replaces this tab's state with the stored one", () => {
    const { storage, store } = setup();
    storage.data.set(STORAGE_KEY, serializeState({ ...STATE, cities: [TOKYO] }));
    store.reload();
    expect(store.getSnapshot().state.cities.map((c) => c.id)).toEqual(['tokyo']);
  });

  it('stops saving if the other tab is a newer version', () => {
    const { storage, store } = setup();
    const raw = JSON.stringify({ schemaVersion: 99, cities: [], settings: {} });
    storage.data.set(STORAGE_KEY, raw);
    store.reload();
    expect(store.getSnapshot().notice).toBe('newer');
    store.update((s) => ({ ...s, cities: [LONDON] }));
    expect(storage.data.get(STORAGE_KEY)).toBe(raw);
  });

  it('does nothing in a tab that has stopped saving', () => {
    const store = createStore(null, loadState(null));
    const before = store.getSnapshot();
    store.reload();
    expect(store.getSnapshot()).toBe(before);
  });
});
