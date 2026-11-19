import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { KOFI_URL } from '../../app/links';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON } from '../../test/places';
import { SITE_URL } from './AboutDialog';

function renderApp({ storageWorks = true } = {}) {
  const state: AppState = {
    cities: [LONDON],
    settings: { timeFormat: '12', appearance: 'system' },
  };
  const storage = storageWorks ? fakeStorage({ [STORAGE_KEY]: serializeState(state) }) : null;
  render(<App store={createStore(storage, loadState(storage))} />);
}

const dialog = () => screen.getByRole('dialog', { name: 'About' });
const link = (name: string | RegExp) => within(dialog()).getByRole('link', { name });

describe('About', () => {
  it('opens from the header and says what Meridian is, with its version', () => {
    renderApp();
    const button = screen.getByRole('button', { name: 'About Meridian' });
    button.focus();
    fireEvent.click(button);
    expect(within(dialog()).getByText('Meridian')).toBeInTheDocument();
    expect(
      within(dialog()).getByText(
        /^A world clock for planning across time zones · Version \d+\.\d+\.\d+ \(\w+\)$/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'About' })).toBeNull();
    expect(button).toHaveFocus();
  });

  it('opens from the footer too', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(dialog()).toBeInTheDocument();
  });

  it('credits the data sources, as GeoNames’ licence requires', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About Meridian' }));
    expect(link('GeoNames')).toHaveAttribute('href', 'https://www.geonames.org/');
    expect(link('CC BY 4.0')).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );
    expect(link('OurAirports')).toHaveAttribute('href', 'https://ourairports.com/');
    const credits = within(dialog()).getByRole('region', { name: 'Credits' });
    expect(credits).toHaveTextContent(/as of [A-Z][a-z]{2} \d{1,2}, \d{4}\./);
    expect(credits).toHaveTextContent('Time zone rules come from your browser');
    expect(credits).toHaveTextContent('Free and open source under the MIT license.');
  });

  it('links the maker and Ko-fi in new tabs without leaking the opener', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About Meridian' }));
    expect(link('blueanvildesigns.com')).toHaveAttribute('href', SITE_URL);
    expect(link('Support on Ko-fi')).toHaveAttribute('href', KOFI_URL);
    for (const a of within(dialog()).getAllByRole('link')) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('says data stays in the browser', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About Meridian' }));
    expect(
      within(dialog()).getByRole('region', { name: 'Your data stays with you' }),
    ).toHaveTextContent('Meridian has no accounts and sends nothing to a server.');
  });

  it('opens on "Your data" from the storage banner’s "What can I do?"', () => {
    renderApp({ storageWorks: false });
    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', { name: 'What can I do?' }),
    );
    expect(
      within(dialog()).getByRole('heading', { name: 'Your data stays with you' }),
    ).toHaveFocus();
  });
});
