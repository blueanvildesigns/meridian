// Copy as text (M8) on every engine: live mode and the Jump banner, each engine's own zone rules
// (a DST-change day included), the toast, the text to copy by hand, the keyboard path, the phone's
// bar, and axe in both themes. The text's rules are unit-tested in src/ui/send/copyText.test.ts.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, KOLKATA, LOCAL, LONDON, NEW_YORK, seed, SYDNEY, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';
// 3:00 AM in New York on 2027-03-14, just after its clocks skipped 2:00–3:00 AM.
const DST_HASH = '#at=2027-03-14T07:00:00Z&ref=America/New_York&name=New%20York%20City';
const BOARD = [LOCAL, { ...NEW_YORK, customName: 'New York' }, LONDON, KOLKATA, TOKYO, SYDNEY];

const controls = (page: Page) => page.getByRole('region', { name: 'Controls' });
const copyButton = (page: Page) => controls(page).getByRole('button', { name: 'Copy as text' });
const toast = (page: Page) => page.getByText('Copied as text', { exact: true });
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

/** Replaces the clipboard with one that records what's written (every engine, no permissions). */
async function recordClipboard(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          w.__copied.push(text);
          return Promise.resolve();
        },
      },
    });
  });
}
/** Presses Tab until Copy as text has focus, as a person would; fails if it never does. */
async function tabToCopy(page: Page) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await copyButton(page).evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab never reached Copy as text');
}
const copied = (page: Page) =>
  page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, BOARD);
});

test.describe('copy as text', () => {
  test('live mode: the minute on screen, a line per card, and a link to it', async ({ page }) => {
    await recordClipboard(page);
    await page.goto('/');
    await expect(card(page, 'Sydney')).toBeVisible();
    await copyButton(page).click();
    await expect(toast(page)).toBeVisible();
    const origin = new URL(page.url()).origin;
    expect(await copied(page)).toEqual([
      [
        'My Local Time (America/Chicago): Tue, Nov 17, 9:43 PM CST',
        'New York: Tue, Nov 17, 10:43 PM EST',
        'London: Wed, Nov 18, 3:43 AM GMT',
        'Kolkata: Wed, Nov 18, 9:13 AM IST',
        'Tokyo: Wed, Nov 18, 12:43 PM JST',
        'Sydney: Wed, Nov 18, 2:43 PM AEDT',
        '',
        `${origin}/#at=2026-11-18T03:43:00Z&ref=America/Chicago`,
      ].join('\n'),
    ]);
  });

  test('the live link opens as a Jump to that moment', async ({ page }) => {
    await recordClipboard(page);
    await page.goto('/');
    await copyButton(page).click();
    const link = (await copied(page))[0]?.split('\n').at(-1) ?? '';
    await page.goto(link);
    await expect(page.getByRole('status', { name: /^Jumped/ })).toContainText(
      'Tue, Nov 17, 2026 · 9:43 PM in My Local Time',
    );
  });

  test('Jump banner: the jumped moment on a DST-change day, with the Jump’s link', async ({
    page,
  }) => {
    await recordClipboard(page);
    await page.goto(`/${DST_HASH}`);
    const buttons = await controls(page).getByRole('button').allTextContents();
    expect(buttons.slice(0, 4)).toEqual(['Copy link', 'Copy as text', 'Change', 'Reset to live']);
    await copyButton(page).click();
    await expect(toast(page)).toBeVisible();
    // Chicago hasn't changed yet at this instant; New York has.
    expect(await copied(page)).toEqual([
      [
        'My Local Time (America/Chicago): Sun, Mar 14, 1:00 AM CST',
        'New York: Sun, Mar 14, 3:00 AM EDT',
        'London: Sun, Mar 14, 7:00 AM GMT',
        'Kolkata: Sun, Mar 14, 12:30 PM IST',
        'Tokyo: Sun, Mar 14, 4:00 PM JST',
        'Sydney: Sun, Mar 14, 6:00 PM AEDT',
        '',
        page.url(),
      ].join('\n'),
    ]);
  });

  test('reaches the real clipboard (Chromium)', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium lets a test read the clipboard.');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/${TOKYO_HASH}`);
    await copyButton(page).click();
    await expect(toast(page)).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split('\n')).toEqual([
      'My Local Time (America/Chicago): Thu, Dec 3, 5:00 PM CST',
      'New York: Thu, Dec 3, 6:00 PM EST',
      'London: Thu, Dec 3, 11:00 PM GMT',
      'Kolkata: Fri, Dec 4, 4:30 AM IST',
      'Tokyo: Fri, Dec 4, 8:00 AM JST',
      'Sydney: Fri, Dec 4, 10:00 AM AEDT',
      '',
      page.url(),
    ]);
  });

  test('shows the text to copy by hand when there’s no clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await page.goto('/');
    await copyButton(page).click();
    const box = page.getByRole('textbox', { name: /Copy this text/ });
    await expect(box).toBeFocused();
    await expect(box).toHaveValue(
      /^My Local Time \(America\/Chicago\): Tue, Nov 17, 9:43 PM CST\n/,
    );
    await expect(toast(page)).toHaveCount(0);
  });

  test('works from the keyboard alone, in live mode and in the banner', async ({ page }) => {
    await recordClipboard(page);
    await page.goto('/');
    await expect(card(page, 'Sydney')).toBeVisible();
    await tabToCopy(page);
    await expect(copyButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toast(page)).toBeVisible();
    await expect(copyButton(page)).toBeFocused();

    // A fresh load, so Tab starts from the top of the page (a hash-only goto keeps the old spot).
    await page.goto(`/${TOKYO_HASH}`);
    await page.reload();
    await expect(page.getByRole('status', { name: /^Jumped/ })).toBeVisible();
    await tabToCopy(page);
    await page.keyboard.press('Space');
    await expect(toast(page)).toBeVisible();
    expect(await copied(page)).toHaveLength(1);
  });

  test('phones: an icon in the bar, named for screen readers, 48 px square', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto('/');
    const box = await copyButton(page).boundingBox();
    expect(box && [Math.round(box.width), Math.round(box.height)]).toEqual([48, 48]);
    // In the bar along the bottom, between Jump to a time and Add.
    const jump = await controls(page).getByRole('button', { name: 'Jump to a time' }).boundingBox();
    expect(Math.round(box?.y ?? 0)).toBe(Math.round(jump?.y ?? -1));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe('the phone bar', () => {
  // A fixed bar never widens the page, so the reflow check can't see it overflow: check each button.
  for (const width of [320, 360, 412]) {
    test(`fits its three buttons at ${String(width)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/');
      await expect(card(page, 'Sydney')).toBeVisible();
      const edges = await controls(page)
        .getByRole('button')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      expect(edges).toHaveLength(3);
      for (const right of edges) expect(right).toBeLessThanOrEqual(width - 16 + 0.5);
      for (const name of ['Jump to a time', 'Copy as text', 'Add city']) {
        const box = await controls(page).getByRole('button', { name }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations: toast, banner and the text to copy by hand (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      // A clipboard that works, until the tab says there's none.
      await page.addInitScript(() => {
        const value = sessionStorage.getItem('noClipboard')
          ? undefined
          : { writeText: () => Promise.resolve() };
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
      });
      await page.goto('/');
      await copyButton(page).click();
      await expect(toast(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await page.goto(`/${TOKYO_HASH}`);
      await copyButton(page).click();
      await expect(toast(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await page.evaluate(() => {
        sessionStorage.setItem('noClipboard', '1');
      });
      await page.reload();
      await copyButton(page).click();
      await expect(page.getByRole('textbox', { name: /Copy this text/ })).toBeFocused();
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});
