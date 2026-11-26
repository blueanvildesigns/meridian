// Add to calendar (M9) on every engine: the dialog from the Jump banner, a real .ics download
// under the production CSP (a DST-change day included), the web calendar links (their pages are
// stubbed, so nothing reaches Google or Microsoft), the keyboard path, the phone's bottom sheet,
// reflow at 320 px, and axe in both themes. The file's rules are in src/ui/send/calendar.test.ts.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { BOARD_TIME, KOLKATA, LOCAL, LONDON, NEW_YORK, seed, TOKYO } from './helpers';

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';
// 1:30 AM EST in New York on 2027-03-14, half an hour before its clocks skip 2:00–3:00 AM.
const DST_HASH = '#at=2027-03-14T06:30:00Z&ref=America/New_York&name=New%20York%20City';
const BOARD = [LOCAL, { ...NEW_YORK, customName: 'New York' }, LONDON, KOLKATA, TOKYO];

const opener = (page: Page) =>
  page.getByRole('region', { name: 'Controls' }).getByRole('button', { name: 'Add to calendar' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Add to calendar' });
const download = (page: Page) => dialog(page).getByRole('button', { name: /Download \.ics file/ });
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

/** Answers for Google's and Microsoft's pages, so a test's popup never leaves this machine. */
async function stubWebCalendars(context: BrowserContext) {
  await context.route(/^https:\/\/(calendar\.google\.com|outlook\.(live|office)\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
  );
}

/** Downloads with the given title and duration, and returns the file's name and text. */
async function downloadEvent(page: Page, title: string, duration: string) {
  await opener(page).click();
  await dialog(page).getByRole('textbox', { name: 'Title' }).fill(title);
  await dialog(page).getByRole('radio', { name: duration }).check();
  const [file] = await Promise.all([page.waitForEvent('download'), download(page).click()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), text: readFileSync(path, 'utf8') };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, BOARD);
});

test.describe('add to calendar', () => {
  test('downloads an .ics file under the production CSP', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto(`/${TOKYO_HASH}`);
    const { name, text } = await downloadEvent(page, 'Planning call', '1 hour');
    expect(name).toBe('meridian-2026-12-04.ics');
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(text).toContain('\r\nDTSTART:20261203T230000Z\r\nDTEND:20261204T000000Z\r\n');
    expect(text).toContain('\r\nSUMMARY:Planning call\r\n');
    expect(text.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText('Calendar file downloaded', { exact: true })).toBeVisible();
    await expect(opener(page)).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });

  test('a DST-change day: the end is an hour later in real time', async ({ page }) => {
    await page.goto(`/${DST_HASH}`);
    await opener(page).click();
    await dialog(page).getByRole('radio', { name: '1 hour' }).check();
    // New York skips 2:00–3:00 AM, so an hour from 1:30 AM EST is 3:30 AM EDT; Chicago's own
    // change comes an hour later, so there it's still 1:30 AM CST.
    await expect(
      dialog(page).getByText('Ends Sun, Mar 14, 2027 · 3:30 AM in New York'),
    ).toBeVisible();
    await expect(
      dialog(page).getByText('Sun, Mar 14, 2027 · 1:30 AM in your calendar (America/Chicago)'),
    ).toBeVisible();
    const [file] = await Promise.all([page.waitForEvent('download'), download(page).click()]);
    const text = readFileSync(await file.path(), 'utf8');
    expect(text).toContain('\r\nDTSTART:20270314T063000Z\r\nDTEND:20270314T073000Z\r\n');
    // Untitled: no SUMMARY.
    expect(text).not.toContain('SUMMARY:');
  });

  test('opens each web calendar in a new tab with the event in UTC', async ({ page, context }) => {
    await stubWebCalendars(context);
    await page.goto(`/${TOKYO_HASH}`);
    for (const [name, origin, time] of [
      ['Google Calendar', 'https://calendar.google.com', 'dates'],
      ['Outlook.com', 'https://outlook.live.com', 'startdt'],
      ['Microsoft 365', 'https://outlook.office.com', 'startdt'],
    ] as const) {
      await opener(page).click();
      await dialog(page).getByRole('textbox', { name: 'Title' }).fill('Planning call');
      await dialog(page).getByRole('radio', { name: '30 min' }).check();
      const [popup] = await Promise.all([
        context.waitForEvent('page'),
        dialog(page)
          .getByRole('button', { name: new RegExp(`^${name}`) })
          .click(),
      ]);
      await popup.waitForLoadState();
      const url = new URL(popup.url());
      expect(url.origin).toBe(origin);
      expect(url.searchParams.get(time)).toMatch(
        time === 'dates' ? /^20261203T230000Z\/20261203T233000Z$/ : /^2026-12-03T23:00:00Z$/,
      );
      expect(url.searchParams.get(name === 'Google Calendar' ? 'text' : 'subject')).toBe(
        'Planning call',
      );
      // noopener: the new tab can't reach back into Meridian.
      expect(await popup.evaluate(() => window.opener === null)).toBe(true);
      await popup.close();
      await expect(dialog(page)).toHaveCount(0);
    }
  });

  test('works from the keyboard alone', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await page.reload();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await opener(page).evaluate((el) => el === document.activeElement)) break;
    }
    await expect(opener(page)).toBeFocused();
    await page.keyboard.press('Enter');
    const title = dialog(page).getByRole('textbox', { name: 'Title' });
    await expect(title).toBeFocused();
    await page.keyboard.type('Planning call');
    // Tab into the durations (none chosen yet, so the first takes focus); the arrows choose.
    await page.keyboard.press('Tab');
    await expect(dialog(page).getByRole('radio', { name: '15 min' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(dialog(page).getByRole('radio', { name: '1 hour' })).toBeChecked();
    // Back to the title; Enter downloads, the main action.
    await page.keyboard.press('Shift+Tab');
    await expect(title).toBeFocused();
    const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(file.suggestedFilename()).toBe('meridian-2026-12-04.ics');
    await expect(opener(page)).toBeFocused();

    // Esc closes without doing anything.
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(opener(page)).toBeFocused();
  });

  test('is a bottom sheet on phones, with the web calendars wrapping', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto(`/${TOKYO_HASH}`);
    await opener(page).click();
    const box = await dialog(page).boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('not laid out');
    expect(box.x).toBe(0);
    expect(box.width).toBe(viewport.width);
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    expect(box.y).toBeGreaterThan(0);
    const tops = await dialog(page)
      .getByRole('button', { name: /^(Google Calendar|Outlook\.com|Microsoft 365)/ })
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBeGreaterThan(1);
  });

  test('keeps every control at least 44 by 44 pixels', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await opener(page).click();
    await dialog(page).getByRole('radio', { name: 'Custom…' }).check();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('dialog[open] button, dialog[open] input, dialog[open] label')]
        .filter((el) => !(el instanceof HTMLInputElement && el.type === 'radio'))
        .filter((el) => !(el instanceof HTMLLabelElement) || el.querySelector('input[type=radio]'))
        .map((el) => ({ name: el.textContent || el.id, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
        .map(({ name, r }) => `${name}: ${String(r.width)}x${String(r.height)}`),
    );
    expect(small).toEqual([]);
  });
});

test.describe('reflow at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('nothing in the dialog scrolls sideways', async ({ page }) => {
    await page.goto(`/${TOKYO_HASH}`);
    await opener(page).click();
    await dialog(page).getByRole('radio', { name: 'Custom…' }).check();
    expect(
      await page.evaluate(() => {
        const d = document.querySelector('dialog[open]');
        return !!d && d.scrollWidth <= d.clientWidth && document.documentElement.scrollWidth <= 320;
      }),
    ).toBe(true);
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations: empty, chosen, invalid minutes, and the error (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      // The browser can make files, until the tab says it can't.
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('noBlobs')) return;
        URL.createObjectURL = () => {
          throw new Error('no blobs');
        };
      });
      await page.goto(`/${TOKYO_HASH}`);
      await opener(page).click();
      await expect(dialog(page)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await dialog(page).getByRole('radio', { name: '1.5 hours' }).check();
      await expect(dialog(page).getByText(/^Ends /)).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await dialog(page).getByRole('radio', { name: 'Custom…' }).check();
      const minutes = dialog(page).getByRole('textbox', { name: 'Length in minutes' });
      await minutes.fill('3');
      await minutes.blur();
      await expect(dialog(page).getByText('Enter whole minutes from 5 to 1,440.')).toBeVisible();
      expect((await axe(page)).violations).toEqual([]);

      await page.evaluate(() => {
        sessionStorage.setItem('noBlobs', '1');
      });
      await page.reload();
      await opener(page).click();
      await dialog(page).getByRole('radio', { name: '1 hour' }).check();
      await download(page).click();
      await expect(dialog(page).getByRole('alert')).toBeFocused();
      expect((await axe(page)).violations).toEqual([]);
    });
  }
});
