import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON, NEW_YORK, TOKYO } from '../../test/places';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));

const LOCAL: StoredCity = { id: 'me', kind: 'local' };
// The canvas Main board's moment: 9:43 PM on Tue, Nov 17, 2026 in Chicago.
const NOW = new Date('2026-11-18T03:43:00Z');
// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

function renderApp(cities: StoredCity[] = [LOCAL, LONDON, TOKYO], timeFormat: '12' | '24' = '12') {
  const state: AppState = { cities, settings: { timeFormat, appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  render(<App store={createStore(storage, loadState(storage))} />);
}

const picker = () => screen.getByRole('dialog', { name: 'Jump to a time' });
const field = (label: string) => within(picker()).getByLabelText(label);
const apply = () => within(picker()).getByRole('button', { name: 'Apply' });
const card = (name: string) => screen.getByRole('article', { name });
const banner = () => screen.getByRole('status', { name: /^Jumped/ });

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Jump to a time' }));
}

function fill(city: string, date: string, time: string) {
  fireEvent.change(field('Time is in'), { target: { value: city } });
  fireEvent.change(field('Date'), { target: { value: date } });
  fireEvent.change(field('Time'), { target: { value: time } });
}

describe('Jump picker', () => {
  it('opens on My Local Time and the current moment, with the UTC equivalent', () => {
    renderApp();
    openPicker();
    expect(picker()).toHaveAccessibleDescription('See that date and time in every city.');
    expect(field('Time is in')).toHaveFocus();
    expect(field('Time is in')).toHaveDisplayValue('My Local Time (America/Chicago)');
    expect(field('Date')).toHaveValue('2026-11-17');
    expect(field('Time')).toHaveValue('9:43 PM');
    expect(
      within(picker()).getByText('That moment is Wed, Nov 18, 2026 · 3:43 AM UTC.'),
    ).toBeInTheDocument();
  });

  it('lists My Local Time first, then the cities in order (D12)', () => {
    renderApp([LONDON, LOCAL, TOKYO]);
    openPicker();
    const options = within(field('Time is in')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'My Local Time (America/Chicago)',
      'London',
      'Tokyo',
    ]);
  });

  it('shows the same moment in another city until the fields are edited', () => {
    renderApp();
    openPicker();
    fireEvent.change(field('Time is in'), { target: { value: 'tokyo' } });
    expect(field('Date')).toHaveValue('2026-11-18');
    expect(field('Time')).toHaveValue('12:43 PM');

    fireEvent.change(field('Time'), { target: { value: '8:00 AM' } });
    fireEvent.change(field('Time is in'), { target: { value: 'london' } });
    expect(field('Time')).toHaveValue('8:00 AM');
  });

  it('tidies a typed time and explains one it can’t read', () => {
    renderApp();
    openPicker();
    fireEvent.change(field('Time'), { target: { value: '8pm' } });
    fireEvent.blur(field('Time'));
    expect(field('Time')).toHaveValue('8:00 PM');

    fireEvent.change(field('Time'), { target: { value: '8:7' } });
    expect(apply()).toBeDisabled();
    fireEvent.blur(field('Time'));
    expect(field('Time')).toHaveAccessibleDescription('Enter a time like 8:00 AM.');
    expect(field('Time')).toBeInvalid();
  });

  it('Cancel closes it and puts focus back on Jump to a time', () => {
    renderApp();
    const jump = screen.getByRole('button', { name: 'Jump to a time' });
    jump.focus();
    fireEvent.click(jump);
    fireEvent.click(within(picker()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(jump).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('is unavailable with no cities (spec 4.6)', () => {
    renderApp([]);
    expect(screen.getByRole('button', { name: 'Jump to a time' })).toBeDisabled();
  });
});

describe('a skipped or repeated time', () => {
  it('a skipped time explains itself, offers the fix and holds Apply (canvas JumpPickerGap)', () => {
    renderApp([LOCAL, { ...NEW_YORK, customName: 'New York' }]);
    openPicker();
    fill('new-york', '2027-03-14', '2:30 AM');
    const alert = within(picker()).getByRole('alert');
    expect(alert).toHaveTextContent(
      '2:30 AM doesn’t exist in New York on Mar 14, 2027. Clocks skip from 2:00 AM to 3:00 AM that night.',
    );
    expect(apply()).toBeDisabled();
    expect(field('Time')).toBeInvalid();

    fireEvent.click(within(alert).getByRole('button', { name: 'Use 3:00 AM instead' }));
    expect(field('Time')).toHaveValue('3:00 AM');
    expect(field('Time')).toHaveFocus();
    expect(within(picker()).queryByRole('alert')).toBeNull();
    expect(apply()).toBeEnabled();
  });

  it('a repeated time asks which, the first preselected (canvas JumpPickerOverlap)', () => {
    renderApp([LOCAL, { ...NEW_YORK, customName: 'New York' }]);
    openPicker();
    fill('new-york', '2027-11-07', '1:30 AM');
    const group = within(picker()).getByRole('group', { name: 'Which 1:30 AM?' });
    expect(group).toHaveTextContent(
      '1:30 AM happens twice in New York on Nov 7, 2027, when clocks go back.',
    );
    const first = within(group).getByRole('radio', {
      name: /^1:30 AM EDT UTC−4:00, the first time$/,
    });
    const second = within(group).getByRole('radio', {
      name: /^1:30 AM EST UTC−5:00, the second time$/,
    });
    expect(first).toBeChecked();
    expect(
      within(picker()).getByText(/^That moment is Sun, Nov 7, 2027 · 5:30 AM UTC/),
    ).toBeVisible();

    fireEvent.click(second);
    fireEvent.click(apply());
    expect(window.location.hash).toBe(
      '#at=2027-11-07T06:30:00Z&ref=America/New_York&name=New%20York%20City',
    );
  });
});

describe('Jump applied', () => {
  it('pauses the clocks at that moment, tags the reference and says so (canvas JumpActive)', () => {
    renderApp();
    const length = window.history.length;
    openPicker();
    fill('tokyo', '2026-12-04', '8:00 AM');
    fireEvent.click(apply());

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe(TOKYO_HASH);
    expect(window.history.length).toBe(length + 1);
    expect(banner()).toHaveAccessibleName(
      'Jumped Fri, Dec 4, 2026 · 8:00 AM in Tokyo Clocks are paused. Day labels compare with My Local Time.',
    );
    expect(banner()).toHaveFocus();
    expect(screen.queryByText('Showing the current time')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jump to a time' })).toBeNull();

    expect(within(card('Tokyo')).getByText('Jump reference')).toBeInTheDocument();
    expect(card('Tokyo')).toHaveTextContent('8:00');
    expect(card('Tokyo')).toHaveTextContent('Next day');
    expect(card('London')).toHaveTextContent('11:00');
    expect(card('London')).toHaveTextContent('Same day');
    expect(card('My Local Time')).toHaveTextContent('5:00');
    expect(within(card('London')).queryByText('Jump reference')).toBeNull();
  });

  it('Change keeps the reference and replaces the Jump, so Back still goes to live', () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp();
    const length = window.history.length;
    const change = screen.getByRole('button', { name: 'Change' });
    change.focus();
    fireEvent.click(change);
    expect(field('Time is in')).toHaveDisplayValue('Tokyo');
    expect(field('Date')).toHaveValue('2026-12-04');
    expect(field('Time')).toHaveValue('8:00 AM');

    fireEvent.change(field('Time'), { target: { value: '9:30 AM' } });
    fireEvent.click(apply());
    expect(window.location.hash).toBe('#at=2026-12-04T00:30:00Z&ref=Asia/Tokyo&name=Tokyo');
    expect(window.history.length).toBe(length);
    expect(banner()).toHaveTextContent('Fri, Dec 4, 2026 · 9:30 AM in Tokyo');
    expect(change).toHaveFocus();
  });

  it('Reset to live restarts the clocks and focuses Jump to a time', () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to live' }));
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Showing the current time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to a time' })).toHaveFocus();
    expect(card('Tokyo')).toHaveTextContent('12:43');
    expect(card('Tokyo')).toHaveTextContent('Tomorrow');
  });

  it('follows the address bar: Back to live, or a pasted link', () => {
    renderApp();
    act(() => {
      window.history.replaceState(null, '', `/${TOKYO_HASH}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(banner()).toHaveTextContent('8:00 AM in Tokyo');
    act(() => {
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByText('Showing the current time')).toBeInTheDocument();
  });

  it('names a reference that isn’t in this list, and tags no card (D11)', () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp([LOCAL, LONDON]);
    expect(banner()).toHaveTextContent('Fri, Dec 4, 2026 · 8:00 AM in Tokyo');
    expect(screen.queryByText('Jump reference')).toBeNull();
    // Change can keep it.
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(field('Time is in')).toHaveDisplayValue('Tokyo (Asia/Tokyo)');
  });

  it('My Local Time writes no name: it’s a time in a zone, not a city', () => {
    renderApp();
    openPicker();
    fireEvent.change(field('Date'), { target: { value: '2026-12-03' } });
    fireEvent.change(field('Time'), { target: { value: '5:00 PM' } });
    fireEvent.click(apply());
    expect(window.location.hash).toBe('#at=2026-12-03T23:00:00Z&ref=America/Chicago');
    expect(banner()).toHaveTextContent('Thu, Dec 3, 2026 · 5:00 PM in My Local Time');
    expect(within(card('My Local Time')).getByText('Jump reference')).toBeInTheDocument();
  });

  it('ignores a malformed link and stays live', () => {
    window.history.replaceState(null, '', '/#at=yesterday&ref=Asia/Tokyo');
    renderApp();
    expect(screen.getByText('Showing the current time')).toBeInTheDocument();
  });

  it('uses the 24-hour clock when set', () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp(undefined, '24');
    expect(banner()).toHaveTextContent('Fri, Dec 4, 2026 · 08:00 in Tokyo');
  });
});

describe('Copy link', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the address of this Jump and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/${TOKYO_HASH}`);
    expect(screen.getByText('Link copied.')).toBeInTheDocument();
  });

  it('shows the link to copy when the browser refuses', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    const input = await screen.findByRole('textbox', { name: /Copy this link/ });
    expect(input).toHaveValue(`${window.location.origin}/${TOKYO_HASH}`);
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });
});
