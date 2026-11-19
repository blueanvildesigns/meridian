import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, type AppState, type StoredCity } from '../storage/schema';
import { loadState, serializeState } from '../storage/storage';
import { fakeStorage } from '../storage/testStorage';
import { LONDON, NOWHERE, TOKYO } from '../test/places';
import { App, KOFI_URL } from './App';
import { createStore } from './store';

function renderApp(cities: StoredCity[] | null = [LONDON, TOKYO]) {
  const state: AppState = {
    cities: cities ?? [],
    settings: { timeFormat: '12', appearance: 'system' },
  };
  const storage = fakeStorage(cities ? { [STORAGE_KEY]: serializeState(state) } : {});
  const store = createStore(storage, loadState(storage));
  render(<App store={store} />);
  return { storage, store };
}

const cardNames = () =>
  within(screen.getByRole('list', { name: 'Your clocks' }))
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent);

describe('App shell', () => {
  it('renders the wordmark as the page heading', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Meridian' })).toBeInTheDocument();
  });

  it('labels the icon-only header buttons', () => {
    renderApp();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Meridian' })).toBeInTheDocument();
  });

  it('opens Ko-fi in a new tab without leaking the opener', () => {
    renderApp();
    const link = screen.getByRole('link', { name: 'Support on Ko-fi' });
    expect(link).toHaveAttribute('href', KOFI_URL);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('clock list', () => {
  it('starts a first visit with My Local Time (R-2)', () => {
    renderApp(null);
    expect(cardNames()).toEqual(['My Local Time']);
    expect(screen.getByText(/^Detected: /)).toBeInTheDocument();
  });

  it('shows the saved cards in order, then the Add a city tile', () => {
    renderApp();
    expect(cardNames()).toEqual(['London', 'Tokyo']);
    const items = within(screen.getByRole('list', { name: 'Your clocks' })).getAllByRole(
      'listitem',
    );
    expect(items.at(-1)).toHaveTextContent('Add a city');
  });

  it('gives each card a labelled article, drag handle and options button', () => {
    renderApp();
    const card = screen.getByRole('article', { name: 'London' });
    expect(within(card).getByRole('button', { name: 'Drag to reorder London' })).toBeVisible();
    expect(within(card).getByRole('button', { name: 'More options for London' })).toBeVisible();
    expect(within(card).getByText('United Kingdom')).toBeInTheDocument();
    expect(within(card).getByText(/^(Daytime|Night)$/)).toBeInTheDocument();
    expect(within(card).getByText(/^UTC\+0:00$/)).toBeInTheDocument();
  });

  it('enables Jump while there are cards', () => {
    renderApp();
    expect(screen.getByRole('button', { name: 'Jump to a time' })).toBeEnabled();
  });

  it('does not put the ticking clocks in a live region', () => {
    renderApp();
    const card = screen.getByRole('article', { name: 'London' });
    expect(card.closest('[aria-live]')).toBeNull();
  });
});

describe('empty list', () => {
  it('shows the empty state and disables Jump', () => {
    renderApp([]);
    expect(screen.getByRole('heading', { name: 'No clocks yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to a time' })).toBeDisabled();
    expect(screen.queryByRole('list', { name: 'Your clocks' })).toBeNull();
  });

  it('"Use my local time" adds the card, saves it and focuses it', () => {
    const { storage } = renderApp([]);
    fireEvent.click(screen.getByRole('button', { name: 'Use my local time' }));
    expect(cardNames()).toEqual(['My Local Time']);
    expect(screen.getByRole('article', { name: 'My Local Time' })).toHaveFocus();
    expect(storage.data.get(STORAGE_KEY)).toContain('"kind":"local"');
  });
});

describe('unrecognised zone', () => {
  it('shows the warning card without a time, and Remove removes it', () => {
    const { storage } = renderApp([NOWHERE, LONDON]);
    const card = screen.getByRole('article', { name: 'Olympus Mons' });
    expect(within(card).getByText('Time zone not recognized')).toBeInTheDocument();
    expect(within(card).getByText(/Mars\/Olympus_Mons/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Choose a zone' })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
    expect(cardNames()).toEqual(['London']);
    // Focus moves to the next card instead of being lost.
    expect(screen.getByRole('article', { name: 'London' })).toHaveFocus();
    expect(storage.data.get(STORAGE_KEY)).not.toContain('Olympus');
  });

  it('removing the last card focuses the empty state heading', () => {
    renderApp([NOWHERE]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('heading', { name: 'No clocks yet' })).toHaveFocus();
  });
});

describe('storage banner', () => {
  it('warns, as an alert, when storage is unavailable, and can be dismissed', () => {
    const store = createStore(null, loadState(null));
    render(<App store={store} />);
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('Can’t save in this browser');
    fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains when a newer version owns the data', () => {
    const raw = JSON.stringify({ schemaVersion: 99, cities: [], settings: {} });
    const storage = fakeStorage({ [STORAGE_KEY]: raw });
    render(<App store={createStore(storage, loadState(storage))} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Meridian was updated in another tab');
    expect(screen.getByRole('button', { name: 'Reload to update' })).toBeInTheDocument();
  });

  it('is absent when saving works', () => {
    renderApp();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
