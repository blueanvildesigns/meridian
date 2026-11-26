// DST heads-up (M10) in the app: the chip on the cards, live and during a Jump, and the Jump
// banner's line. The chip's wording and the zone rules are in cardView.test.ts and dst.test.ts.
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { KOLKATA, LONDON, NEW_YORK } from '../../test/places';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));

const LOCAL: StoredCity = { id: 'me', kind: 'local' };
// Canvas DstJump: Tue, Mar 30, 2027, 9:00 AM in New York.
const DST_JUMP = '#at=2027-03-30T13:00:00Z&ref=America/New_York&name=New%20York%20City';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Canvas DstLive: Fri, Mar 5, 2027, 4:00 PM in Chicago.
  vi.setSystemTime(new Date('2027-03-05T22:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

function renderApp(cities: StoredCity[] = [LOCAL, NEW_YORK, LONDON, KOLKATA]) {
  const state: AppState = { cities, settings: { timeFormat: '12', appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  render(<App store={createStore(storage, loadState(storage))} />);
}

const card = (name: string) => screen.getByRole('article', { name });
const chipOf = (name: string) => within(card(name)).queryByText(/Clocks change| then · /);

describe('DST heads-up', () => {
  it('live: a chip on the cards whose clocks change within 14 days', () => {
    renderApp();
    expect(chipOf('My Local Time')).toHaveTextContent('Clocks change Sun, Mar 14');
    expect(chipOf('New York City')).toHaveTextContent('Clocks change Sun, Mar 14');
    expect(chipOf('London')).toBeNull();
    expect(chipOf('Kolkata')).toBeNull();
  });

  it('live: the chip comes after the time and before the footer, in reading order', () => {
    renderApp();
    const text = card('New York City').textContent;
    const at = (s: string) => text.indexOf(s);
    expect(at('5:00')).toBeLessThan(at('Clocks change'));
    expect(at('Clocks change')).toBeLessThan(at('UTC−5:00'));
  });

  it('live: no chip and no line when nothing changes soon', () => {
    vi.setSystemTime(new Date('2027-05-05T22:00:00Z'));
    renderApp();
    expect(screen.queryByText(/Clocks change/)).toBeNull();
  });

  it('jump: "then · today" chips, and the banner names those cities', () => {
    window.history.replaceState(null, '', `/${DST_JUMP}`);
    renderApp();
    expect(chipOf('My Local Time')).toHaveTextContent('CDT then · CST today');
    expect(chipOf('New York City')).toHaveTextContent('EDT then · EST today');
    expect(chipOf('London')).toHaveTextContent('BST then · GMT today');
    // Kolkata's difference from My Local Time changes, but its own clocks don't.
    expect(within(card('Kolkata')).getByText('+10h 30m')).toBeInTheDocument();
    expect(chipOf('Kolkata')).toBeNull();
    expect(screen.queryByText(/Clocks change/)).toBeNull();

    const line = 'Clocks differ from today in My Local Time, New York City and London.';
    expect(screen.getByText(line)).toBeInTheDocument();
    // Part of the banner's status, so a changed Jump announces it.
    expect(screen.getByRole('status', { name: /^Jumped/ })).toHaveAccessibleName(
      `Jumped Tue, Mar 30, 2027 · 9:00 AM in New York City Clocks are paused. Day labels compare with My Local Time. ${line}`,
    );
  });

  it('jump: renames are used, as the cards show them', () => {
    window.history.replaceState(null, '', `/${DST_JUMP}`);
    renderApp([{ ...LOCAL, customName: 'Home' }, KOLKATA]);
    expect(screen.getByText('Clocks differ from today in Home.')).toBeInTheDocument();
  });

  it('jump: no line when every clock has today’s offset', () => {
    window.history.replaceState(
      null,
      '',
      '/#at=2027-03-08T15:00:00Z&ref=Asia/Kolkata&name=Kolkata',
    );
    renderApp();
    expect(screen.getByRole('status', { name: /^Jumped/ })).not.toHaveTextContent(/differ/);
    expect(screen.queryByText(/ then · /)).toBeNull();
  });
});
