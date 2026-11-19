// The clock list (M3) on every engine: real Intl and zone data from each browser, the polyfill
// path on WebKit, and the production CSP from firebase.json.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// The canvas Main board's moment: 9:43 PM, Tue Nov 17, in Chicago.
const BOARD_TIME = new Date('2026-11-18T03:43:00Z');

const place = (
  id: string,
  zone: string,
  geonameId: number,
  name: string,
  countryCode: string,
  country: string,
  lat: number,
  lon: number,
) => ({ id, kind: 'place', zone, geonameId, name, countryCode, country, lat, lon });

const LOCAL = { id: 'local', kind: 'local' };
const NEW_YORK = place(
  'ny',
  'America/New_York',
  5128581,
  'New York City',
  'US',
  'United States',
  40.7,
  -74,
);
const LONDON = place('lon', 'Europe/London', 2643743, 'London', 'GB', 'United Kingdom', 51.5, -0.1);
const KOLKATA = place('kol', 'Asia/Kolkata', 1275004, 'Kolkata', 'IN', 'India', 22.6, 88.4);
const TOKYO = place('tyo', 'Asia/Tokyo', 1850147, 'Tokyo', 'JP', 'Japan', 35.7, 139.7);
const SYDNEY = place('syd', 'Australia/Sydney', 2147714, 'Sydney', 'AU', 'Australia', -33.9, 151.2);
const NOWHERE = place('mars', 'Mars/Olympus_Mons', 1, 'Olympus Mons', 'XX', 'Mars', 18.6, -134);

/** Saves a list before the app loads, once per tab (reloads keep whatever the app saved). */
async function seed(page: Page, cities: object[]) {
  await page.addInitScript(
    (value) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('meridian', value);
    },
    JSON.stringify({
      schemaVersion: 1,
      cities,
      settings: { timeFormat: '12', appearance: 'system' },
    }),
  );
}

const card = (page: Page, name: string) => page.getByRole('article', { name });
const cardNames = (page: Page) =>
  page
    .getByRole('list', { name: 'Your clocks' })
    .getByRole('heading', { level: 2 })
    .allTextContents();
const savedIds = (page: Page) =>
  page.evaluate(() =>
    (
      JSON.parse(localStorage.getItem('meridian') ?? '{}') as { cities: { id: string }[] }
    ).cities.map((c) => c.id),
  );

/** Picks up a card by its handle, presses `key`, drops it, waiting for each announcement. */
async function keyboardMove(page: Page, name: string, key: string, position: string) {
  await page.getByRole('button', { name: `Drag to reorder ${name}` }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(`Picked up ${name},`)).toBeAttached();
  // dnd-kit announces the pickup at once but starts listening for arrow keys in a setTimeout, and
  // measures the cards in the next frames. A loaded CI runner can press inside that gap, so wait
  // one macrotask (queued after dnd-kit's) and two frames. People are never that quick.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      }),
  );
  await page.keyboard.press(key);
  await expect(page.getByText(`${name} moved to ${position}.`)).toBeAttached();
  await page.keyboard.press('Space');
  await expect(page.getByText(`${name} dropped at ${position}.`)).toBeAttached();
}

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

test.describe('the canvas Main board, live', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [LOCAL, NEW_YORK, LONDON, KOLKATA, TOKYO, SYDNEY]);
    await page.goto('/');
  });

  test('shows each card as drawn', async ({ page }) => {
    expect(await cardNames(page)).toEqual([
      'My Local Time',
      'New York City',
      'London',
      'Kolkata',
      'Tokyo',
      'Sydney',
    ]);
    const rows: [string, string[]][] = [
      [
        'My Local Time',
        [
          'Night',
          'Detected: America/Chicago',
          '9:43 PM',
          'Today',
          'Tue, Nov 17 · CST',
          'UTC−6:00',
          'Same time',
        ],
      ],
      [
        'New York City',
        ['Night', 'United States', '10:43 PM', 'Today', 'Tue, Nov 17 · EST', 'UTC−5:00', '+1h'],
      ],
      [
        'London',
        ['Night', 'United Kingdom', '3:43 AM', 'Tomorrow', 'Wed, Nov 18 · GMT', 'UTC+0:00', '+6h'],
      ],
      [
        'Kolkata',
        ['Daytime', 'India', '9:13 AM', 'Tomorrow', 'Wed, Nov 18 · IST', 'UTC+5:30', '+11h 30m'],
      ],
      [
        'Tokyo',
        ['Daytime', 'Japan', '12:43 PM', 'Tomorrow', 'Wed, Nov 18 · JST', 'UTC+9:00', '+15h'],
      ],
      [
        'Sydney',
        ['Daytime', 'Australia', '2:43 PM', 'Tomorrow', 'Wed, Nov 18 · AEDT', 'UTC+11:00', '+17h'],
      ],
    ];
    for (const [name, texts] of rows) {
      for (const text of texts) await expect(card(page, name)).toContainText(text);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(card(page, 'Tokyo')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('keeps every control at least 44 by 44 pixels', async ({ page }) => {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({
          name: el.getAttribute('aria-label') ?? el.textContent,
          r: el.getBoundingClientRect(),
        }))
        .filter(({ r }) => r.width < 44 || r.height < 44)
        .map(({ name, r }) => `${name}: ${r.width}x${r.height}`),
    );
    expect(small).toEqual([]);
  });
});

test('ticks over on the minute', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-18T03:42:58Z') });
  await seed(page, [LOCAL]);
  await page.goto('/');
  await expect(card(page, 'My Local Time')).toContainText('9:42 PM');
  await page.clock.runFor(3_000);
  await expect(card(page, 'My Local Time')).toContainText('9:43 PM');
});

test.describe('a legacy device zone', () => {
  test.use({ timezoneId: 'Asia/Calcutta' });

  // Chromium reports the emulated legacy name verbatim, as some real devices do. Firefox's
  // automation refuses to emulate a legacy ID at all ("Invalid timezone ID").
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox cannot emulate a legacy ID.');

  test('is shown by its current name (D6)', async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [LOCAL]);
    await page.goto('/');
    await expect(card(page, 'My Local Time')).toContainText('Detected: Asia/Kolkata');
    await expect(card(page, 'My Local Time')).toContainText('9:13 AM');
  });
});

test.describe('reordering', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [LOCAL, LONDON, TOKYO]);
  });

  test('works from the keyboard on the drag handle, and is announced', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Phones have no visible handle; Move up/down arrives with the menu (M6).');
    await page.goto('/');
    await keyboardMove(page, 'Tokyo', 'ArrowLeft', 'position 2 of 3');
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
    expect(await savedIds(page)).toEqual(['local', 'tyo', 'lon']);
    await page.reload();
    expect(await cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
  });

  test('works with a mouse on the drag handle', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Phones drag with a long press instead.');
    await page.goto('/');
    const handle = page.getByRole('button', { name: 'Drag to reorder Tokyo' });
    const target = await card(page, 'My Local Time').boundingBox();
    const from = await handle.boundingBox();
    if (!target || !from) throw new Error('missing layout');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(
        from.x + ((target.x + 20 - from.x) * i) / 10,
        from.y + ((target.y + 20 - from.y) * i) / 10,
      );
    }
    await page.mouse.up();
    await expect.poll(() => cardNames(page)).toEqual(['Tokyo', 'My Local Time', 'London']);
    expect(await savedIds(page)).toEqual(['tyo', 'local', 'lon']);
  });

  test('works with a long press on a phone', async ({ page, isMobile, browserName }) => {
    test.skip(
      !isMobile || browserName !== 'chromium',
      'Touch input is driven through Chromium CDP.',
    );
    await page.goto('/');
    const from = await card(page, 'Tokyo').boundingBox();
    const to = await card(page, 'My Local Time').boundingBox();
    if (!from || !to) throw new Error('missing layout');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    const x = from.x + from.width / 2;
    await touch('touchStart', x, from.y + 30);
    await page.waitForTimeout(400); // past the 250 ms long-press delay
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', x, from.y + 30 + ((to.y + 10 - from.y - 30) * i) / 10);
    }
    await touch('touchEnd', x, to.y + 10);
    await expect.poll(() => cardNames(page)).toEqual(['Tokyo', 'My Local Time', 'London']);
  });

  test('a quick swipe on a phone scrolls instead of dragging', async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(
      !isMobile || browserName !== 'chromium',
      'Touch input is driven through Chromium CDP.',
    );
    await page.goto('/');
    const from = await card(page, 'Tokyo').boundingBox();
    if (!from) throw new Error('missing layout');
    const cdp = await page.context().newCDPSession(page);
    const x = from.x + from.width / 2;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: from.y + 30 }],
    });
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: from.y + 30 - i * 30 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    expect(await cardNames(page)).toEqual(['My Local Time', 'London', 'Tokyo']);
  });

  test('runs under the production CSP', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Covered by the desktop drag.');
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto('/');
    await keyboardMove(page, 'Tokyo', 'ArrowLeft', 'position 2 of 3');
    await expect.poll(() => cardNames(page)).toEqual(['My Local Time', 'Tokyo', 'London']);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });
});

test.describe('empty list', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, []);
    await page.goto('/');
  });

  test('offers Add city and Use my local time, with Jump disabled', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'No clocks yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jump to a time' })).toBeDisabled();
    await page.getByRole('button', { name: 'Use my local time' }).click();
    await expect(card(page, 'My Local Time')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jump to a time' })).toBeEnabled();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await expect(page.getByRole('heading', { name: 'No clocks yet' })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe('error states', () => {
  test('an unrecognised zone gets the warning card; the rest still work', async ({ page }) => {
    await page.clock.setFixedTime(BOARD_TIME);
    await seed(page, [NOWHERE, LONDON]);
    await page.goto('/');
    await expect(card(page, 'Olympus Mons')).toContainText('Time zone not recognized');
    await expect(card(page, 'London')).toContainText('3:43 AM');
    await card(page, 'Olympus Mons').getByRole('button', { name: 'Remove' }).click();
    expect(await cardNames(page)).toEqual(['London']);
    await expect(card(page, 'London')).toBeFocused();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`blocked storage shows the banner; no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.clock.setFixedTime(BOARD_TIME);
      await page.addInitScript(() => {
        Storage.prototype.setItem = () => {
          throw new DOMException('blocked', 'SecurityError');
        };
      });
      await page.goto('/');
      const banner = page.getByRole('alert');
      await expect(banner).toContainText('Can’t save in this browser');
      // Still usable in memory.
      await expect(card(page, 'My Local Time')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      await banner.getByRole('button', { name: 'Dismiss' }).click();
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`the unrecognised-zone card has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.clock.setFixedTime(BOARD_TIME);
      await seed(page, [NOWHERE, LONDON, TOKYO]);
      await page.goto('/');
      await expect(card(page, 'Olympus Mons')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test('a change in another tab shows up here', async ({ page, context }) => {
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, [NOWHERE, LONDON]);
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await expect(card(other, 'Olympus Mons')).toBeVisible();
  await card(page, 'Olympus Mons').getByRole('button', { name: 'Remove' }).click();
  await expect.poll(() => cardNames(other)).toEqual(['London']);
});

test('Temporal: the polyfill on WebKit (the Safari path), never on native engines', async ({
  page,
  browserName,
}) => {
  const fetched: string[] = [];
  page.on('request', (r) => {
    if (/\/temporal-polyfill-[^/]*\.js$/.test(new URL(r.url()).pathname)) fetched.push(r.url());
  });
  await page.clock.setFixedTime(BOARD_TIME);
  await seed(page, [LONDON]);
  await page.goto('/');
  await expect(card(page, 'London')).toContainText('3:43 AM');
  await expect(card(page, 'London')).toContainText('Wed, Nov 18 · GMT');
  expect(fetched).toHaveLength(browserName === 'webkit' ? 1 : 0);
});
