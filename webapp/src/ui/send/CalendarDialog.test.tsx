// Add to calendar (M9) in the app: the banner button, the dialog's fields and states, and what each
// action hands over. The file and links themselves are in calendar.test.ts.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON, TOKYO } from '../../test/places';
import { saveFile } from './saveFile';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));
vi.mock('./saveFile', () => ({ saveFile: vi.fn() }));

const LOCAL: StoredCity = { id: 'me', kind: 'local' };
// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';

let open: MockInstance<typeof window.open>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T03:43:00Z'));
  open = vi.spyOn(window, 'open').mockReturnValue(null);
  vi.mocked(saveFile).mockReset();
  window.history.replaceState(null, '', `/${TOKYO_HASH}`);
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

function renderApp(cities: StoredCity[] = [LOCAL, LONDON, TOKYO]) {
  const state: AppState = { cities, settings: { timeFormat: '12', appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  render(<App store={createStore(storage, loadState(storage))} />);
}

const opener = () => screen.getByRole('button', { name: 'Add to calendar' });
const dialog = () => screen.getByRole('dialog', { name: 'Add to calendar' });
const inDialog = () => within(dialog());
const download = () => inDialog().getByRole('button', { name: /Download \.ics file/ });
const web = (name: string) => inDialog().getByRole('button', { name: new RegExp(`^${name}`) });

function openDialog() {
  opener().focus();
  fireEvent.click(opener());
}

describe('Add to calendar', () => {
  it('isn’t offered in live mode (decision 9)', () => {
    window.history.replaceState(null, '', '/');
    renderApp();
    expect(screen.queryByRole('button', { name: 'Add to calendar' })).toBeNull();
  });

  it('opens from the banner with the moment, the title focused and every action off', () => {
    renderApp();
    expect(opener()).toHaveAttribute('aria-haspopup', 'dialog');
    openDialog();
    expect(dialog()).toHaveAccessibleDescription('Fri, Dec 4, 2026 · 8:00 AM in Tokyo');
    const title = inDialog().getByRole('textbox', { name: 'Title' });
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('placeholder', 'What is it?');
    expect(title).toHaveAccessibleDescription('Optional. Without one, the event will be untitled.');
    expect(inDialog().getByText('Choose a duration to add the event.')).toBeInTheDocument();
    expect(download()).toBeDisabled();
    for (const name of ['Google Calendar', 'Outlook.com', 'Microsoft 365']) {
      expect(web(name)).toBeDisabled();
    }
  });

  it('offers the drawn durations, none chosen, and shows the end time once one is', () => {
    renderApp();
    openDialog();
    const group = inDialog().getByRole('group', { name: 'Duration' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
      '1.5 hours',
      '2 hours',
      'Custom…',
    ]);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(within(group).getByRole('radio', { name: '1.5 hours' }));
    expect(inDialog().getByText('Ends Fri, Dec 4, 2026 · 9:30 AM in Tokyo')).toBeInTheDocument();
    expect(
      inDialog().getByText('Thu, Dec 3, 2026 · 6:30 PM in your calendar (America/Chicago)'),
    ).toBeInTheDocument();
    expect(download()).toBeEnabled();
    expect(web('Microsoft 365')).toBeEnabled();
  });

  it('takes a custom length in minutes, and says when it isn’t one', () => {
    renderApp();
    openDialog();
    fireEvent.click(inDialog().getByRole('radio', { name: 'Custom…' }));
    const minutes = inDialog().getByRole('textbox', { name: 'Length in minutes' });
    expect(download()).toBeDisabled();
    fireEvent.change(minutes, { target: { value: '2000' } });
    fireEvent.blur(minutes);
    expect(minutes).toHaveAttribute('aria-invalid', 'true');
    expect(minutes).toHaveAccessibleDescription('Enter whole minutes from 5 to 1,440.');
    expect(download()).toBeDisabled();
    fireEvent.change(minutes, { target: { value: '25' } });
    expect(minutes).toHaveAttribute('aria-invalid', 'false');
    expect(inDialog().getByText('Ends Fri, Dec 4, 2026 · 8:25 AM in Tokyo')).toBeInTheDocument();
    expect(download()).toBeEnabled();
  });

  it('downloads the file, closes, says so, and puts focus back on Add to calendar', () => {
    renderApp();
    openDialog();
    fireEvent.change(inDialog().getByRole('textbox', { name: 'Title' }), {
      target: { value: '  Planning call  ' },
    });
    fireEvent.click(inDialog().getByRole('radio', { name: '1 hour' }));
    fireEvent.click(download());
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [name, text, type] = vi.mocked(saveFile).mock.calls[0] ?? [];
    expect(name).toBe('meridian-2026-12-04.ics');
    expect(type).toBe('text/calendar;charset=utf-8');
    expect(text).toContain('\r\nSUMMARY:Planning call\r\n');
    expect(text).toContain('\r\nDTSTART:20261203T230000Z\r\nDTEND:20261204T000000Z\r\n');
    expect(text).toMatch(/\r\nUID:[\w-]+@meridian\.blueanvildesigns\.io\r\n/);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Calendar file downloaded')).toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it('downloads with Enter in the title field once a duration is chosen', () => {
    renderApp();
    openDialog();
    fireEvent.click(inDialog().getByRole('radio', { name: '30 min' }));
    fireEvent.submit(inDialog().getByRole('textbox', { name: 'Title' }));
    expect(saveFile).toHaveBeenCalledTimes(1);
  });

  it('shows an alert, and stays open, when the browser can’t make the file', () => {
    vi.mocked(saveFile).mockImplementation(() => {
      throw new Error('no blobs');
    });
    renderApp();
    openDialog();
    fireEvent.click(inDialog().getByRole('radio', { name: '1 hour' }));
    act(() => {
      fireEvent.click(download());
    });
    const alert = inDialog().getByRole('alert');
    expect(alert).toHaveTextContent(
      'Your browser couldn’t make the file. Try a web calendar below.',
    );
    expect(alert).toHaveFocus();
    expect(screen.queryByText('Calendar file downloaded')).toBeNull();
  });

  it('opens each web calendar in a new tab with the event, then closes', () => {
    renderApp();
    for (const [name, host] of [
      ['Google Calendar', 'https://calendar.google.com/calendar/render?'],
      ['Outlook.com', 'https://outlook.live.com/calendar/0/action/compose?'],
      ['Microsoft 365', 'https://outlook.office.com/calendar/0/action/compose?'],
    ] as const) {
      openDialog();
      fireEvent.click(inDialog().getByRole('radio', { name: '45 min' }));
      fireEvent.click(web(name));
      const [url, target, features] = open.mock.lastCall ?? [];
      expect(String(url).startsWith(host)).toBe(true);
      expect(target).toBe('_blank');
      expect(features).toBe('noopener,noreferrer');
      expect(screen.queryByRole('dialog')).toBeNull();
    }
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('names each web calendar for screen readers, with its account type', () => {
    renderApp();
    openDialog();
    expect(web('Outlook.com')).toHaveAccessibleName(
      'Outlook.com Personal accounts (opens in a new tab)',
    );
    expect(web('Microsoft 365')).toHaveAccessibleName(
      'Microsoft 365 Work or school accounts (opens in a new tab)',
    );
  });

  it('closes with Cancel and goes nowhere', () => {
    renderApp();
    openDialog();
    fireEvent.click(inDialog().getByRole('radio', { name: '1 hour' }));
    fireEvent.click(inDialog().getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saveFile).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(opener()).toHaveFocus();
  });
});
