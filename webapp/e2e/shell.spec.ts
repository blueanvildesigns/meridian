import { expect, test } from './fixtures';
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

test('loads the Latin Extended fonts only for text that needs them (M7-2)', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (req) => {
    const file = new URL(req.url()).pathname.split('/').pop() ?? '';
    if (file.endsWith('.woff2')) fonts.push(file.replace(/-normal-.*$/, ''));
  });
  const settle = async () => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
  };
  await page.goto('/');
  await settle();
  // The five weights in use (Serif 500/600, Sans 400/500/600), Latin only.
  expect(fonts.toSorted()).toEqual([
    'ibm-plex-sans-latin-400',
    'ibm-plex-sans-latin-500',
    'ibm-plex-sans-latin-600',
    'ibm-plex-serif-latin-500',
    'ibm-plex-serif-latin-600',
  ]);
  // A name with Polish letters needs Latin Extended, in the weight it's drawn in.
  await page.evaluate(() => {
    const name = document.createElement('p');
    name.style.fontWeight = '500';
    name.textContent = 'Łódź';
    document.body.append(name);
  });
  await settle();
  expect(fonts.filter((f) => f.includes('latin-ext'))).toEqual(['ibm-plex-sans-latin-ext-500']);
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
