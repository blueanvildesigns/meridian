// Shared Playwright fixtures. Every spec imports `test` and `expect` from here.
import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Safari (27.x) ships without Temporal, but Playwright's WebKit build has it, so on its own the
 * WebKit project would never run the polyfill. Removing native Temporal before any page script runs
 * makes the WebKit project the Safari path: WebKit's engine and Intl data plus the polyfill (M3-15).
 */
export const test = base.extend<{ safariTemporal: undefined }>({
  safariTemporal: [
    async ({ context, browserName }, use) => {
      if (browserName === 'webkit') {
        await context.addInitScript(() => {
          Reflect.deleteProperty(globalThis, 'Temporal');
        });
      }
      await use(undefined);
    },
    { auto: true },
  ],
});
