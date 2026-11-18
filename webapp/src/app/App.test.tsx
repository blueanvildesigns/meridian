import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, KOFI_URL } from './App';

describe('App shell', () => {
  it('renders the wordmark as the page heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Meridian' })).toBeInTheDocument();
  });

  it('labels the icon-only header buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Meridian' })).toBeInTheDocument();
  });

  it('opens Ko-fi in a new tab without leaking the opener', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: 'Support on Ko-fi' });
    expect(link).toHaveAttribute('href', KOFI_URL);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
