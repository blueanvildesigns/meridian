// DST heads-up (M10) on every engine: the live chip from each engine's zone rules (WebKit runs the
// polyfill), the Jump chips and banner line, the layout drawn on DstLive and DstJump (a grid row's
// cards grow to match), the phone's extra row (M10-4), reflow at 320 px, the keyboard path, and axe
// in both themes. The rules are unit-tested in src/time/dst.test.ts and src/ui/clock.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { card, KOLKATA, LOCAL, LONDON, NEW_YORK, place, seed, SYDNEY, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

// Canvas DstLive: Fri, Mar 5, 2027, 4:00 PM in Chicago.
const DST_LIVE = new Date('2027-03-05T22:00:00Z');
// Two months on: no clock changes within 14 days.
const QUIET = new Date('2027-05-05T21:00:00Z');
// Canvas DstJump: Tue, Mar 30, 2027, 9:00 AM in New York.
const DST_JUMP = '#at=2027-03-30T13:00:00Z&ref=America/New_York&name=New%20York%20City';
const BOARD = [LOCAL, { ...NEW_YORK, customName: 'New York' }, LONDON, KOLKATA, TOKYO, SYDNEY];
const LORD_HOWE = place(
  'lhi',
  'Australia/Lord_Howe',
  2160063,
  'Lord Howe Island',
  'AU',
  'Australia',
  -31.6,
  159.1,
);

/** The chip's words. */
const chip = (page: Page, name: string) =>
  card(page, name).getByText(/^(Clocks change|.+ then · .+ today$)/);
/** The whole chip: its icon and words. */
const pill = (page: Page, name: string) => chip(page, name).locator('xpath=..');
const LINE = 'Clocks differ from today in My Local Time, New York and London.';
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

async function box(selector: ReturnType<Page['locator']>) {
  const b = await selector.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(DST_LIVE);
  await seed(page, BOARD);
});

test.describe('DST heads-up', () => {
  test('live: a chip on the cards whose clocks change within 14 days', async ({ page }) => {
    await page.goto('/');
    await expect(chip(page, 'My Local Time')).toHaveText('Clocks change Sun, Mar 14');
    await expect(chip(page, 'New York')).toHaveText('Clocks change Sun, Mar 14');
    for (const name of ['London', 'Kolkata', 'Tokyo', 'Sydney']) {
      await expect(chip(page, name)).toHaveCount(0);
    }
  });

  test('live: no chip when nothing changes soon', async ({ page }) => {
    await page.clock.setFixedTime(QUIET);
    await page.goto('/');
    await expect(card(page, 'Sydney')).toBeVisible();
    await expect(page.getByText(/Clocks change/)).toHaveCount(0);
  });

  test('desktop: between the time and the footer; the row’s cards grow to match', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop layout only.');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const ny = card(page, 'New York');
    const london = card(page, 'London');
    const time = await box(ny.getByText('5:00', { exact: true }));
    const dst = await box(pill(page, 'New York'));
    const footer = await box(ny.getByText('UTC−5:00'));
    expect(dst.y).toBeGreaterThan(time.y + time.height - 1);
    expect(footer.y).toBeGreaterThan(dst.y + dst.height);
    // New York and London share a row: the same height, their footers level, and London's time
    // where it always is (the extra space sits above its footer).
    const [nyCard, londonCard] = [await box(ny), await box(london)];
    expect(londonCard.y).toBeCloseTo(nyCard.y, 0);
    expect(londonCard.height).toBeCloseTo(nyCard.height, 0);
    const londonFooter = await box(london.getByText('UTC+0:00'));
    expect(londonFooter.y).toBeCloseTo(footer.y, 0);
    const londonTime = await box(london.getByText('10:00', { exact: true }));
    expect(londonTime.y).toBeCloseTo(time.y, 0);
    // The chip is drawn amber, with its icon, left-aligned under the time.
    expect(dst.x).toBeCloseTo(time.x, 0);
    await expect(pill(page, 'New York').locator('svg')).toHaveCount(1);
  });

  test('phones: a row of its own under the time, the card otherwise compact', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto('/');
    const ny = card(page, 'New York');
    const time = await box(ny.getByText('5:00', { exact: true }));
    const details = await box(ny.getByText('UTC−5:00 · +1h'));
    const dst = await box(pill(page, 'New York'));
    expect(dst.y).toBeGreaterThan(Math.max(time.y + time.height, details.y + details.height) - 1);
    expect(dst.x).toBeCloseTo(time.x, 0);
    // Only the cards with a chip get taller.
    const [nyCard, londonCard] = [await box(ny), await box(card(page, 'London'))];
    expect(nyCard.height).toBeGreaterThan(londonCard.height + 20);
  });

  test('jump: "then · today" chips, and the banner names those cities', async ({ page }) => {
    await page.goto(`/${DST_JUMP}`);
    await expect(chip(page, 'My Local Time')).toHaveText('CDT then · CST today');
    await expect(chip(page, 'New York')).toHaveText('EDT then · EST today');
    await expect(chip(page, 'London')).toHaveText('BST then · GMT today');
    for (const name of ['Kolkata', 'Tokyo', 'Sydney']) {
      await expect(chip(page, name)).toHaveCount(0);
    }
    // Kolkata's difference changes with My Local Time's, so the banner explains it.
    await expect(card(page, 'Kolkata').getByText('+10h 30m')).toBeVisible();
    await expect(page.getByText(LINE)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Jumped' })).toHaveAccessibleName(
      new RegExp(`${LINE.replace('.', '\\.')}$`),
    );
  });

  test('reflows at 320 px, a long chip wrapping inside its card', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await seed(page, []);
    await page.addInitScript(
      (cities) => {
        localStorage.setItem(
          'meridian',
          JSON.stringify({
            schemaVersion: 1,
            cities,
            settings: { timeFormat: '12', appearance: 'system' },
          }),
        );
      },
      [LORD_HOWE, LOCAL],
    );
    // Winter on Lord Howe: half an hour behind today. Browsers name it LHST and LHDT; without
    // those names it would be the longest chip, "UTC+10:30 then · UTC+11:00 today".
    await page.goto('/#at=2027-06-01T00:00:00Z&ref=Australia/Lord_Howe&name=Lord%20Howe%20Island');
    const lh = card(page, 'Lord Howe Island');
    await expect(chip(page, 'Lord Howe Island')).toHaveText(
      /^(LHST|UTC\+10:30) then · (LHDT|UTC\+11:00) today$/,
    );
    const [c, d] = [await box(lh), await box(pill(page, 'Lord Howe Island'))];
    expect(d.x + d.width).toBeLessThanOrEqual(c.x + c.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('keyboard: the chips add no stops; the Tab order is the same with and without them', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Phones are tested by touch; the Tab order is checked on desktop.');
    const stops = async () => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      const names: string[] = [];
      for (let i = 0; i < 24; i += 1) {
        await page.keyboard.press('Tab');
        names.push(
          await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return 'BODY';
            return `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent}`;
          }),
        );
      }
      return names;
    };
    await page.goto('/');
    await expect(chip(page, 'New York')).toBeVisible();
    const withChips = await stops();
    await page.clock.setFixedTime(QUIET);
    await page.reload();
    await expect(page.getByText(/Clocks change/)).toHaveCount(0);
    expect(await stops()).toEqual(withChips);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations: live chips and a Jump's (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await expect(chip(page, 'New York')).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await page.goto(`/${DST_JUMP}`);
      await page.reload();
      await expect(page.getByText(LINE)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});
