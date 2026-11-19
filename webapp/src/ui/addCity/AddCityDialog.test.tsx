import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState, type StorageLike } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { realDataset } from '../../test/cityDataset';
import { LONDON, NOWHERE, TOKYO } from '../../test/places';
import { resetSearchIndex } from './useSearchIndex';

const loadDataset = vi.hoisted(() => vi.fn());
vi.mock('../../cities/dataset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../cities/dataset')>()),
  loadDataset,
}));

beforeEach(() => {
  loadDataset.mockImplementation(() => Promise.resolve(realDataset()));
});

afterEach(() => {
  resetSearchIndex();
  loadDataset.mockReset();
});

function renderApp(cities: StoredCity[] = [TOKYO]) {
  const state: AppState = { cities, settings: { timeFormat: '12', appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  const store = createStore(storage, loadState(storage));
  render(<App store={store} />);
  return { store, storage };
}

const dialog = () => screen.getByRole('dialog');
/** Visible text only: the live region repeats some of it for screen readers. */
const VISIBLE = { ignore: '[aria-live]' };
const field = () => within(dialog()).getByRole('combobox', { name: 'Search cities' });
const options = () => within(dialog()).queryAllByRole('option');
const savedNames = (storage: StorageLike) =>
  (JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as AppState).cities.map((c) =>
    c.kind === 'place' ? c.name : c.kind,
  );

async function search(text: string) {
  fireEvent.change(field(), { target: { value: text } });
  await waitFor(() => {
    expect(options().length).toBeGreaterThan(0);
  });
}

describe('add city', () => {
  it('opens from the Add city button, titled and focused on the search field', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    expect(dialog()).toHaveAccessibleName('Add a city');
    expect(field()).toHaveFocus();
    await waitFor(() => {
      expect(loadDataset).toHaveBeenCalledTimes(1);
    });
  });

  it('also opens from the Add a city tile', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add a city' }));
    expect(dialog()).toBeInTheDocument();
  });

  it('lists matches with time and zone, and Enter adds the highlighted one', async () => {
    const { storage } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await search('london');

    const [first] = options();
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(field()).toHaveAttribute('aria-activedescendant', first?.id);
    expect(first).toHaveAccessibleName(/^London, England, United Kingdom, .*GMT$/);

    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(savedNames(storage)).toEqual(['Tokyo', 'London']);
    // Stays open, and the row now says Added.
    expect(options()[0]).toHaveAttribute('aria-disabled', 'true');
    expect(within(options()[0] as HTMLElement).getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('London, England, United Kingdom, added.')).toBeInTheDocument();
  });

  it('Up and Down move the highlight; a click adds a row', async () => {
    const { storage } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await search('london');
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    const second = options()[1] as HTMLElement;
    expect(second).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(field(), { key: 'ArrowUp' });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(second);
    expect(savedNames(storage)).toHaveLength(2);
    expect(field()).toBeInTheDocument();
  });

  it('cities already on the list are marked Added and can’t be added twice', async () => {
    const { storage } = renderApp([LONDON]);
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await search('london');
    const london = options()[0] as HTMLElement;
    expect(london).toHaveAttribute('aria-disabled', 'true');
    // The highlight starts on the first row that can be added.
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(london);
    expect(savedNames(storage)).toEqual(['London']);
  });

  it('shows the time zone header band for a zone abbreviation', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await search('pst');
    expect(within(dialog()).getByText(/^Pacific Standard Time \(PST\)/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/cities in this time zone$/, VISIBLE)).toBeInTheDocument();
  });

  it('says so when nothing matches, with hints', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    await waitFor(() => {
      expect(loadDataset).toHaveBeenCalled();
    });
    fireEvent.change(field(), { target: { value: 'xyzzy' } });
    expect(
      await within(dialog()).findByText('No cities match “xyzzy”', VISIBLE),
    ).toBeInTheDocument();
    expect(within(dialog()).getByText(/airport code like LHR/)).toBeInTheDocument();
  });

  it('offers My Local Time when it isn’t on the list (D13)', async () => {
    const { storage } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    const local = within(dialog()).getByRole('option', { name: /^My Local Time, Detected: / });
    fireEvent.click(local);
    expect(savedNames(storage)).toEqual(['Tokyo', 'local']);
    await waitFor(() => {
      expect(options()).toHaveLength(0);
    });
  });

  it('credits GeoNames in the footer', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    expect(within(dialog()).getByText('City data from GeoNames (CC BY 4.0)')).toBeInTheDocument();
  });

  it('Done closes and returns focus to the button that opened it', () => {
    renderApp();
    const button = screen.getByRole('button', { name: 'Add city' });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('closes when the browser closes the dialog (Esc)', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    act(() => {
      (dialog() as HTMLDialogElement).close();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('from the empty list, focuses the first added card on closing', async () => {
    renderApp([]);
    const empty = screen.getByRole('region', { name: 'No clocks yet' });
    fireEvent.click(within(empty).getByRole('button', { name: 'Add city' }));
    await search('london');
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('article', { name: 'London' })).toHaveFocus();
  });

  it('explains a failed load and tries again', async () => {
    loadDataset.mockRejectedValueOnce(new Error('offline'));
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Add city' }));
    expect(await within(dialog()).findByText('Couldn’t load the city list')).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Try again' }));
    await search('london');
    expect(loadDataset).toHaveBeenCalledTimes(2);
  });
});

describe('choose a zone (D14)', () => {
  it('replaces the unrecognised card in place and focuses it', async () => {
    const { storage } = renderApp([LONDON, NOWHERE, TOKYO]);
    const card = screen.getByRole('article', { name: 'Olympus Mons' });
    fireEvent.click(within(card).getByRole('button', { name: 'Choose a zone' }));
    expect(dialog()).toHaveAccessibleName('Choose a zone');
    expect(dialog()).toHaveAccessibleDescription('Pick a city or time zone for “Olympus Mons”.');
    // The search starts from the saved name.
    expect(field()).toHaveValue('Olympus Mons');

    await search('kolkata');
    expect(within(options()[0] as HTMLElement).getByText('Choose')).toBeInTheDocument();
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(savedNames(storage)).toEqual(['London', 'Kolkata', 'Tokyo']);
    expect(screen.getByRole('article', { name: 'Kolkata' })).toHaveFocus();
  });
});
