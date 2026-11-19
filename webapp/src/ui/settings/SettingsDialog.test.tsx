import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type Settings } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON } from '../../test/places';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 9:43 PM in Chicago; 3:43 AM in London.
  vi.setSystemTime(new Date('2026-11-18T03:43:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderApp(settings: Settings = { timeFormat: '12', appearance: 'system' }) {
  const state: AppState = { cities: [LONDON], settings };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  const store = createStore(storage, loadState(storage));
  render(<App store={store} />);
  return { storage, store };
}

const dialog = () => screen.getByRole('dialog', { name: 'Settings' });
const group = (name: string) => within(dialog()).getByRole('radiogroup', { name });
const radio = (groupName: string, name: string) =>
  within(group(groupName)).getByRole('radio', { name });
const gear = () => screen.getByRole('button', { name: 'Settings' });

function open() {
  gear().focus();
  fireEvent.click(gear());
}

describe('Settings', () => {
  it('opens from the header with focus on the current time format', () => {
    renderApp();
    open();
    expect(
      within(group('Time format'))
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Browser default', '12-hour', '24-hour']);
    expect(
      within(group('Appearance'))
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['System', 'Light', 'Dark']);
    expect(radio('Time format', '12-hour')).toBeChecked();
    expect(radio('Time format', '12-hour')).toHaveFocus();
    expect(radio('Appearance', 'System')).toBeChecked();
  });

  it('changes the time format at once, with an example, and saves it', () => {
    const { store } = renderApp();
    open();
    expect(group('Time format')).toHaveAccessibleDescription('Example: 9:43 PM');
    expect(
      within(screen.getByRole('article', { name: 'London' })).getByText(/^3:43/),
    ).toBeInTheDocument();

    fireEvent.click(radio('Time format', '24-hour'));
    expect(group('Time format')).toHaveAccessibleDescription('Example: 21:43');
    expect(
      within(screen.getByRole('article', { name: 'London' })).getByText(/^03:43/),
    ).toBeInTheDocument();
    expect(store.getSnapshot().state.settings.timeFormat).toBe('24');

    fireEvent.click(radio('Time format', 'Browser default'));
    expect(group('Time format')).toHaveAccessibleDescription(
      /^Follows your browser’s language and region\. Example: /,
    );
    expect(store.getSnapshot().state.settings.timeFormat).toBe('browser');
  });

  it('changes the appearance and saves it', () => {
    const { storage } = renderApp();
    open();
    expect(group('Appearance')).toHaveAccessibleDescription(
      /^Matches your device\. It is currently (Light|Dark)\.$/,
    );
    fireEvent.click(radio('Appearance', 'Dark'));
    expect(group('Appearance')).toHaveAccessibleDescription('Always use the dark appearance.');
    const saved = JSON.parse(storage.data.get(STORAGE_KEY) ?? '{}') as AppState;
    expect(saved.settings).toEqual({ timeFormat: '12', appearance: 'dark' });
  });

  it('Done closes it and focus goes back to the gear', () => {
    renderApp();
    open();
    expect(within(dialog()).getByText('Settings are saved in this browser.')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(gear()).toHaveFocus();
  });

  it('Close closes it too', () => {
    renderApp({ timeFormat: '24', appearance: 'light' });
    open();
    expect(radio('Time format', '24-hour')).toHaveFocus();
    expect(radio('Appearance', 'Light')).toBeChecked();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });
});
