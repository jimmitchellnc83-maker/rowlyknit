import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalSearch from './GlobalSearch';

const renderInRouter = () =>
  render(
    <MemoryRouter>
      <GlobalSearch />
    </MemoryRouter>
  );

describe('GlobalSearch', () => {
  it('renders the trigger button when closed', () => {
    renderInRouter();
    expect(
      screen.getByRole('button', { name: /open global search/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the dialog when the trigger is clicked', () => {
    renderInRouter();
    fireEvent.click(screen.getByRole('button', { name: /open global search/i }));
    expect(screen.getByRole('dialog', { name: /global search/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search input/i })).toBeInTheDocument();
  });

  it('opens the dialog on Cmd+K and closes it on Escape', () => {
    renderInRouter();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog', { name: /global search/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
