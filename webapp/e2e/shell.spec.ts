import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('renders the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Meridian' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Support on Ko-fi' })).toBeVisible();
});

test('makes no third-party requests', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const foreign: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== origin) foreign.push(req.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Fonts must have loaded from our own origin.
  expect(await page.evaluate(() => document.fonts.check('600 30px "IBM Plex Serif"'))).toBe(true);
  expect(foreign).toEqual([]);
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} system theme`, () => {
    test.use({ colorScheme: scheme });

    test('sets data-theme before React mounts', async ({ page }) => {
      await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          (window as unknown as { __themeAtDcl: string | null }).__themeAtDcl =
            document.documentElement.getAttribute('data-theme');
        });
      });
      await page.goto('/');
      const atDcl = await page.evaluate(
        () => (window as unknown as { __themeAtDcl: string | null }).__themeAtDcl,
      );
      expect(atDcl).toBe(scheme);
    });

    test('has no axe violations', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test('a stored Appearance override beats the system setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    localStorage.setItem(
      'meridian',
      JSON.stringify({ schemaVersion: 1, cities: [], settings: { appearance: 'dark' } }),
    );
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('follows a live system theme change while Appearance is System', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
