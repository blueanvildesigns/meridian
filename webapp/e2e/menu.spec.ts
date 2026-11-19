// The card menu (M6) on every engine: the popover and the phone sheet, keyboard use, Move up and
// down, Remove with Undo, Rename in place, Jump from here, the production CSP, and axe.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, cardNames, LOCAL, LONDON, seed, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const savedCities = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem('meridian') ?? '{}') as {
          cities: { id: string; customName?: string }[];
        }
      ).cities,
  );
const more = (page: Page, name: string) =>
  page.getByRole('button', { name: `More options for ${name}` });
const menu = (page: Page) => page.getByRole('menu');
const item = (page: Page, name: string) => menu(page).getByRole('menuitem', { name });
const toast = (page: Page) => page.getByText(/ removed$/);
const undo = (page: Page) => page.getByRole('button', { name: 'Undo' });
const renameField = (page: Page) => page.getByRole('textbox', { name: 'City name' });
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, [LOCAL, LONDON, TOKYO]);
});

test.describe('card menu', () => {
  test('opens under its button on wide screens, as a sheet on phones', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await more(page, 'London').click();
    const dialog = page.getByRole('dialog', { name: 'Options for London' });
    await expect(dialog).toBeVisible();
    await expect(item(page, 'Jump from here')).toBeFocused();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('missing layout');
    if (isMobile) {
      // A bottom sheet, full width, with the card's name and time in its header.
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.width)).toBe(viewport.width);
      expect(Math.round(box.y + box.height)).toBe(viewport.height);
      await expect(dialog).toContainText('United Kingdom · 3:43 AM');
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    } else {
      // 224 px wide, hanging from the button, right edges lined up.
      const button = await more(page, 'London').boundingBox();
      if (!button) throw new Error('missing layout');
      expect(Math.round(box.width)).toBe(224);
      expect(Math.round(box.y)).toBe(Math.round(button.y + button.height));
      expect(Math.round(box.x + box.width)).toBe(Math.round(button.x + button.width));
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeHidden();
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(more(page, 'London')).toBeFocused();
  });

  test('works from the keyboard: arrows, Move down, focus back on the button', async ({ page }) => {
    await page.goto('/');
    await more(page, 'London').focus();
    await page.keyboard.press('Enter');
    await expect(item(page, 'Jump from here')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(item(page, 'Move down')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
    await expect(more(page, 'London')).toBeFocused();
    await expect(page.getByText('London moved to position 3 of 3.')).toBeAttached();
    expect((await savedCities(page)).map((c) => c.id)).toEqual(['local', 'tyo', 'lon']);
    await page.reload();
    expect(await cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
  });

  test('Move up is unavailable on the first card', async ({ page }) => {
    await page.goto('/');
    await more(page, 'My Local Time').click();
    await expect(item(page, 'Move up')).toHaveAttribute('aria-disabled', 'true');
    // Playwright won't press a control marked disabled unless forced; a person can.
    await item(page, 'Move up').click({ force: true });
    await expect(menu(page)).toBeVisible();
    expect(await cardNames(page)).toEqual(['My Local Time', 'London', 'Tokyo']);
  });

  test('Remove offers Undo, which puts the card back', async ({ page, isMobile }) => {
    await page.goto('/');
    await more(page, 'London').click();
    await item(page, 'Remove').click();
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Tokyo']);
    await expect(card(page, 'Tokyo')).toBeFocused();
    await expect(toast(page)).toHaveText('London removed');
    if (isMobile) {
      // Clear of the fixed Jump and Add bar.
      const t = await undo(page).boundingBox();
      const bar = await page.getByRole('button', { name: 'Add city' }).boundingBox();
      if (!t || !bar) throw new Error('missing layout');
      expect(t.y + t.height).toBeLessThan(bar.y);
    }
    await undo(page).click();
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'London', 'Tokyo']);
    await expect(card(page, 'London')).toBeFocused();
    await expect(toast(page)).toHaveCount(0);
    expect((await savedCities(page)).map((c) => c.id)).toEqual(['local', 'lon', 'tyo']);
  });

  test('the Undo toast goes after 8 seconds', async ({ page, isMobile }) => {
    await page.clock.install({ time: BOARD_TIME });
    await page.goto('/');
    await more(page, 'London').click();
    // A tap on phones: a click leaves the mouse where the toast appears, which pauses it.
    if (isMobile) await item(page, 'Remove').tap();
    else await item(page, 'Remove').click();
    await expect(toast(page)).toBeVisible();
    await page.clock.runFor(7_000);
    await expect(toast(page)).toBeVisible();
    await page.clock.runFor(1_500);
    await expect(toast(page)).toHaveCount(0);
    expect(await cardNames(page)).toEqual(['My Local Time', 'Tokyo']);
  });

  test('Rename edits the name in place; Enter saves, Esc cancels', async ({ page }) => {
    await page.goto('/');
    await more(page, 'London').click();
    await item(page, 'Rename').click();
    await expect(renameField(page)).toBeFocused();
    await expect(renameField(page)).toHaveValue('London');
    // The whole name is selected, so typing replaces it.
    await page.keyboard.type('Head office');
    await page.keyboard.press('Enter');
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Head office', 'Tokyo']);
    await expect(more(page, 'Head office')).toBeFocused();
    expect((await savedCities(page))[1]).toMatchObject({ id: 'lon', customName: 'Head office' });

    await more(page, 'Head office').click();
    await item(page, 'Rename').click();
    await page.keyboard.type('Nope');
    await page.keyboard.press('Escape');
    await expect(renameField(page)).toHaveCount(0);
    expect(await cardNames(page)).toEqual(['My Local Time', 'Head office', 'Tokyo']);
    await page.reload();
    expect(await cardNames(page)).toEqual(['My Local Time', 'Head office', 'Tokyo']);
  });

  test('Jump from here opens Jump set to the card', async ({ page }) => {
    await page.goto('/');
    await more(page, 'Tokyo').click();
    await item(page, 'Jump from here').click();
    const picker = page.getByRole('dialog', { name: 'Jump to a time' });
    await expect(picker).toBeVisible();
    const from = await picker
      .getByLabel('Time is in')
      .evaluate((s) => (s as HTMLSelectElement).selectedOptions[0]?.textContent);
    expect(from).toMatch(/^Tokyo/);
    await page.keyboard.press('Escape');
    await expect(more(page, 'Tokyo')).toBeFocused();
  });

  test('runs under the production CSP', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto('/');
    await more(page, 'London').click();
    await item(page, 'Rename').click();
    await page.keyboard.type('Office');
    await page.keyboard.press('Enter');
    await more(page, 'Office').click();
    await item(page, 'Move down').click();
    await more(page, 'Office').click();
    await item(page, 'Remove').click();
    await undo(page).click();
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'Office']);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations: menu, rename and toast (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await more(page, 'London').click();
      await expect(menu(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await item(page, 'Rename').click();
      await expect(renameField(page)).toBeFocused();
      expect((await axe(page)).violations).toEqual([]);
      await page.keyboard.press('Escape');

      await more(page, 'Tokyo').click();
      await item(page, 'Remove').click();
      await expect(toast(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);
    });
  }

  test('keeps every menu control at least 44 by 44 pixels', async ({ page }) => {
    await page.goto('/');
    await more(page, 'London').click();
    await expect(menu(page)).toBeVisible();
    const small = await page.getByRole('dialog').evaluate((dialog) =>
      [...dialog.querySelectorAll('button')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ name: el.textContent, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ name, r }) => `${name}: ${String(r.width)}x${String(r.height)}`),
    );
    expect(small).toEqual([]);
  });
});
