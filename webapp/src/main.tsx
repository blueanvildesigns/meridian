import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { readStoredAppearance, syncThemeWithSystem } from './app/theme';

// The inline boot script has already set data-theme before first paint.
// Keep following the OS while Appearance is "System". (Settings wiring arrives in M6.)
syncThemeWithSystem(() => {
  try {
    return readStoredAppearance(window.localStorage);
  } catch {
    return 'system';
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
