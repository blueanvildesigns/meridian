// Copy as text (M8) in the app: the buttons in live mode and the Jump banner, the toast, and the
// text to copy by hand when the browser refuses. The text itself is in copyText.test.ts.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState, type StoredCity } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON, TOKYO } from '../../test/places';
import { NOTICE_MS } from '../Toast';

vi.mock('../../time/zones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../time/zones')>()),
  deviceZone: () => 'America/Chicago',
}));

const LOCAL: StoredCity = { id: 'me', kind: 'local' };
// Canvas JumpActive: 8:00 AM on Fri, Dec 4, 2026 in Tokyo.
const TOKYO_HASH = '#at=2026-12-03T23:00:00Z&ref=Asia/Tokyo&name=Tokyo';

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  // The canvas Main board's moment, 37 seconds into the minute: 9:43 PM on Tue, Nov 17 in Chicago.
  vi.setSystemTime(new Date('2026-11-18T03:43:37Z'));
  writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
  window.history.replaceState(null, '', '/');
});

function renderApp(cities: StoredCity[] = [LOCAL, LONDON, TOKYO]) {
  const state: AppState = { cities, settings: { timeFormat: '12', appearance: 'system' } };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  render(<App store={createStore(storage, loadState(storage))} />);
}

const copyButton = () => screen.getByRole('button', { name: 'Copy as text' });

/** Clicks and lets the clipboard's promise settle. */
async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
}

describe('Copy as text in live mode', () => {
  it('sits beside Jump to a time and copies the minute on screen, with a link to it', async () => {
    renderApp();
    const controls = screen.getByRole('region', { name: 'Controls' });
    expect(
      within(controls)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Jump to a time', 'Copy as text', 'Add city']);
    copyButton().focus();
    await click(copyButton());
    expect(writeText).toHaveBeenCalledWith(
      [
        'My Local Time (America/Chicago): Tue, Nov 17, 9:43 PM CST',
        'London: Wed, Nov 18, 3:43 AM GMT',
        'Tokyo: Wed, Nov 18, 12:43 PM JST',
        '',
        // The minute, not the second, and no name: a time in a zone (decision 7).
        `${window.location.origin}/#at=2026-11-18T03:43:00Z&ref=America/Chicago`,
      ].join('\n'),
    );
    expect(copyButton()).toHaveFocus();
  });

  it('says "Copied as text" in the toast for 3 seconds', async () => {
    renderApp();
    copyButton().focus();
    await click(copyButton());
    expect(screen.getByText('Copied as text')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(NOTICE_MS);
    });
    expect(screen.queryByText('Copied as text')).toBeNull();
  });

  it('isn’t offered with an empty list', () => {
    renderApp([]);
    expect(screen.queryByRole('button', { name: 'Copy as text' })).toBeNull();
  });

  it('replaces an Undo toast, and the removal stands', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'More options for London' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(screen.getByText('London removed')).toBeInTheDocument();
    await click(copyButton());
    expect(screen.queryByText('London removed')).toBeNull();
    expect(screen.getByText('Copied as text')).toBeInTheDocument();
    expect(writeText.mock.calls[0]?.[0]).not.toContain('London');
  });
});

describe('Copy as text in the Jump banner', () => {
  it('sits between Copy link and Change, and copies the jumped moment with its link', async () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp([LOCAL, { ...LONDON, customName: 'Office' }, TOKYO]);
    const controls = screen.getByRole('region', { name: 'Controls' });
    expect(
      within(controls)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Copy link', 'Copy as text', 'Change', 'Reset to live', 'Add city']);
    await click(copyButton());
    expect(writeText).toHaveBeenCalledWith(
      [
        'My Local Time (America/Chicago): Thu, Dec 3, 5:00 PM CST',
        // Renames in the text (decision 4); the link never carries them (M5-1).
        'Office: Thu, Dec 3, 11:00 PM GMT',
        'Tokyo: Fri, Dec 4, 8:00 AM JST',
        '',
        `${window.location.origin}/${TOKYO_HASH}`,
      ].join('\n'),
    );
    expect(screen.getByText('Copied as text')).toBeInTheDocument();
  });
});

describe('when the browser refuses the clipboard', () => {
  beforeEach(() => {
    writeText.mockImplementation(() => Promise.reject(new Error('denied')));
  });

  it('shows the text, focused, to copy by hand', async () => {
    renderApp([LOCAL, TOKYO]);
    await click(copyButton());
    const box = screen.getByRole('textbox', { name: /Copy this text/ });
    expect(box).toHaveValue(
      [
        'My Local Time (America/Chicago): Tue, Nov 17, 9:43 PM CST',
        'Tokyo: Wed, Nov 18, 12:43 PM JST',
        '',
        `${window.location.origin}/#at=2026-11-18T03:43:00Z&ref=America/Chicago`,
      ].join('\n'),
    );
    expect(box).toHaveFocus();
    expect(screen.queryByText('Copied as text')).toBeNull();
  });

  it('drops the text once the moment on screen changes (a Jump or Reset)', async () => {
    window.history.replaceState(null, '', `/${TOKYO_HASH}`);
    renderApp([LOCAL, TOKYO]);
    await click(copyButton());
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', { name: /Copy this text/ });
    expect(box.value).toContain('Tokyo: Fri, Dec 4, 8:00 AM JST');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to live' }));
    expect(screen.queryByRole('textbox', { name: /Copy this text/ })).toBeNull();
  });
});
