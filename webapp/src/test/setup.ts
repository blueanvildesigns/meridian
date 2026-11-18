import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { loadTemporal } from '../time/temporal';

// The "polyfill" test project removes native Temporal first, so the same suite exercises the
// polyfill exactly as Safari will (decision M1-1).
if (process.env.MERIDIAN_TEMPORAL === 'polyfill') {
  Reflect.deleteProperty(globalThis, 'Temporal');
}
await loadTemporal();

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
