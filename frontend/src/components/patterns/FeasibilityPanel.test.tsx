import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import FeasibilityPanel from './FeasibilityPanel';

vi.mock('axios');
const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockFeasibilityResponse(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    patternId: 'p1',
    patternName: 'Test Pattern',
    overallStatus: 'green',
    yarn: {
      status: 'green',
      requirement: {
        totalYardage: 800,
        weightNumber: 4,
        weightName: 'Medium',
        fiberHints: ['wool'],
        skeinCount: null,
        rawText: '800 yards worsted wool',
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
        reasons: ['Weight matches (worsted)', 'Enough yardage (1000 / 800 yds)'],
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
      message: '"Cascade 220" is a strong match for this pattern.',
    },
    tools: {
      status: 'green',
      rawText: 'US 7',
      requirements: [
        {
          sizeMm: 4.5,
          status: 'green',
          matches: [{ toolId: 't1', name: 'Knitpicks Circular', sizeMm: 4.5, type: 'circular_needle', offsetMm: 0 }],
          message: 'You have 1 tool at 4.5mm.',
        },
      ],
    },
    shoppingList: [],
    generatedAt: '2026-04-22T00:00:00Z',
  };
  return { data: { success: true, data: { feasibility: { ...base, ...overrides } } } };
}

describe('FeasibilityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    mockedAxios.get = vi.fn().mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<FeasibilityPanel patternId="p1" />);
    expect(screen.getByText(/analyzing feasibility/i)).toBeInTheDocument();
  });

  it('renders the green banner when everything matches', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockFeasibilityResponse());
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/ready to cast on/i)).toBeInTheDocument();
    });
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/patterns/p1/feasibility');
  });

  it('renders the yellow banner for a substitution', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(
      mockFeasibilityResponse({ overallStatus: 'yellow' }),
    );
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/substitute/i)).toBeInTheDocument();
    });
  });

  it('renders the red banner when materials are missing', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(
      mockFeasibilityResponse({ overallStatus: 'red' }),
    );
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/missing materials/i)).toBeInTheDocument();
    });
  });

  it('renders the best candidate with its reasons', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockFeasibilityResponse());
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText('Cascade 220')).toBeInTheDocument();
    });
    expect(screen.getByText(/weight matches/i)).toBeInTheDocument();
    expect(screen.getByText(/enough yardage/i)).toBeInTheDocument();
  });

  it('renders the parsed requirement summary', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockFeasibilityResponse());
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/pattern needs/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/~800 yds · Medium weight · wool/i)).toBeInTheDocument();
  });

  it('shows a shopping list section only when items are present', async () => {
    mockedAxios.get = vi.fn().mockResolvedValueOnce(mockFeasibilityResponse());
    const { rerender } = renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => screen.getByText(/ready to cast on/i));
    expect(screen.queryByText(/shopping list/i)).not.toBeInTheDocument();

    mockedAxios.get = vi.fn().mockResolvedValue(
      mockFeasibilityResponse({
        overallStatus: 'red',
        shoppingList: [
          { kind: 'yarn', description: 'medium weight wool yarn (~800 yds)', reason: 'No close match.' },
          { kind: 'tool', description: 'Needle/hook at 4.5mm', reason: 'No matching tool.' },
        ],
      }),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FeasibilityPanel patternId="p2" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => screen.getByText(/shopping list \(2\)/i));
    expect(screen.getByText('medium weight wool yarn (~800 yds)')).toBeInTheDocument();
    expect(screen.getByText('Needle/hook at 4.5mm')).toBeInTheDocument();
  });

  it('renders an error message when the request fails', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({
      response: { data: { message: 'Pattern not found' } },
    });
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/pattern not found/i)).toBeInTheDocument();
    });
  });

  it('renders the tool requirement with status pill', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue(mockFeasibilityResponse());
    renderWithProviders(<FeasibilityPanel patternId="p1" />);

    await waitFor(() => {
      expect(screen.getByText('4.5 mm')).toBeInTheDocument();
    });
    expect(screen.getByText(/you have 1 tool at 4.5mm/i)).toBeInTheDocument();
  });

  it('toggles the other candidates list', async () => {
    const withExtras = mockFeasibilityResponse();
    const feasibility = withExtras.data.data.feasibility as Record<string, unknown>;
    (feasibility.yarn as { candidates: unknown[] }).candidates.push({
      yarnId: 'y2',
      name: 'Backup Yarn',
      brand: 'Other',
      weight: 'worsted',
      fiberContent: '100% wool',
      yardsRemaining: 500,
      dyeLot: null,
      color: 'red',
      score: 70,
      level: 'yellow',
      weightLevel: 'green',
      yardageLevel: 'yellow',
      fiberLevel: 'green',
      reasons: ['Close on yardage'],
    });
    mockedAxios.get = vi.fn().mockResolvedValue(withExtras);

    renderWithProviders(<FeasibilityPanel patternId="p1" />);
    await waitFor(() => screen.getByText('Cascade 220'));

    expect(screen.queryByText('Backup Yarn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show 1 other candidate/i }));
    expect(screen.getByText('Backup Yarn')).toBeInTheDocument();
  });
});
