import { STORAGE_KEY, type Appearance, type Theme } from './themeBoot';

export type { Appearance, Theme };

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Reads Settings > Appearance from storage. Falls back to 'system' on any problem. */
export function readStoredAppearance(storage: Pick<Storage, 'getItem'> | undefined): Appearance {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return 'system';
    const parsed: unknown = JSON.parse(raw);
    const value =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { settings?: { appearance?: unknown } }).settings?.appearance
        : undefined;
    return isAppearance(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(appearance: Appearance, systemPrefersDark: boolean): Theme {
  if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light';
  return appearance;
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-theme', theme);
}

/**
 * Keeps the theme in sync with the OS while Appearance is 'system'.
 * `getAppearance` is called on every change so the caller owns the current setting.
 * Returns an unsubscribe function.
 */
export function syncThemeWithSystem(getAppearance: () => Appearance): () => void {
  let media: MediaQueryList;
  try {
    media = window.matchMedia(DARK_QUERY);
  } catch {
    return () => undefined;
  }
  const update = () => {
    applyTheme(resolveTheme(getAppearance(), media.matches));
  };
  media.addEventListener('change', update);
  return () => {
    media.removeEventListener('change', update);
  };
}
