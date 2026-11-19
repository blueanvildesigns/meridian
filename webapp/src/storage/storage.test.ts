import { describe, expect, it } from 'vitest';
import { readStoredAppearance } from '../app/theme';
import { THEME_BOOT_SCRIPT } from '../app/themeBoot';
import type { Migration } from './migrations';
import { BACKUP_KEY, STORAGE_KEY, type AppState, type PlaceCity } from './schema';
import { loadState, openStorage, saveState, serializeState } from './storage';
import { fakeStorage } from './testStorage';

const LONDON: PlaceCity = {
  id: 'a',
  kind: 'place',
  zone: 'Europe/London',
  geonameId: 2643743,
  name: 'London',
  countryCode: 'GB',
  country: 'United Kingdom',
  region: 'England',
  lat: 51.51,
  lon: -0.13,
};

const STATE: AppState = {
  cities: [{ id: 'l', kind: 'local' }, LONDON, { id: 'u', kind: 'zone', zone: 'UTC' }],
  settings: { timeFormat: '24', appearance: 'dark' },
};

const stored = (value: unknown) => ({ [STORAGE_KEY]: JSON.stringify(value) });

describe('openStorage', () => {
  it('returns storage that accepts a probe write, and leaves nothing behind', () => {
    const s = fakeStorage();
    expect(openStorage(() => s)).toBe(s);
    expect(s.data.size).toBe(0);
  });

  it('returns null when touching storage throws (blocked cookies)', () => {
    expect(
      openStorage(() => {
        throw new DOMException('denied', 'SecurityError');
      }),
    ).toBeNull();
  });

  it('returns null when writes are refused (quota, Safari private mode in old versions)', () => {
    expect(openStorage(() => fakeStorage({}, { write: () => true }))).toBeNull();
  });

  it('returns null when there is no storage at all', () => {
    expect(openStorage(() => undefined)).toBeNull();
  });
});

describe('loadState', () => {
  it('starts with My Local Time on first run (D22) and will persist', () => {
    const r = loadState(fakeStorage());
    expect(r).toEqual({
      state: {
        cities: [{ id: expect.any(String) as string, kind: 'local' }],
        settings: { timeFormat: 'browser', appearance: 'system' },
      },
      status: 'fresh',
      persistent: true,
    });
  });

  it('keeps an emptied list empty: only a first run is seeded', () => {
    const s = fakeStorage();
    saveState(s, { cities: [], settings: STATE.settings });
    expect(loadState(s).state.cities).toEqual([]);
  });

  it('round-trips a saved state exactly', () => {
    const s = fakeStorage();
    expect(saveState(s, STATE)).toBe(true);
    expect(loadState(s)).toEqual({ state: STATE, status: 'ok', persistent: true });
    expect(s.data.has(BACKUP_KEY)).toBe(false);
  });

  it('runs in memory when storage is null or reads throw', () => {
    expect(loadState(null)).toMatchObject({ status: 'unavailable', persistent: false });
    expect(loadState(null).state.cities.map((c) => c.kind)).toEqual(['local']);
    expect(loadState(fakeStorage({}, { read: true }))).toMatchObject({
      status: 'unavailable',
      persistent: false,
    });
  });

  it.each([
    ['invalid JSON', '{"schemaVersion":1,'],
    ['JSON null', 'null'],
    ['an array', '[]'],
    ['no version', '{"cities":[]}'],
    ['version 0', '{"schemaVersion":0,"cities":[]}'],
    ['fractional version', '{"schemaVersion":1.5,"cities":[]}'],
    ['string version', '{"schemaVersion":"1","cities":[]}'],
  ])('backs up and resets on %s', (_label, raw) => {
    const s = fakeStorage({ [STORAGE_KEY]: raw });
    const r = loadState(s);
    expect(r).toMatchObject({ status: 'reset', persistent: true });
    expect(r.state.cities).toEqual([{ id: expect.any(String) as string, kind: 'local' }]);
    expect(s.data.get(BACKUP_KEY)).toBe(raw);
    // Loading never rewrites the main key; the corrupt copy stays until the first change.
    expect(s.data.get(STORAGE_KEY)).toBe(raw);
  });

  it('keeps good entries, drops bad ones, and backs up the original', () => {
    const raw = {
      schemaVersion: 1,
      cities: [LONDON, { id: 'x', kind: 'place', zone: 'Asia/Tokyo' }, 'junk', STATE.cities[0]],
      settings: { timeFormat: '12', appearance: 'sepia' },
    };
    const s = fakeStorage(stored(raw));
    const r = loadState(s);
    expect(r.status).toBe('repaired');
    expect(r.persistent).toBe(true);
    expect(r.state.cities).toEqual([LONDON, STATE.cities[0]]);
    expect(r.state.settings).toEqual({ timeFormat: '12', appearance: 'system' });
    expect(s.data.get(BACKUP_KEY)).toBe(JSON.stringify(raw));
  });

  it('runs in memory rather than risk losing data it cannot back up', () => {
    const raw = { schemaVersion: 1, cities: [LONDON, 'junk'] };
    const s = fakeStorage(stored(raw), { write: (k) => k === BACKUP_KEY });
    const r = loadState(s);
    expect(r).toMatchObject({ status: 'unavailable', persistent: false });
    expect(r.state.cities).toEqual([LONDON]);

    const corrupt = fakeStorage({ [STORAGE_KEY]: '{oops' }, { write: (k) => k === BACKUP_KEY });
    expect(loadState(corrupt)).toMatchObject({ status: 'unavailable', persistent: false });
  });

  it('reads data from a newer schema but never lets it be overwritten', () => {
    const raw = { schemaVersion: 7, cities: [LONDON], settings: { appearance: 'dark' }, extra: 1 };
    const s = fakeStorage(stored(raw));
    const r = loadState(s);
    expect(r).toMatchObject({ status: 'newer', persistent: false });
    expect(r.state.cities).toEqual([LONDON]);
    expect(r.state.settings.appearance).toBe('dark');
    expect(s.data.has(BACKUP_KEY)).toBe(false);
  });

  it('ignores unknown extra fields without calling it a repair', () => {
    const s = fakeStorage(stored({ ...JSON.parse(serializeState(STATE)), later: true }));
    expect(loadState(s).status).toBe('ok');
  });
});

describe('migrations', () => {
  const v1ToV2: Migration = (d) => ({
    ...d,
    cities: (d.cities as { id: string }[]).map((c) => ({ ...c, id: `v2-${c.id}` })),
  });

  it('migrates older data, and backs up the pre-migration copy', () => {
    const raw = JSON.stringify({ schemaVersion: 1, cities: [{ id: 'l', kind: 'local' }] });
    const s = fakeStorage({ [STORAGE_KEY]: raw });
    const r = loadState(s, { version: 2, migrations: { 1: v1ToV2 } });
    expect(r.status).toBe('ok');
    expect(r.state.cities).toEqual([{ id: 'v2-l', kind: 'local' }]);
    expect(s.data.get(BACKUP_KEY)).toBe(raw);
  });

  it('treats a missing or failing migration as unreadable', () => {
    const raw = JSON.stringify({ schemaVersion: 1, cities: [] });
    expect(
      loadState(fakeStorage({ [STORAGE_KEY]: raw }), { version: 2, migrations: {} }).status,
    ).toBe('reset');
    const boom: Migration = () => {
      throw new Error('bad');
    };
    expect(
      loadState(fakeStorage({ [STORAGE_KEY]: raw }), { version: 2, migrations: { 1: boom } })
        .status,
    ).toBe('reset');
  });
});

describe('saveState', () => {
  it('writes the versioned shape under the single key', () => {
    const s = fakeStorage();
    saveState(s, STATE);
    expect(JSON.parse(s.data.get(STORAGE_KEY) ?? '')).toEqual({ schemaVersion: 1, ...STATE });
  });

  it('reports a failed write (quota) instead of throwing', () => {
    expect(saveState(fakeStorage({}, { write: () => true }), STATE)).toBe(false);
  });

  it('stays readable by the theme boot script and theme reader', () => {
    const s = fakeStorage();
    saveState(s, STATE);
    expect(readStoredAppearance(s)).toBe('dark');
    const attrs: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const boot = new Function('window', 'document', THEME_BOOT_SCRIPT) as (
      w: unknown,
      d: unknown,
    ) => void;
    boot(
      { localStorage: s, matchMedia: () => ({ matches: false }) },
      { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
    );
    expect(attrs['data-theme']).toBe('dark');
  });
});
