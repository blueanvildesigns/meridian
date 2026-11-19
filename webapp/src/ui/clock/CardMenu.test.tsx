import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON, TOKYO } from '../../test/places';
import { UNDO_MS } from '../UndoToast';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));

const LOCAL: StoredCity = { id: 'me', kind: 'local' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-11-18T03:43:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

function renderApp(cities: StoredCity[] = [LOCAL, LONDON, TOKYO]) {
  const state: AppState = { cities, settings: { timeFormat: '12', appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  render(<App store={createStore(storage, loadState(storage))} />);
  return { storage };
}

const saved = (storage: { data: Map<string, string> }) =>
  JSON.parse(storage.data.get(STORAGE_KEY) ?? '{}') as AppState;
const cardNames = () =>
  within(screen.getByRole('list', { name: 'Your clocks' }))
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent);
const card = (name: string) => screen.getByRole('article', { name });
const more = (name: string) => screen.getByRole('button', { name: `More options for ${name}` });
const menu = () => screen.getByRole('menu');
const item = (name: string) => within(menu()).getByRole('menuitem', { name });

function openMenu(name: string) {
  const button = more(name);
  button.focus();
  fireEvent.click(button);
}

describe('card menu', () => {
  it('opens from More options, named for the card, with focus on the first item', () => {
    renderApp();
    openMenu('London');
    expect(screen.getByRole('dialog', { name: 'Options for London' })).toBeInTheDocument();
    expect(more('London')).toHaveAttribute('aria-haspopup', 'menu');
    expect(more('London')).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Jump from here', 'Rename', 'Move up', 'Move down', 'Remove']);
    expect(item('Jump from here')).toHaveFocus();
  });

  it('moves between items with the arrow keys, wrapping, and Home and End', () => {
    renderApp();
    openMenu('London');
    const key = (name: string) => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: name });
    };
    key('ArrowDown');
    expect(item('Rename')).toHaveFocus();
    key('End');
    expect(item('Remove')).toHaveFocus();
    key('ArrowDown');
    expect(item('Jump from here')).toHaveFocus();
    key('ArrowUp');
    expect(item('Remove')).toHaveFocus();
    key('Home');
    expect(item('Jump from here')).toHaveFocus();
  });

  it('closes on Tab and gives focus back to More options', () => {
    renderApp();
    openMenu('London');
    fireEvent.keyDown(item('Jump from here'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more('London')).toHaveFocus();
    expect(more('London')).toHaveAttribute('aria-expanded', 'false');
  });

  it('can’t move the first card up or the last card down', () => {
    const { storage } = renderApp();
    openMenu('My Local Time');
    expect(item('Move up')).toHaveAttribute('aria-disabled', 'true');
    expect(item('Move down')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(item('Move up'));
    // Nothing happens: the menu stays open and the order and storage are unchanged.
    expect(menu()).toBeInTheDocument();
    expect(cardNames()).toEqual(['My Local Time', 'London', 'Tokyo']);
    expect(saved(storage).cities.map((c) => c.id)).toEqual(['me', LONDON.id, TOKYO.id]);
    fireEvent.keyDown(item('Move up'), { key: 'Tab' });

    openMenu('Tokyo');
    expect(item('Move down')).toHaveAttribute('aria-disabled', 'true');
  });

  it('moves a card one place, says where it went, and returns focus', () => {
    const { storage } = renderApp();
    openMenu('London');
    fireEvent.click(item('Move down'));
    expect(cardNames()).toEqual(['My Local Time', 'Tokyo', 'London']);
    expect(saved(storage).cities.map((c) => c.id)).toEqual(['me', TOKYO.id, LONDON.id]);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more('London')).toHaveFocus();
    expect(screen.getByText('London moved to position 3 of 3.')).toBeInTheDocument();

    openMenu('London');
    fireEvent.click(item('Move up'));
    expect(cardNames()).toEqual(['My Local Time', 'London', 'Tokyo']);
    expect(screen.getByText('London moved to position 2 of 3.')).toBeInTheDocument();
  });

  it('Jump from here opens the picker set to that card', () => {
    renderApp();
    openMenu('Tokyo');
    fireEvent.click(item('Jump from here'));
    expect(screen.queryByRole('menu')).toBeNull();
    const picker = screen.getByRole('dialog', { name: 'Jump to a time' });
    expect(within(picker).getByLabelText('Time is in')).toHaveDisplayValue(/^Tokyo/);
  });
});

describe('remove and undo', () => {
  it('removes the card, focuses the next one and offers Undo', () => {
    const { storage } = renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    expect(cardNames()).toEqual(['My Local Time', 'Tokyo']);
    expect(saved(storage).cities.map((c) => c.id)).toEqual(['me', TOKYO.id]);
    expect(card('Tokyo')).toHaveFocus();
    const toast = screen.getByText('London removed').parentElement;
    expect(toast?.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('Undo puts the card back where it was, saved, and focuses it', () => {
    const { storage } = renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cardNames()).toEqual(['My Local Time', 'London', 'Tokyo']);
    expect(saved(storage).cities.map((c) => c.id)).toEqual(['me', LONDON.id, TOKYO.id]);
    expect(card('London')).toHaveFocus();
    expect(screen.queryByText('London removed')).toBeNull();
  });

  it('keeps a renamed card’s name when it comes back', () => {
    renderApp([LOCAL, { ...LONDON, customName: 'Office' }]);
    openMenu('Office');
    fireEvent.click(item('Remove'));
    expect(screen.getByText('Office removed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cardNames()).toEqual(['My Local Time', 'Office']);
  });

  it('goes after 8 seconds, and the removal stands', () => {
    renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    act(() => {
      vi.advanceTimersByTime(UNDO_MS - 1);
    });
    expect(screen.getByText('London removed')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('London removed')).toBeNull();
    expect(cardNames()).toEqual(['My Local Time', 'Tokyo']);
  });

  it('waits while the pointer is over it', () => {
    renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    const toast = screen.getByText('London removed').parentElement as HTMLElement;
    fireEvent.pointerEnter(toast, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(UNDO_MS * 2);
    });
    expect(screen.getByText('London removed')).toBeInTheDocument();
    fireEvent.pointerLeave(toast, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(screen.queryByText('London removed')).toBeNull();
  });

  it('doesn’t wait for a tap, which never leaves', () => {
    renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    const toast = screen.getByText('London removed').parentElement as HTMLElement;
    fireEvent.pointerEnter(toast, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(screen.queryByText('London removed')).toBeNull();
  });

  it('a second removal replaces the toast; Undo brings back only the last', () => {
    renderApp();
    openMenu('London');
    fireEvent.click(item('Remove'));
    openMenu('Tokyo');
    fireEvent.click(item('Remove'));
    expect(screen.queryByText('London removed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cardNames()).toEqual(['My Local Time', 'Tokyo']);
  });

  it('removing the last card shows the empty state, and Undo brings the card back', () => {
    renderApp([LONDON]);
    openMenu('London');
    fireEvent.click(item('Remove'));
    expect(screen.getByRole('heading', { name: 'No clocks yet' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(card('London')).toHaveFocus();
  });
});

describe('rename', () => {
  const field = () => screen.getByRole('textbox', { name: 'City name' });

  function startRename(name: string) {
    openMenu(name);
    fireEvent.click(item('Rename'));
  }

  it('edits the name in place, selected, with a hint', () => {
    renderApp();
    startRename('London');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(field()).toHaveValue('London');
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('maxLength', '60');
    expect(within(card('London')).getByText('Enter to save · Esc to cancel')).toBeInTheDocument();
  });

  it('Enter saves the new name and focus goes back to More options', () => {
    const { storage } = renderApp();
    startRename('London');
    fireEvent.change(field(), { target: { value: '  Head office ' } });
    fireEvent.submit(field());
    expect(cardNames()).toEqual(['My Local Time', 'Head office', 'Tokyo']);
    expect(saved(storage).cities[1]).toMatchObject({ id: LONDON.id, customName: 'Head office' });
    expect(more('Head office')).toHaveFocus();
  });

  it('Esc cancels', () => {
    const { storage } = renderApp();
    startRename('London');
    fireEvent.change(field(), { target: { value: 'Elsewhere' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'City name' })).toBeNull();
    expect(cardNames()).toEqual(['My Local Time', 'London', 'Tokyo']);
    expect(saved(storage).cities[1]).not.toHaveProperty('customName');
    expect(more('London')).toHaveFocus();
  });

  it('an empty name goes back to the original', () => {
    const { storage } = renderApp([LOCAL, { ...LONDON, customName: 'Office' }]);
    startRename('Office');
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.submit(field());
    expect(cardNames()).toEqual(['My Local Time', 'London']);
    expect(saved(storage).cities[1]).not.toHaveProperty('customName');
  });

  it('saves when focus leaves the field', () => {
    renderApp();
    startRename('Tokyo');
    fireEvent.change(field(), { target: { value: 'Team Tokyo' } });
    fireEvent.blur(field());
    expect(cardNames()).toEqual(['My Local Time', 'London', 'Team Tokyo']);
  });
});
