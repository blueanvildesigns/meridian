import { describe, expect, it } from 'vitest';
import { readStoredAppearance, resolveTheme } from './theme';
import { STORAGE_KEY, THEME_BOOT_SCRIPT } from './themeBoot';

function fakeStorage(value: string | null, throws = false): Pick<Storage, 'getItem'> {
  return {
    getItem: (key: string) => {
      if (throws) throw new DOMException('denied', 'SecurityError');
      return key === STORAGE_KEY ? value : null;
    },
  };
}

const stored = (appearance: unknown) =>
  JSON.stringify({ schemaVersion: 1, settings: { appearance } });

describe('readStoredAppearance', () => {
  it.each([
    ['nothing stored', null, 'system'],
    ['light', stored('light'), 'light'],
    ['dark', stored('dark'), 'dark'],
    ['system', stored('system'), 'system'],
    ['unknown value', stored('sepia'), 'system'],
    ['corrupt JSON', '{not json', 'system'],
    ['JSON null', 'null', 'system'],
  ])('%s', (_label, raw, expected) => {
    expect(readStoredAppearance(fakeStorage(raw))).toBe(expected);
  });

  it('falls back to system when storage throws', () => {
    expect(readStoredAppearance(fakeStorage(null, true))).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the system only for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('THEME_BOOT_SCRIPT (the inline pre-paint script)', () => {
  function run(opts: {
    raw: string | null;
    systemDark: boolean;
    storageThrows?: boolean;
    mediaThrows?: boolean;
  }) {
    const attrs: Record<string, string> = {};
    const window = {
      localStorage: fakeStorage(opts.raw, opts.storageThrows),
      matchMedia: () => {
        if (opts.mediaThrows) throw new Error('no matchMedia');
        return { matches: opts.systemDark };
      },
    };
    const document = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
      },
    };
    // Executes the exact inline script with stand-in globals.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const boot = new Function('window', 'document', THEME_BOOT_SCRIPT) as (
      w: typeof window,
      d: typeof document,
    ) => void;
    boot(window, document);
    return attrs['data-theme'];
  }

  it.each([
    [{ raw: null, systemDark: false }, 'light'],
    [{ raw: null, systemDark: true }, 'dark'],
    [{ raw: stored('dark'), systemDark: false }, 'dark'],
    [{ raw: stored('light'), systemDark: true }, 'light'],
    [{ raw: stored('system'), systemDark: true }, 'dark'],
    [{ raw: '{corrupt', systemDark: true }, 'dark'],
    [{ raw: null, systemDark: true, storageThrows: true }, 'dark'],
    [{ raw: stored('dark'), systemDark: false, mediaThrows: true }, 'dark'],
  ])('%o -> %s', (opts, expected) => {
    expect(run(opts)).toBe(expected);
  });

  it('agrees with readStoredAppearance + resolveTheme for every stored value', () => {
    for (const value of ['light', 'dark', 'system', 'bogus', undefined]) {
      for (const systemDark of [true, false]) {
        const raw = value === undefined ? null : stored(value);
        expect(run({ raw, systemDark })).toBe(
          resolveTheme(readStoredAppearance(fakeStorage(raw)), systemDark),
        );
      }
    }
  });
});
