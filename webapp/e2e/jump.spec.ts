// Jump (M5) on every engine: the picker, each browser's own zone rules for skipped and repeated
// times, the URL hash with Back and Forward, Copy link, the production CSP, and axe.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, card, KOLKATA, LOCAL, LONDON, NEW_YORK, seed, SYDNEY, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';
const BOARD = [LOCAL, { ...NEW_YORK, customName: 'New York' }, LONDON, KOLKATA, TOKYO, SYDNEY];

const picker = (page: Page) => page.getByRole('dialog', { name: 'Jump to a time' });
const controls = (page: Page) => page.getByRole('region', { name: 'Controls' });
const jumpButton = (page: Page) => controls(page).getByRole('button', { name: 'Jump to a time' });
/** The banner's text; its buttons sit beside it in the Controls row. */
const banner = (page: Page) => page.getByRole('status', { name: /^Jumped/ });
const timeField = (page: Page) => picker(page).getByLabel('Time', { exact: true });

async function fill(page: Page, city: string, date: string, time: string) {
  await picker(page).getByLabel('Time is in').selectOption({ label: city });
  await picker(page).getByLabel('Date').fill(date);
  await timeField(page).fill(time);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, BOARD);
});

test.describe('jump', () => {
  test('applies a Jump as drawn: banner, paused clocks, reference tag', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto('/');
    await jumpButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(picker(page).getByLabel('Time is in')).toBeFocused();
    await expect(
      picker(page).getByText('That moment is Wed, Nov 18, 2026 · 3:43 AM UTC.'),
    ).toBeVisible();

    await fill(page, 'Tokyo', '2026-12-04', '8:00 AM');
    await expect(
      picker(page).getByText('That moment is Thu, Dec 3, 2026 · 11:00 PM UTC.'),
    ).toBeVisible();
    await timeField(page).press('Enter');

    await expect(picker(page)).toBeHidden();
    expect(new URL(page.url()).hash).toBe(TOKYO_HASH);
    await expect(banner(page)).toContainText('Fri, Dec 4, 2026 · 8:00 AM in Tokyo');
    await expect(banner(page)).toBeFocused();
    await expect(card(page, 'Tokyo')).toContainText('Jump reference');
    await expect(card(page, 'Tokyo')).toContainText('8:00');
    await expect(card(page, 'Tokyo')).toContainText('Next day');
    await expect(card(page, 'My Local Time')).toContainText('5:00');
    await expect(card(page, 'My Local Time')).toContainText('Same day');
    await expect(card(page, 'Sydney')).toContainText('10:00');
    await expect(card(page, 'Sydney')).toContainText('AEDT');
    await expect(card(page, 'London')).not.toContainText('Jump reference');
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  test('Back returns to live and Forward to the Jump', async ({ page }) => {
    await page.goto('/');
    await jumpButton(page).click();
    await fill(page, 'Tokyo', '2026-12-04', '8:00 AM');
    await picker(page).getByRole('button', { name: 'Apply' }).click();
    await expect(banner(page)).toBeVisible();

    await page.goBack();
    await expect(page.getByText('Showing the current time')).toBeVisible();
    await expect(card(page, 'Tokyo')).toContainText('12:43');
    await page.goForward();
    await expect(banner(page)).toContainText('8:00 AM in Tokyo');
  });

  test('a shared link opens the Jump and survives a reload', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await expect(banner(page)).toContainText('Fri, Dec 4, 2026 · 8:00 AM in Tokyo');
    await page.reload();
    await expect(card(page, 'Tokyo')).toContainText('Jump reference');
    await page.goto('/');
    await expect(page.getByText('Showing the current time')).toBeVisible();
  });

  test('Change keeps the reference; Reset to live focuses Jump to a time', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await controls(page).getByRole('button', { name: 'Change' }).click();
    await expect(picker(page).getByLabel('Time is in')).toHaveValue(TOKYO.id);
    await expect(timeField(page)).toHaveValue('8:00 AM');
    await timeField(page).fill('9:30 pm');
    await picker(page).getByRole('button', { name: 'Apply' }).click();
    await expect(banner(page)).toContainText('Fri, Dec 4, 2026 · 9:30 PM in Tokyo');

    await controls(page).getByRole('button', { name: 'Reset to live' }).click();
    await expect(jumpButton(page)).toBeFocused();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a skipped time offers the fix, with this browser’s zone rules', async ({ page }) => {
    await page.goto('/');
    await jumpButton(page).click();
    await fill(page, 'New York', '2027-03-14', '2:30 AM');
    const alert = picker(page).getByRole('alert');
    await expect(alert).toContainText('2:30 AM doesn’t exist in New York on Mar 14, 2027.');
    await expect(picker(page).getByRole('button', { name: 'Apply' })).toBeDisabled();
    await alert.getByRole('button', { name: 'Use 3:00 AM instead' }).click();
    await expect(timeField(page)).toHaveValue('3:00 AM');
    await expect(timeField(page)).toBeFocused();
    await picker(page).getByRole('button', { name: 'Apply' }).click();
    expect(new URL(page.url()).hash).toBe(
      '#at=2027-03-14T07:00:00Z&ref=America/New_York&name=New%20York%20City',
    );
  });

  test('a repeated time asks which, and keeps the answer', async ({ page }) => {
    await page.goto('/');
    await jumpButton(page).click();
    await fill(page, 'New York', '2027-11-07', '1:30 AM');
    const group = picker(page).getByRole('group', { name: 'Which 1:30 AM?' });
    await expect(group.getByRole('radio', { name: /^1:30 AM EDT/ })).toBeChecked();
    await group.getByRole('radio', { name: /^1:30 AM EST/ }).check();
    await picker(page).getByRole('button', { name: 'Apply' }).click();
    expect(new URL(page.url()).hash).toContain('at=2027-11-07T06:30:00Z');
    await expect(card(page, 'New York')).toContainText('1:30');
    await expect(card(page, 'New York')).toContainText('EST');
  });

  test('Esc closes the picker and returns focus', async ({ page }) => {
    await page.goto('/');
    await jumpButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker(page)).toBeHidden();
    await expect(jumpButton(page)).toBeFocused();
  });

  test('picks a time from the list with the keyboard; Esc closes the list first', async ({
    page,
  }) => {
    await page.goto('/');
    await jumpButton(page).click();
    const list = picker(page).getByRole('listbox', { name: 'Times' });
    await timeField(page).focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect(list.getByRole('option', { selected: true })).toHaveText('9:30 PM');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(timeField(page)).toHaveValue('10:00 PM');
    await expect(list).toBeHidden();
    await expect(picker(page)).toBeVisible();

    await timeField(page).fill('8p');
    await expect(list.getByRole('option')).toHaveText([/^8:00 PM/, /^8:30 PM/]);
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(picker(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker(page)).toBeHidden();
    await expect(jumpButton(page)).toBeFocused();
  });

  test('picks a time with a click or a tap, under or over the field', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    await jumpButton(page).click();
    const toggle = picker(page).getByRole('button', { name: 'Show times' });
    const list = picker(page).getByRole('listbox', { name: 'Times' });
    if (isMobile) await toggle.tap();
    else await toggle.click();
    await expect(list).toBeVisible();
    // A tap leaves the phone's keyboard down; a click puts focus in the field for the arrow keys.
    if (isMobile) await expect(timeField(page)).not.toBeFocused();
    else await expect(timeField(page)).toBeFocused();

    const field = await picker(page).locator('div:has(> [role="combobox"])').boundingBox();
    const box = await list.boundingBox();
    const viewport = page.viewportSize();
    if (!field || !box || !viewport) throw new Error('not laid out');
    expect(Math.abs(box.x - field.x)).toBeLessThan(1);
    expect(Math.abs(box.width - field.width)).toBeLessThan(1);
    expect(box.y >= field.y + field.height || box.y + box.height <= field.y).toBe(true);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    const option = list.getByRole('option', { name: '7:00 AM' });
    if (isMobile) await option.tap();
    else await option.click();
    await expect(timeField(page)).toHaveValue('7:00 AM');
    await expect(list).toBeHidden();
    await expect(picker(page)).toBeVisible();
  });

  test('a mouse over the list highlights a time without scrolling it; the wheel and keys do', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Hovering is a mouse thing.');
    await page.goto('/');
    await jumpButton(page).click();
    const list = picker(page).getByRole('listbox', { name: 'Times' });
    await picker(page).getByRole('button', { name: 'Show times' }).click();
    await expect(list.getByRole('option', { selected: true })).toHaveText('9:30 PM');
    const box = await list.boundingBox();
    if (!box) throw new Error('not laid out');
    const scrollTop = () => list.evaluate((el) => el.scrollTop);
    const opened = await scrollTop();
    expect(opened).toBeGreaterThan(0);

    // A hand drifting up the list: the highlight follows the pointer, and the list stays put. It
    // used to centre each highlighted row, which slid a new one under the pointer, and so on.
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height - 8);
    await page.mouse.move(x, box.y + 8, { steps: 12 });
    // Then settling in the middle of a row (an edge between two is a coin toss between browsers).
    const row = await page.evaluate(
      ([px, py]) => {
        const option = document.elementFromPoint(px, py)?.closest('[role="option"]');
        const r = option?.getBoundingClientRect();
        return option && r ? { text: option.textContent, y: r.top + r.height / 2 } : null;
      },
      [x, box.y + box.height / 3] as const,
    );
    if (!row) throw new Error('no time under the pointer');
    await page.mouse.move(x, row.y, { steps: 4 });
    expect(await scrollTop()).toBe(opened);
    await expect(list.getByRole('option', { selected: true })).toHaveText(row.text);

    // The wheel scrolls it.
    await page.mouse.wheel(0, -200);
    await expect.poll(scrollTop).toBeLessThan(opened);

    // And the arrow keys bring the highlight into view.
    await page.mouse.move(box.x + box.width + 40, box.y);
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown');
    const selected = await list.getByRole('option', { selected: true }).boundingBox();
    if (!selected) throw new Error('no highlighted time');
    expect(selected.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(selected.y + selected.height).toBeLessThanOrEqual(box.y + box.height + 1);
  });

  test('hangs below Jump to a time on wide screens', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Wide screens only.');
    await page.goto('/');
    await jumpButton(page).click();
    const button = await jumpButton(page).boundingBox();
    const box = await picker(page).boundingBox();
    if (!button || !box) throw new Error('not laid out');
    expect(Math.abs(box.x + box.width - (button.x + button.width))).toBeLessThan(1.5);
    expect(Math.round(box.y - (button.y + button.height))).toBe(18);
    // Firefox can report 440.00003 when the popover lands on a fractional pixel.
    expect(box.width).toBeCloseTo(440, 2);
  });

  test('is a bottom sheet on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto('/');
    await jumpButton(page).click();
    const box = await picker(page).boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('not laid out');
    expect(box.x).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
  });

  test('keeps every control at least 44 by 44 pixels', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await controls(page).getByRole('button', { name: 'Change' }).click();
    await fill(page, 'New York', '2027-03-14', '2:30 AM');
    await expect(picker(page).getByRole('alert')).toBeVisible();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, select, input')]
        .filter((el) => (el as HTMLElement).offsetParent !== null || el.closest('dialog[open]'))
        .filter((el) => el.closest('dialog[open]') ?? el.closest('[aria-label="Controls"]'))
        .filter((el) => (el as HTMLInputElement).type !== 'radio')
        .map((el) => ({ name: el.textContent || el.id, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ name, r }) => `${name}: ${String(r.width)}x${String(r.height)}`),
    );
    expect(small).toEqual([]);
  });
});

test.describe('copy link', () => {
  test('copies the address of the Jump', async ({ page }) => {
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
    await page.goto(`/${TOKYO_HASH}`);
    await controls(page).getByRole('button', { name: 'Copy link' }).click();
    await expect(controls(page).getByRole('button', { name: 'Link copied' })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied),
    ).toEqual([page.url()]);
  });

  test('shows the link when there’s no clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await page.goto(`/${TOKYO_HASH}`);
    await controls(page).getByRole('button', { name: 'Copy link' }).click();
    const input = page.getByRole('textbox', { name: /Copy this link/ });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(page.url());
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations: picker and banner (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/${TOKYO_HASH}`);
      await expect(banner(page)).toBeVisible();
      const axe = () =>
        new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
      expect((await axe()).violations).toEqual([]);

      await controls(page).getByRole('button', { name: 'Change' }).click();
      await fill(page, 'New York', '2027-11-07', '1:30 AM');
      await expect(picker(page).getByRole('group')).toBeVisible();
      expect((await axe()).violations).toEqual([]);

      await fill(page, 'New York', '2027-03-14', '2:30 AM');
      await expect(picker(page).getByRole('alert')).toBeVisible();
      expect((await axe()).violations).toEqual([]);

      await timeField(page).press('ArrowDown');
      await expect(picker(page).getByRole('listbox', { name: 'Times' })).toBeVisible();
      expect((await axe()).violations).toEqual([]);
    });
  }
});
