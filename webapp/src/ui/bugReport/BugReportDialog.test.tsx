import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { BugReportService, SendResult } from '../../app/bugReportClient';
import { createStore } from '../../app/store';
import { STORAGE_KEY, type AppState } from '../../storage/schema';
import { loadState, serializeState } from '../../storage/storage';
import { fakeStorage } from '../../storage/testStorage';
import { LONDON } from '../../test/places';

const ISSUE = 'https://github.com/blueanvildesigns/meridian/issues/12';

function renderApp(result: SendResult = { ok: true, number: 12, url: ISSUE }) {
  const state: AppState = {
    cities: [LONDON],
    settings: { timeFormat: '24', appearance: 'system' },
  };
  const storage = fakeStorage({ [STORAGE_KEY]: serializeState(state) });
  const send = vi.fn<BugReportService['send']>(() => Promise.resolve(result));
  render(<App store={createStore(storage, loadState(storage))} reportBug={{ send }} />);
  return send;
}

const dialog = () => screen.getByRole('dialog', { name: 'Report a bug' });
const field = (name: RegExp) => within(dialog()).getByLabelText(name);
const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
};
const type = (name: RegExp, value: string) => {
  fireEvent.change(field(name), { target: { value } });
};
const send = () => {
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Send report' }));
};

describe('Report a bug (in-app form)', () => {
  it('opens from the footer, warns that issues are public, and starts in the description', () => {
    renderApp();
    open();
    expect(dialog()).toHaveAccessibleDescription(/Reports become public issues on GitHub/);
    expect(field(/What went wrong/)).toHaveFocus();
    expect(field(/Steps to reproduce/)).toBeInTheDocument();
    expect(field(/Email/)).toHaveAttribute('type', 'email');
    expect(within(dialog()).getByRole('checkbox', { name: 'Include diagnostics' })).toBeChecked();
  });

  it('shows exactly the diagnostics that will be sent, and no city', () => {
    renderApp();
    open();
    const box = within(dialog()).getByRole('checkbox', { name: 'Include diagnostics' });
    const shown = document.getElementById(box.getAttribute('aria-describedby') ?? '');
    expect(shown?.textContent).toMatch(
      /^App version: .+\nBrowser: .+\nOS: .+\nTime zone: .+\nTime format: 24-hour\nLocale: .+$/,
    );
    expect(dialog().textContent).not.toContain('London');
  });

  it('needs a description before it sends anything', () => {
    const sendSpy = renderApp();
    open();
    type(/What went wrong/, '   ');
    send();
    expect(field(/What went wrong/)).toHaveAttribute('aria-invalid', 'true');
    expect(field(/What went wrong/)).toHaveAccessibleDescription(/Describe what went wrong/);
    expect(field(/What went wrong/)).toHaveFocus();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('checks the email only if one is given', () => {
    const sendSpy = renderApp();
    open();
    type(/What went wrong/, 'Broken');
    type(/Email/, 'not-an-email');
    send();
    expect(field(/Email/)).toHaveAttribute('aria-invalid', 'true');
    expect(field(/Email/)).toHaveFocus();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('sends what was typed plus the diagnostics, then gives the issue number', async () => {
    const sendSpy = renderApp();
    open();
    type(/What went wrong/, '  Sydney is an hour off \n');
    type(/Steps to reproduce/, '1. Add Sydney');
    type(/Email/, ' me@example.com ');
    send();
    await screen.findByText('Thanks! Your report is issue #12.');
    const sent = sendSpy.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      description: 'Sydney is an hour off',
      steps: '1. Add Sydney',
      email: 'me@example.com',
      website: '',
    });
    expect(sent?.diagnostics).toMatch(/^App version: /);
    expect(Object.keys(sent ?? {}).toSorted()).toEqual([
      'description',
      'diagnostics',
      'email',
      'steps',
      'website',
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/London|United Kingdom|51\.5/);
    expect(within(dialog()).getByRole('link', { name: 'See issue #12 on GitHub' })).toHaveAttribute(
      'href',
      ISSUE,
    );
    expect(screen.getByText('Thanks! Your report is issue #12.')).toHaveFocus();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves the diagnostics out when the box is unticked', async () => {
    const sendSpy = renderApp();
    open();
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: 'Include diagnostics' }));
    expect(within(dialog()).queryByText(/^App version:/)).toBeNull();
    type(/What went wrong/, 'Broken');
    send();
    await screen.findByText('Thanks! Your report is issue #12.');
    expect(sendSpy.mock.calls[0]?.[0]).toEqual({ description: 'Broken', website: '' });
  });

  it('passes on whatever a bot put in the hidden honeypot field', async () => {
    const sendSpy = renderApp();
    open();
    // Hidden from people and assistive tech, and out of the Tab order.
    const trap = dialog().querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    if (trap) trap.value = 'https://spam.example';
    type(/What went wrong/, 'Buy now');
    send();
    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalled();
    });
    expect(sendSpy.mock.calls[0]?.[0].website).toBe('https://spam.example');
  });

  it('offers GitHub’s form, filled in, when sending fails', async () => {
    renderApp({
      ok: false,
      reason: 'server',
      message: 'GitHub didn’t accept the report just now.',
    });
    open();
    type(/What went wrong/, 'Broken clock');
    type(/Steps to reproduce/, 'Open it');
    send();
    const alert = await within(dialog()).findByRole('alert');
    expect(alert).toHaveTextContent('Your report wasn’t sent. GitHub didn’t accept the report');
    const href = within(alert)
      .getByRole('link', { name: 'report it on GitHub' })
      .getAttribute('href');
    const params = new URL(href ?? '').searchParams;
    expect(params.get('template')).toBe('bug_report.yml');
    expect(params.get('summary')).toBe('Broken clock');
    expect(params.get('what-happened')).toBe('Broken clock');
    expect(params.get('steps')).toBe('Open it');
    expect(params.get('diagnostics')).toMatch(/^App version: /);
    // The form stays, so a retry is one click.
    expect(field(/What went wrong/)).toHaveValue('Broken clock');
  });

  it('never puts the email in the GitHub fallback link', () => {
    renderApp();
    open();
    type(/What went wrong/, 'Broken');
    type(/Email/, 'me@example.com');
    const href = within(dialog())
      .getByRole('link', { name: 'Use GitHub instead' })
      .getAttribute('href');
    expect(decodeURIComponent(href ?? '')).not.toContain('me@example.com');
  });

  it('opens from About too, closing About first', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'About Meridian' }));
    const about = screen.getByRole('dialog', { name: 'About' });
    fireEvent.click(within(about).getByRole('button', { name: 'Report a bug' }));
    expect(screen.queryByRole('dialog', { name: 'About' })).toBeNull();
    expect(dialog()).toBeInTheDocument();
  });

  it('closes with Cancel and sends nothing', () => {
    const sendSpy = renderApp();
    open();
    type(/What went wrong/, 'Broken');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
