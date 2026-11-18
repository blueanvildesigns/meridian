// Theme bootstrap, kept dependency-free because vite.config.ts imports it.
//
// THEME_BOOT_SCRIPT is injected inline into <head> at build time (see vite.config.ts) so the
// right theme is set before first paint (design-spec section 5: no flash of the wrong theme).
// Unit tests execute this exact string, so there is a single source of truth for the logic.

export const STORAGE_KEY = 'meridian';

export type Appearance = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

// Plain ES5, no template expressions besides the storage key. Never throws.
export const THEME_BOOT_SCRIPT = `(function () {
  var dark = false;
  try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
  var appearance = 'system';
  try {
    var raw = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (raw) {
      var s = JSON.parse(raw);
      var v = s && s.settings && s.settings.appearance;
      if (v === 'light' || v === 'dark' || v === 'system') appearance = v;
    }
  } catch (e) {}
  var theme = appearance === 'system' ? (dark ? 'dark' : 'light') : appearance;
  document.documentElement.setAttribute('data-theme', theme);
})();`;
