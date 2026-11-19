// Add city (M4) on every engine: real search over the bundled data, each browser's own zone names,
// the polyfill path on WebKit, the native <dialog>, and the production CSP.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, cardNames, LOCAL, NOWHERE, seed, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const dialog = (page: Page, name = 'Add a city') => page.getByRole('dialog', { name });
const field = (page: Page) => page.getByRole('combobox', { name: 'Search cities' });
/**
 * A result row by its accessible name, given as the parts between its commas. Engines differ on
 * whether a space comes before each (visually hidden) comma.
 */
const option = (page: Page, ...parts: string[]) =>
  page.getByRole('option', {
    name: new RegExp(`^${parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(' ?, ')}`),
  });
const addCityButton = (page: Page) =>
  page.getByRole('region', { name: 'Controls' }).getByRole('button', { name: 'Add city' });

/** Opens the dialog from the keyboard, so every engine leaves focus on the button. */
async function openWithKeyboard(page: Page) {
  await addCityButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
}

test.describe('add city', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [LOCAL, TOKYO]);
  });

  test('fetches the city data only when the dialog opens', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (r) => {
      if (/\/cities\.v1-[^/]*\.json$/.test(new URL(r.url()).pathname)) fetched.push(r.url());
    });
    await page.goto('/');
    await expect(card(page, 'Tokyo')).toBeVisible();
    expect(fetched).toEqual([]);
    await addCityButton(page).click();
    await field(page).fill('london');
    await expect(option(page, 'London', 'England')).toBeVisible();
    expect(fetched).toHaveLength(1);
  });

  test('finds London as drawn, adds it with Enter, and stays open', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto('/');
    await openWithKeyboard(page);
    await expect(field(page)).toBeFocused();

    await field(page).fill('london');
    const london = option(page, 'London', 'England', 'United Kingdom');
    await expect(london).toContainText('3:43');
    await expect(london).toContainText('UTC+0:00 · GMT');
    await expect(london).toHaveAttribute('aria-selected', 'true');
    await expect(option(page, 'London', 'Ontario', 'Canada')).toContainText('UTC−5:00 · EST');

    await page.keyboard.press('Enter');
    await expect(london).toContainText('Added');
    await expect(london).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('London, England, United Kingdom, added.')).toBeAttached();
    await expect(dialog(page)).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(await cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
    await expect(addCityButton(page)).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  test('an ambiguous code: Istanbul’s airport, then the zones called IST', async ({ page }) => {
    await page.goto('/');
    await addCityButton(page).click();
    await field(page).fill('ist');
    const first = page.getByRole('option').first();
    await expect(first).toHaveAccessibleName(/^Istanbul ?, Airport IST ?, /);
    await expect(option(page, 'Kolkata', 'Time zone IST', 'West Bengal', 'India')).toBeVisible();
    await expect(option(page, 'Jerusalem', 'Time zone IST')).toBeVisible();
  });

  test('a zone abbreviation gets a header band', async ({ page }) => {
    await page.goto('/');
    await addCityButton(page).click();
    await field(page).fill('pst');
    await expect(dialog(page).getByText('Pacific Standard Time (PST) · UTC−8:00')).toBeVisible();
    await expect(page.getByRole('option').first()).toHaveAccessibleName(
      /^Los Angeles ?, California/,
    );
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.goto('/');
    await addCityButton(page).click();
    await field(page).fill('xyzzy');
    await expect(dialog(page).getByText('No cities match “xyzzy”').first()).toBeVisible();
    await expect(dialog(page).getByText(/airport code like LHR/)).toBeVisible();
  });

  test('Tab stays in the dialog, and Esc closes it and returns focus', async ({ page }) => {
    await page.goto('/');
    await openWithKeyboard(page);
    await field(page).fill('london');
    await expect(option(page, 'London', 'England')).toBeVisible();
    const inside: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      // Past the last control, focus may visit the browser's own UI; it never reaches the page.
      inside.push(
        await page.evaluate(
          () =>
            document.activeElement === document.body ||
            document.activeElement?.closest('dialog') !== null,
        ),
      );
    }
    expect(inside).toEqual([true, true, true, true, true, true]);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(addCityButton(page)).toBeFocused();
  });

  test('is a full-screen sheet on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto('/');
    await addCityButton(page).click();
    const box = await dialog(page).boundingBox();
    const viewport = page.viewportSize();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
    await expect(field(page)).toHaveAttribute(
      'placeholder',
      'City, country, airport, or time zone',
    );
  });

  test('keeps every control at least 44 by 44 pixels', async ({ page }) => {
    await page.goto('/');
    await addCityButton(page).click();
    await field(page).fill('london');
    await expect(option(page, 'London', 'England')).toBeVisible();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('dialog button, dialog [role=option]')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({
          name: el.getAttribute('aria-label') ?? el.textContent,
          r: el.getBoundingClientRect(),
        }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ name, r }) => `${name}: ${String(r.width)}x${String(r.height)}`),
    );
    expect(small).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await addCityButton(page).click();
      await field(page).fill('ist');
      await expect(page.getByRole('option').first()).toContainText('Airport IST');
      // The highlighted row and a tag are both on screen.
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe('from the empty list', () => {
  test('adding the first city focuses its card when the dialog closes', async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, []);
    await page.goto('/');
    await page
      .getByRole('region', { name: 'No clocks yet' })
      .getByRole('button', { name: 'Add city' })
      .click();
    await field(page).fill('tokyo');
    await expect(option(page, 'Tokyo', 'Tokyo', 'Japan')).toBeVisible();
    await option(page, 'Tokyo', 'Tokyo', 'Japan').click();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(card(page, 'Tokyo')).toBeFocused();
  });
});

test.describe('choose a zone (D14)', () => {
  test('replaces the unrecognised card in place', async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [LOCAL, NOWHERE, TOKYO]);
    await page.goto('/');
    await card(page, 'Olympus Mons').getByRole('button', { name: 'Choose a zone' }).click();
    await expect(dialog(page, 'Choose a zone')).toBeVisible();
    await expect(field(page)).toHaveValue('Olympus Mons');
    await field(page).fill('kolkata');
    await expect(option(page, 'Kolkata', 'West Bengal')).toContainText('Choose');
    await page.keyboard.press('Enter');
    await expect(dialog(page, 'Choose a zone')).toBeHidden();
    expect(await cardNames(page)).toEqual(['My Local Time', 'Kolkata', 'Tokyo']);
    await expect(card(page, 'Kolkata')).toBeFocused();
  });
});
