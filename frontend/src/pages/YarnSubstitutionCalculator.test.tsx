import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import YarnSubstitutionCalculator from './YarnSubstitutionCalculator';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <YarnSubstitutionCalculator />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function greenResponse() {
  return {
    data: {
      success: true,
      data: {
        substitution: {
          status: 'green',
          requirement: {
            weightName: 'Medium',
            weightNumber: 4,
            fiberHints: ['wool'],
            totalYardage: 800,
            skeinCount: null,
          },
          bestCandidate: {
            yarnId: 'y1',
            name: 'Cascade 220',
            brand: 'Cascade',
            weight: 'worsted',
            fiberContent: '100% wool',
            yardsRemaining: 1000,
            dyeLot: 'ABC',
            color: 'blue',
            score: 100,
            level: 'green',
            weightLevel: 'green',
            yardageLevel: 'green',
            fiberLevel: 'green',
            reasons: ['Weight matches (worsted)'],
          },
          candidates: [
            {
              yarnId: 'y1',
              name: 'Cascade 220',
              brand: 'Cascade',
              weight: 'worsted',
              fiberContent: '100% wool',
              yardsRemaining: 1000,
              dyeLot: 'ABC',
              color: 'blue',
              score: 100,
              level: 'green',
              weightLevel: 'green',
              yardageLevel: 'green',
              fiberLevel: 'green',
              reasons: ['Weight matches (worsted)'],
            },
          ],
          message: '"Cascade 220" is a strong match.',
        },
      },
    },
  };
}

describe('YarnSubstitutionCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables the search button until at least one criterion is set', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /find substitutes/i });
    expect(btn).toBeDisabled();
  });

  it('enables search after picking a weight', () => {
    renderPage();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Medium' } });
    expect(screen.getByRole('button', { name: /find substitutes/i })).toBeEnabled();
  });

  it('enables search after selecting a fiber chip', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^wool$/i }));
    expect(screen.getByRole('button', { name: /find substitutes/i })).toBeEnabled();
  });

  it('submits the selected criteria to POST /api/yarn/substitutions', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue(greenResponse());
    renderPage();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Medium' } });
    fireEvent.click(screen.getByRole('button', { name: /^wool$/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 800'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /find substitutes/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/yarn/substitutions', {
        weightName: 'Medium',
        fiberHints: ['wool'],
        yardage: 800,
        skeinCount: null,
      });
    });
  });

  it('renders the best candidate with reasons after a successful search', async () => {
    mockedAxios.post = vi.fn().mockResolvedValue(greenResponse());
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^wool$/i }));
    fireEvent.click(screen.getByRole('button', { name: /find substitutes/i }));

    await waitFor(() => screen.getByText('Cascade 220'));
    expect(screen.getByRole('heading', { name: /strong match in your stash/i })).toBeInTheDocument();
    expect(screen.getByText(/weight matches/i)).toBeInTheDocument();
  });

  it('renders a red banner when no substitute is available', async () => {
    const empty = greenResponse();
    // Mutate to red + no candidates.
    const sub = empty.data.data.substitution as Record<string, unknown>;
    sub.status = 'red';
    sub.message = 'No close match.';
    sub.bestCandidate = null;
    (sub as { candidates: unknown[] }).candidates = [];
    mockedAxios.post = vi.fn().mockResolvedValue(empty);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^wool$/i }));
    fireEvent.click(screen.getByRole('button', { name: /find substitutes/i }));

    await waitFor(() => screen.getByText(/nothing in your stash/i));
  });

  it('shows an error message on API failure', async () => {
    mockedAxios.post = vi.fn().mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^wool$/i }));
    fireEvent.click(screen.getByRole('button', { name: /find substitutes/i }));

    await waitFor(() => screen.getByText(/could not load substitutions/i));
  });
});
