import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { bugReportServiceFromEnv } from './app/bugReportClient';
import { createStore } from './app/store';
import { applyTheme, resolveTheme, syncThemeWithSystem, systemPrefersDark } from './app/theme';
import { STORAGE_KEY } from './storage/schema';
import { loadState, openStorage } from './storage/storage';
import { loadTemporal } from './time/temporal';

async function start(root: HTMLElement) {
  // Native Temporal, or the polyfill on engines without it (Safari): needed before any clock renders.
  try {
    await loadTemporal();
  } catch (error) {
    root.textContent = 'Meridian couldn’t start. Check your connection, then reload the page.';
    throw error;
  }

  const storage = openStorage();
  const store = createStore(storage, loadState(storage));

  // The inline boot script set data-theme before first paint. From here on, follow the OS while
  // Appearance is "System", and apply a changed setting (Settings in M6, or another tab).
  const appearance = () => store.getSnapshot().state.settings.appearance;
  syncThemeWithSystem(appearance);
  let applied = appearance();
  store.subscribe(() => {
    if (appearance() === applied) return;
    applied = appearance();
    applyTheme(resolveTheme(applied, systemPrefersDark()));
  });

  // Another tab saved: show its list here too, so the next change here doesn't overwrite it.
  if (storage) {
    window.addEventListener('storage', (event) => {
      if (event.key === null || event.key === STORAGE_KEY) store.reload();
    });
  }

  createRoot(root).render(
    <StrictMode>
      <App store={store} reportBug={bugReportServiceFromEnv(import.meta.env)} />
    </StrictMode>,
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
void start(root);
