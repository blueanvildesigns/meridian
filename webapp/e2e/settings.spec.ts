// Settings and About (M6) on every engine: changes apply at once and survive a reload, the theme
// follows Appearance, About's links and "What can I do?", and axe in both themes.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, LOCAL, LONDON, seed } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const about = (page: Page) => page.getByRole('dialog', { name: 'About' });
const radio = (page: Page, name: string) => settings(page).getByRole('radio', { name });
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, [LOCAL, LONDON]);
});

test.describe('Settings', () => {
  test('time format applies at once and is kept', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(radio(page, '12-hour')).toBeFocused();
    await expect(settings(page)).toContainText('Example: 9:43 PM');
    await radio(page, '24-hour').check();
    await expect(settings(page)).toContainText('Example: 21:43');
    await expect(card(page, 'London')).toContainText('03:43');
    await settings(page).getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
    await page.reload();
    await expect(card(page, 'My Local Time')).toContainText('21:43');
  });

  test('the arrow keys move between choices', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, '24-hour')).toBeChecked();
    await expect(card(page, 'London')).toContainText('03:43');
  });

  test('appearance switches the theme at once and is kept', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await theme(page)).toBe('light');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(settings(page)).toContainText('Matches your device. It is currently Light.');
    await radio(page, 'Dark').check();
    await expect.poll(() => theme(page)).toBe('dark');
    await expect(settings(page)).toContainText('Always use the dark appearance.');
    await page.keyboard.press('Escape');
    await page.reload();
    expect(await theme(page)).toBe('dark');
    // Back to System follows the device again.
    await page.getByRole('button', { name: 'Settings' }).click();
    await radio(page, 'System').check();
    await expect.poll(() => theme(page)).toBe('light');
  });

  test('is as tall as its content on wide screens', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones get a full-screen sheet.');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    const box = await settings(page).boundingBox();
    // About 440 px drawn (canvas Settings); a modal dialog stretches to the window if let.
    expect(box?.height).toBeLessThan(480);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.getByRole('button', { name: 'Settings' }).click();
      await expect(settings(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});

test.describe('About', () => {
  test('credits the data and links out safely', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'About Meridian' }).click();
    await expect(about(page)).toContainText(/Version 1\.0\.0 \(\w+\)/);
    await expect(about(page).getByRole('link', { name: 'GeoNames' })).toHaveAttribute(
      'href',
      'https://www.geonames.org/',
    );
    await expect(about(page).getByRole('link', { name: 'OurAirports' })).toBeVisible();
    await expect(about(page).getByRole('link', { name: 'Support on Ko-fi' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    // Phones close the sheet with the X; Done is for wide screens (canvas AboutPhone).
    const done = about(page).getByRole('button', { name: 'Done' });
    if (isMobile) await expect(done).toBeHidden();
    else await expect(done).toBeVisible();
    await about(page).getByRole('button', { name: 'Close' }).click();
    await expect(about(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'About Meridian' })).toBeFocused();
  });

  test('opens on "Your data" from the storage banner', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
    });
    await page.goto('/');
    await page.getByRole('alert').getByRole('button', { name: 'What can I do?' }).click();
    await expect(
      about(page).getByRole('heading', { name: 'Your data stays with you' }),
    ).toBeFocused();
    await expect(about(page)).toContainText('private browsing');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await page.getByRole('button', { name: 'About Meridian' }).click();
      await expect(about(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});
