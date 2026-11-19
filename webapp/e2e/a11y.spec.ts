// The release accessibility pass (M7, design-spec 6), on every engine: a whole session with the
// keyboard alone, the Tab order and a visible focus ring at every stop in both themes, reflow at
// 320 px, reduced motion, and axe on the screens no other spec covers. Where the rest are checked:
// main board, legacy zone and reordering (clocks), empty list and storage banner (clocks), add city
// (addCity), Jump picker, banner, skipped and repeated times and the time list (jump), card menu,
// rename and Undo toast (menu), Settings and About (settings), the shell in both themes (shell).
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, cardNames, LOCAL, LONDON, NOWHERE, seed, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const more = (page: Page, name: string) => button(page, `More options for ${name}`);
const focused = (target: Locator) => target.evaluate((el) => el === document.activeElement);

/** Presses Tab (or Shift+Tab) until `target` has focus, as a person would; fails if it never does. */
async function tabTo(page: Page, target: Locator, { back = false } = {}) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    if (await focused(target)) return;
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
});

test.describe('keyboard only', () => {
  test('a whole session: add, Jump, move, rename, remove and undo, Settings, About', async ({
    page,
  }) => {
    // A first visit: one My Local Time card (R-2).
    await page.goto('/');
    await expect(card(page, 'My Local Time')).toBeVisible();

    // Add London from the search, then close the dialog.
    await tabTo(page, button(page, 'Add city'));
    await page.keyboard.press('Enter');
    const addCity = page.getByRole('dialog', { name: 'Add a city' });
    await expect(addCity.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('london');
    await expect(addCity.getByRole('option').first()).toContainText('London');
    await page.keyboard.press('Enter');
    await expect(addCity.getByRole('option').first()).toContainText('Added');
    await page.keyboard.press('Escape');
    await expect(addCity).toBeHidden();
    await expect(button(page, 'Add city')).toBeFocused();
    expect(await cardNames(page)).toEqual(['My Local Time', 'London']);

    // Jump to 8:00 AM here, then back to live.
    await tabTo(page, button(page, 'Jump to a time'), { back: true });
    await page.keyboard.press('Enter');
    const picker = page.getByRole('dialog', { name: 'Jump to a time' });
    await expect(picker.getByLabel('Time is in')).toBeFocused();
    await tabTo(page, picker.getByLabel('Time', { exact: true }));
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('8:00 AM');
    await page.keyboard.press('Enter');
    await expect(picker).toBeHidden();
    const banner = page.getByRole('status', { name: /^Jumped/ });
    await expect(banner).toContainText('8:00 AM');
    await tabTo(page, button(page, 'Reset to live'));
    await page.keyboard.press('Enter');
    await expect(banner).toHaveCount(0);
    await expect(button(page, 'Jump to a time')).toBeFocused();

    // Move London up from its menu.
    await tabTo(page, more(page, 'London'));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Jump from here' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => cardNames(page)).toEqual(['London', 'My Local Time']);
    await expect(more(page, 'London')).toBeFocused();

    // Rename it.
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'City name' })).toBeFocused();
    await page.keyboard.type('Office');
    await page.keyboard.press('Enter');
    await expect(more(page, 'Office')).toBeFocused();

    // Remove it, then reach Undo with Tab before the toast goes.
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page, 'My Local Time')).toBeFocused();
    await tabTo(page, button(page, 'Undo'));
    await page.keyboard.press('Enter');
    await expect.poll(() => cardNames(page)).toEqual(['Office', 'My Local Time']);
    await expect(card(page, 'Office')).toBeFocused();

    // Settings: from the browser's format (a first visit's) to 24-hour, then close with Esc.
    await tabTo(page, button(page, 'Settings'), { back: true });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('radio', { name: 'Browser default' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: '24-hour' })).toBeChecked();
    await expect(card(page, 'My Local Time')).toContainText('21:43');
    await page.keyboard.press('Escape');
    await expect(button(page, 'Settings')).toBeFocused();

    // About, and back.
    await page.keyboard.press('Tab');
    await expect(button(page, 'About Meridian')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button(page, 'About Meridian')).toBeFocused();

    await page.reload();
    expect(await cardNames(page)).toEqual(['Office', 'My Local Time']);
    await expect(card(page, 'My Local Time')).toContainText('21:43');
  });

  test('Tab skips the add-city results: the arrow keys in the field move through them', async ({
    page,
  }) => {
    await seed(page, [LOCAL]);
    await page.goto('/');
    await button(page, 'Add city').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('ist');
    const dialog = page.getByRole('dialog', { name: 'Add a city' });
    await expect(dialog.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Clear search' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`Tab follows the layout, with a focus ring at every stop (${scheme})`, async ({
      page,
      isMobile,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await seed(page, [LOCAL, LONDON, TOKYO]);
      await page.goto('/');
      await expect(card(page, 'Tokyo')).toBeVisible();
      const stops: { name: string; ring: boolean }[] = [];
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          return {
            name: el.getAttribute('aria-label') ?? el.textContent.trim(),
            ring:
              el.matches(':focus-visible') &&
              style.outlineStyle === 'solid' &&
              parseFloat(style.outlineWidth) >= 2,
          };
        });
        if (!stop || stop.name === stops[0]?.name) break;
        stops.push(stop);
      }
      // The header's buttons, then Jump and Add (a bar along the bottom on phones, still next in
      // the Tab order), each card's handle and menu (phones have no handle), Add a city, the footer.
      const cards = ['My Local Time', 'London', 'Tokyo'].flatMap((name) =>
        isMobile
          ? [`More options for ${name}`]
          : [`Drag to reorder ${name}`, `More options for ${name}`],
      );
      expect(stops.map((s) => s.name)).toEqual([
        'Settings',
        'About Meridian',
        'Jump to a time',
        'Add city',
        ...cards,
        'Add a city',
        'About',
        'Support on Ko-fi',
      ]);
      expect(stops.filter((s) => !s.ring).map((s) => s.name)).toEqual([]);
    });
  }
});

test.describe('reflow at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  const fits = (page: Page) =>
    page.evaluate(() => {
      const wide = [...document.querySelectorAll('dialog[open]')].some(
        (d) => d.scrollWidth > d.clientWidth,
      );
      return !wide && document.documentElement.scrollWidth <= window.innerWidth;
    });

  test('nothing scrolls sideways: the list and every dialog', async ({ page }) => {
    await seed(page, [LOCAL, { ...LONDON, customName: 'Head office, London' }, TOKYO]);
    await page.goto('/');
    await expect(card(page, 'Tokyo')).toBeVisible();
    expect(await fits(page)).toBe(true);

    await button(page, 'Add city').click();
    await page.getByRole('combobox').fill('ist');
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await fits(page)).toBe(true);
    await page.keyboard.press('Escape');

    await button(page, 'Jump to a time').click();
    await expect(page.getByRole('dialog', { name: 'Jump to a time' })).toBeVisible();
    expect(await fits(page)).toBe(true);
    await page.keyboard.press('Escape');

    await more(page, 'Tokyo').click();
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await fits(page)).toBe(true);
    await page.keyboard.press('Escape');

    await button(page, 'Settings').click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(await fits(page)).toBe(true);
    await page.keyboard.press('Escape');

    await button(page, 'About Meridian').click();
    await expect(page.getByRole('dialog', { name: 'About' })).toBeVisible();
    expect(await fits(page)).toBe(true);
  });
});

test('reduced motion stops the reordering animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [LOCAL, LONDON]);
  await page.goto('/');
  // dnd-kit animates cards making room with an inline transition; base.css cuts every transition.
  const seconds = await card(page, 'London').evaluate((el) => {
    const item = el.closest('li') as HTMLElement;
    item.style.transition = 'transform 250ms ease';
    return parseFloat(getComputedStyle(item).transitionDuration);
  });
  expect(seconds).toBeLessThan(0.001);
});

test.describe('axe on the remaining screens', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(scheme, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
      });

      test('add city: nothing matches, then a city added', async ({ page }) => {
        await seed(page, [LOCAL]);
        await page.goto('/');
        await button(page, 'Add city').click();
        const dialog = page.getByRole('dialog', { name: 'Add a city' });
        await dialog.getByRole('combobox').fill('xyzzy');
        await expect(dialog.getByText('No cities match “xyzzy”').first()).toBeVisible();
        expect((await axe(page)).violations).toEqual([]);
        await dialog.getByRole('combobox').fill('london');
        await page.keyboard.press('Enter');
        await expect(dialog.getByRole('option').first()).toContainText('Added');
        expect((await axe(page)).violations).toEqual([]);
      });

      test('choose a zone for an unrecognised card', async ({ page }) => {
        await seed(page, [LOCAL, NOWHERE]);
        await page.goto('/');
        await card(page, 'Olympus Mons').getByRole('button', { name: 'Choose a zone' }).click();
        const dialog = page.getByRole('dialog', { name: 'Choose a zone' });
        await dialog.getByRole('combobox').fill('kolkata');
        await expect(dialog.getByRole('option').first()).toContainText('Choose');
        expect((await axe(page)).violations).toEqual([]);
      });

      test('copy link: copied, and the link to copy by hand', async ({ page }) => {
        await seed(page, [LOCAL, TOKYO]);
        // A clipboard that works, until the tab says there's none.
        await page.addInitScript(() => {
          const value = sessionStorage.getItem('noClipboard')
            ? undefined
            : { writeText: () => Promise.resolve() };
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
        });
        await page.goto('/#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo');
        await button(page, 'Copy link').click();
        await expect(button(page, 'Link copied')).toBeVisible();
        expect((await axe(page)).violations).toEqual([]);

        await page.evaluate(() => {
          sessionStorage.setItem('noClipboard', '1');
        });
        await page.reload();
        await button(page, 'Copy link').click();
        await expect(page.getByRole('textbox', { name: /Copy this link/ })).toBeFocused();
        expect((await axe(page)).violations).toEqual([]);
      });

      test('the notice about unreadable saved data (R-17)', async ({ page }) => {
        await page.addInitScript(() => {
          if (sessionStorage.getItem('seeded')) return;
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('meridian', '{not json');
        });
        await page.goto('/');
        await expect(page.getByRole('alert')).toContainText('couldn’t be read');
        expect((await axe(page)).violations).toEqual([]);
      });

      test('the not-found page', async ({ page }) => {
        const response = await page.goto('/missing.txt');
        expect(response?.status()).toBe(404);
        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
        expect((await axe(page)).violations).toEqual([]);
      });
    });
  }
});
