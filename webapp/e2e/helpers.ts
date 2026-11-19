// Shared e2e fixtures: saved cities shaped like what add-city stores, and seeding them.
import type { Page } from '@playwright/test';

// The canvas Main board's moment: 9:43 PM, Tue Nov 17, in Chicago.
export const BOARD_TIME = new Date('2026-11-18T03:43:00Z');

export const place = (
  id: string,
  zone: string,
  geonameId: number,
  name: string,
  countryCode: string,
  country: string,
  lat: number,
  lon: number,
) => ({ id, kind: 'place', zone, geonameId, name, countryCode, country, lat, lon });

export const LOCAL = { id: 'local', kind: 'local' };
export const NEW_YORK = place(
  'ny',
  'America/New_York',
  5128581,
  'New York City',
  'US',
  'United States',
  40.7,
  -74,
);
export const LONDON = place(
  'lon',
  'Europe/London',
  2643743,
  'London',
  'GB',
  'United Kingdom',
  51.5,
  -0.1,
);
export const KOLKATA = place('kol', 'Asia/Kolkata', 1275004, 'Kolkata', 'IN', 'India', 22.6, 88.4);
export const TOKYO = place('tyo', 'Asia/Tokyo', 1850147, 'Tokyo', 'JP', 'Japan', 35.7, 139.7);
export const SYDNEY = place(
  'syd',
  'Australia/Sydney',
  2147714,
  'Sydney',
  'AU',
  'Australia',
  -33.9,
  151.2,
);
export const NOWHERE = place(
  'mars',
  'Mars/Olympus_Mons',
  1,
  'Olympus Mons',
  'XX',
  'Mars',
  18.6,
  -134,
);

/** Saves a list before the app loads, once per tab (reloads keep whatever the app saved). */
export async function seed(page: Page, cities: object[]) {
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

export const card = (page: Page, name: string) => page.getByRole('article', { name });
export const cardNames = (page: Page) =>
  page
    .getByRole('list', { name: 'Your clocks' })
    .getByRole('heading', { level: 2 })
    .allTextContents();
